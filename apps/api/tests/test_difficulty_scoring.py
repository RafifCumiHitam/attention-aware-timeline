"""Sprint 16 — Behavioral Difficulty Score unit tests."""

from __future__ import annotations

from app.application.services.difficulty_scoring import (
    RawEvent,
    accumulate_events,
    bucket_index,
    clamp01,
    compute_difficulty_timeline,
    normalize_count,
    score_bucket,
    BucketAccum,
)
from app.domain.value_objects.difficulty_weights import (
    DEFAULT_DIFFICULTY_WEIGHTS,
    DifficultyWeights,
)


def test_clamp01():
    assert clamp01(-1) == 0.0
    assert clamp01(0.5) == 0.5
    assert clamp01(2) == 1.0


def test_normalize_count():
    assert normalize_count(0, 3) == 0.0
    assert normalize_count(3, 3) == 1.0
    assert normalize_count(6, 3) == 1.0
    assert normalize_count(1.5, 3) == 0.5


def test_bucket_index():
    assert bucket_index(0, 10) == 0
    assert bucket_index(9.9, 10) == 0
    assert bucket_index(10, 10) == 1
    assert bucket_index(130, 10) == 13
    assert bucket_index(300, 10) == 30


def test_pause_density_feature():
    events = [
        RawEvent("pause", 305.0),
        RawEvent("pause", 308.0),
        RawEvent("pause", 312.0),
    ]
    timeline = compute_difficulty_timeline(events, bucket_seconds=10)
    # 300-310 and 310-320 buckets
    by_start = {b.video_timestamp_start: b for b in timeline}
    assert 300.0 in by_start
    assert by_start[300.0].pause_density > 0.5
    assert by_start[300.0].difficulty_score > 0.0


def test_seek_density_and_distance():
    events = [
        RawEvent(
            "seek_forward",
            450.0,
            payload={"from": 130.0, "delta": 320.0, "direction": "forward"},
        )
    ]
    timeline = compute_difficulty_timeline(events, bucket_seconds=10)
    assert len(timeline) > 1
    # Landing bucket ~450
    landing = next(b for b in timeline if b.video_timestamp_start == 450.0)
    assert landing.seek_density > 0
    assert landing.normalized_seek_distance > 0.5  # 320s jump / 120 cap → 1.0


def test_backward_seek_density():
    events = [
        RawEvent(
            "seek_backward",
            300.0,
            payload={"from": 450.0, "direction": "backward"},
        )
    ]
    timeline = compute_difficulty_timeline(events, bucket_seconds=10)
    landing = next(b for b in timeline if b.video_timestamp_start == 300.0)
    assert landing.backward_seek_density > 0
    assert landing.seek_density > 0


def test_acceptance_scenario_elevated_around_5_min():
    """
    02:10 → 07:30 forward seek
    07:30 → 05:00 backward seek
    05:00 → 05:20 pause
    05:20 → 05:00 replay
    """
    events = [
        RawEvent("play", 130.0, session_id="s1"),
        RawEvent(
            "seek_forward",
            450.0,
            payload={"from": 130.0, "direction": "forward"},
            session_id="s1",
        ),
        RawEvent(
            "seek_backward",
            300.0,
            payload={"from": 450.0, "direction": "backward"},
            session_id="s1",
        ),
        RawEvent("pause", 300.0, session_id="s1"),
        RawEvent("play", 320.0, session_id="s1"),
        RawEvent(
            "seek_backward",
            300.0,
            payload={"from": 320.0, "direction": "backward"},
            session_id="s1",
        ),  # replay into 5:00
        RawEvent("play", 300.0, session_id="s1"),
    ]
    timeline = compute_difficulty_timeline(events, bucket_seconds=10)
    by_start = {b.video_timestamp_start: b for b in timeline}

    # Region around 5:00 (300s) should be elevated
    hot = by_start[300.0]
    assert hot.difficulty_score >= 0.25
    assert hot.pause_density > 0 or hot.backward_seek_density > 0
    assert hot.replay_density > 0 or hot.revisit_density > 0

    # Quiet region with no events should be absent (include_empty=False)
    assert 0.0 not in by_start or by_start[0.0].difficulty_score == 0


def test_weighted_score_formula():
    acc = BucketAccum(
        pause_count=3,
        seek_count=4,
        backward_seek_count=3,
        replay_count=3,
        revisit_count=4,
        seek_distance_sum=120,
        seek_distance_n=1,
    )
    feats = score_bucket(acc, DEFAULT_DIFFICULTY_WEIGHTS)
    # All features at 1.0 → score ≈ 1.0
    assert feats["difficulty_score"] == 1.0


def test_custom_weights():
    w = DifficultyWeights(
        pause_density=1.0,
        seek_density=0.0,
        backward_seek_density=0.0,
        replay_density=0.0,
        revisit_density=0.0,
        normalized_seek_distance=0.0,
    )
    events = [RawEvent("pause", 50.0), RawEvent("pause", 51.0), RawEvent("pause", 52.0)]
    timeline = compute_difficulty_timeline(events, bucket_seconds=10, weights=w)
    b = timeline[0]
    assert b.pause_density == 1.0
    assert b.difficulty_score == 1.0
    assert b.seek_density == 0.0


def test_accumulate_seek_path_covers_intermediate_buckets():
    events = [
        RawEvent(
            "seek_forward",
            30.0,
            payload={"from": 0.0, "direction": "forward"},
        )
    ]
    accum = accumulate_events(events, bucket_seconds=10)
    assert 0 in accum
    assert 1 in accum
    assert 2 in accum
    assert 3 in accum
