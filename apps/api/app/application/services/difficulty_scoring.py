"""
Behavioral Difficulty Score — pure functions over interaction events.

No emotion / Deep Learning. Transparent weighted baseline only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

from app.domain.value_objects.difficulty_weights import (
    BACKWARD_SEEK_CAP,
    DEFAULT_BUCKET_SECONDS,
    DEFAULT_DIFFICULTY_WEIGHTS,
    DifficultyWeights,
    PAUSE_CAP,
    REPLAY_CAP,
    REVISIT_CAP,
    SEEK_CAP,
    SEEK_DISTANCE_CAP,
)
from app.infrastructure.database.models.event import EventType


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def normalize_count(count: float, cap: float) -> float:
    if cap <= 0:
        return 0.0
    return clamp01(count / cap)


def bucket_index(video_timestamp: float, bucket_seconds: float) -> int:
    if video_timestamp < 0:
        return 0
    return int(video_timestamp // bucket_seconds)


def bucket_range(start: float, end: float, bucket_seconds: float) -> range:
    """Inclusive range of bucket indices covering [min(start,end), max(start,end)]."""
    lo = min(start, end)
    hi = max(start, end)
    i0 = bucket_index(lo, bucket_seconds)
    i1 = bucket_index(hi, bucket_seconds)
    return range(i0, i1 + 1)


@dataclass
class RawEvent:
    """Lightweight event view for scoring (no ORM dependency in pure path)."""

    event_type: str
    video_timestamp: float | None
    payload: dict[str, Any] | None = None
    session_id: str | None = None

    @classmethod
    def from_orm(cls, e: Any) -> "RawEvent":
        et = e.event_type
        et_val = et.value if hasattr(et, "value") else str(et)
        sid = e.session_id
        return cls(
            event_type=et_val,
            video_timestamp=float(e.video_timestamp)
            if e.video_timestamp is not None
            else None,
            payload=e.payload if isinstance(getattr(e, "payload", None), dict) else None,
            session_id=str(sid) if sid is not None else None,
        )


@dataclass
class BucketAccum:
    pause_count: float = 0.0
    seek_count: float = 0.0
    backward_seek_count: float = 0.0
    replay_count: float = 0.0
    revisit_count: float = 0.0
    seek_distance_sum: float = 0.0
    seek_distance_n: float = 0.0
    visit_sessions: set[str] = field(default_factory=set)
    hit_count: float = 0.0  # any behavioral signal


@dataclass(frozen=True)
class DifficultyBucket:
    video_timestamp_start: float
    video_timestamp_end: float
    difficulty_score: float
    pause_density: float
    seek_density: float
    backward_seek_density: float
    replay_density: float
    revisit_density: float
    normalized_seek_distance: float


def _seek_endpoints(event: RawEvent) -> tuple[float | None, float | None, str]:
    """Return (from_ts, to_ts, direction)."""
    payload = event.payload or {}
    to_ts = event.video_timestamp
    from_ts = payload.get("from")
    if from_ts is None:
        delta = payload.get("delta") or payload.get("seek_delta_seconds")
        if to_ts is not None and delta is not None:
            try:
                from_ts = float(to_ts) - float(delta)
            except (TypeError, ValueError):
                from_ts = None
    try:
        from_ts_f = float(from_ts) if from_ts is not None else None
    except (TypeError, ValueError):
        from_ts_f = None

    et = event.event_type
    if et == EventType.SEEK_FORWARD.value or et == "seek_forward":
        direction = "forward"
    elif et == EventType.SEEK_BACKWARD.value or et == "seek_backward":
        direction = "backward"
    else:
        direction = str(payload.get("direction") or "unknown")
        if direction == "unknown" and from_ts_f is not None and to_ts is not None:
            direction = "forward" if to_ts >= from_ts_f else "backward"

    return from_ts_f, to_ts, direction


def accumulate_events(
    events: Sequence[RawEvent],
    *,
    bucket_seconds: float = DEFAULT_BUCKET_SECONDS,
    duration_seconds: float | None = None,
) -> dict[int, BucketAccum]:
    """Map events onto timeline buckets."""
    buckets: dict[int, BucketAccum] = {}

    def ensure(i: int) -> BucketAccum:
        if i not in buckets:
            buckets[i] = BucketAccum()
        return buckets[i]

    # Track which buckets were visited (play/seek landings) for revisit/replay
    visited_before: set[int] = set()
    # Per-session last play position for replay detection
    last_play_bucket: dict[str, int] = {}

    for ev in events:
        et = ev.event_type
        ts = ev.video_timestamp
        sid = ev.session_id or "_"

        if et in (EventType.PAUSE.value, "pause") and ts is not None:
            i = bucket_index(ts, bucket_seconds)
            b = ensure(i)
            b.pause_count += 1
            b.hit_count += 1
            if sid:
                b.visit_sessions.add(sid)
            if i in visited_before:
                b.revisit_count += 1
            visited_before.add(i)
            continue

        if et in (
            EventType.SEEK.value,
            EventType.SEEK_FORWARD.value,
            EventType.SEEK_BACKWARD.value,
            "seek",
            "seek_forward",
            "seek_backward",
        ):
            from_ts, to_ts, direction = _seek_endpoints(ev)
            if to_ts is None and from_ts is None:
                continue

            # Distance
            distance = 0.0
            if from_ts is not None and to_ts is not None:
                distance = abs(to_ts - from_ts)

            # Buckets along the seek path + landing
            if from_ts is not None and to_ts is not None:
                indices = list(bucket_range(from_ts, to_ts, bucket_seconds))
            elif to_ts is not None:
                indices = [bucket_index(to_ts, bucket_seconds)]
            else:
                indices = [bucket_index(from_ts, bucket_seconds)]  # type: ignore[arg-type]

            is_backward = direction == "backward"
            # Replay: backward seek into a previously visited region
            landing = indices[-1] if to_ts is not None else indices[0]
            is_replay = is_backward and (landing in visited_before)

            for i in indices:
                b = ensure(i)
                b.seek_count += 1
                b.hit_count += 1
                if is_backward:
                    b.backward_seek_count += 1
                if is_replay:
                    b.replay_count += 1
                if distance > 0:
                    b.seek_distance_sum += distance
                    b.seek_distance_n += 1
                if sid:
                    b.visit_sessions.add(sid)
                if i in visited_before:
                    b.revisit_count += 0.5  # path revisit weaker than landing
                visited_before.add(i)

            # Stronger revisit on landing
            if landing in visited_before:
                ensure(landing).revisit_count += 0.5
            continue

        if et in (EventType.PLAY.value, "play") and ts is not None:
            i = bucket_index(ts, bucket_seconds)
            b = ensure(i)
            b.hit_count += 1
            if sid:
                b.visit_sessions.add(sid)
            # Replay: play restart near a recently left bucket after backward motion
            prev = last_play_bucket.get(sid)
            if prev is not None and i < prev and i in visited_before:
                b.replay_count += 1
            if i in visited_before:
                b.revisit_count += 1
            visited_before.add(i)
            last_play_bucket[sid] = i
            continue

        if et in (EventType.COMPLETE.value, "complete") and ts is not None:
            # Abandonment inverse not scored as difficulty of end bucket alone;
            # optional: slight hit for incomplete handled at session layer later.
            i = bucket_index(ts, bucket_seconds)
            ensure(i).hit_count += 0.25
            continue

    # Ensure continuous range if duration known
    if duration_seconds is not None and duration_seconds > 0:
        max_i = bucket_index(duration_seconds, bucket_seconds)
        for i in range(0, max_i + 1):
            ensure(i)

    return buckets


def score_bucket(acc: BucketAccum, weights: DifficultyWeights) -> dict[str, float]:
    w = weights.normalized()
    pause_density = normalize_count(acc.pause_count, PAUSE_CAP)
    seek_density = normalize_count(acc.seek_count, SEEK_CAP)
    backward_seek_density = normalize_count(acc.backward_seek_count, BACKWARD_SEEK_CAP)
    replay_density = normalize_count(acc.replay_count, REPLAY_CAP)
    revisit_density = normalize_count(acc.revisit_count, REVISIT_CAP)
    avg_dist = (
        acc.seek_distance_sum / acc.seek_distance_n if acc.seek_distance_n > 0 else 0.0
    )
    normalized_seek_distance = normalize_count(avg_dist, SEEK_DISTANCE_CAP)

    difficulty_score = clamp01(
        w.pause_density * pause_density
        + w.seek_density * seek_density
        + w.backward_seek_density * backward_seek_density
        + w.replay_density * replay_density
        + w.revisit_density * revisit_density
        + w.normalized_seek_distance * normalized_seek_distance
    )

    return {
        "difficulty_score": round(difficulty_score, 4),
        "pause_density": round(pause_density, 4),
        "seek_density": round(seek_density, 4),
        "backward_seek_density": round(backward_seek_density, 4),
        "replay_density": round(replay_density, 4),
        "revisit_density": round(revisit_density, 4),
        "normalized_seek_distance": round(normalized_seek_distance, 4),
    }


def compute_difficulty_timeline(
    events: Sequence[RawEvent] | Iterable[RawEvent],
    *,
    bucket_seconds: float = DEFAULT_BUCKET_SECONDS,
    duration_seconds: float | None = None,
    weights: DifficultyWeights | None = None,
    include_empty: bool = False,
) -> list[DifficultyBucket]:
    """
    Compute Behavioral Difficulty Score per video interval.

    Returns buckets sorted by video_timestamp_start.
    """
    weights = weights or DEFAULT_DIFFICULTY_WEIGHTS
    event_list = list(events)
    accum = accumulate_events(
        event_list, bucket_seconds=bucket_seconds, duration_seconds=duration_seconds
    )

    if not accum and duration_seconds:
        max_i = bucket_index(duration_seconds, bucket_seconds)
        accum = {i: BucketAccum() for i in range(0, max_i + 1)}

    result: list[DifficultyBucket] = []
    for i in sorted(accum.keys()):
        acc = accum[i]
        if not include_empty and acc.hit_count <= 0 and acc.pause_count <= 0:
            # still include if any feature non-zero
            if (
                acc.seek_count <= 0
                and acc.backward_seek_count <= 0
                and acc.replay_count <= 0
                and acc.revisit_count <= 0
            ):
                continue
        feats = score_bucket(acc, weights)
        start = i * bucket_seconds
        end = start + bucket_seconds
        result.append(
            DifficultyBucket(
                video_timestamp_start=start,
                video_timestamp_end=end,
                **feats,
            )
        )
    return result
