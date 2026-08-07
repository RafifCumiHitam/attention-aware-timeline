"""Sprint 14 — session lifecycle, event association, closed-session guard."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.application.services.event_service import EventService
from app.application.services.session_service import SessionService
from app.domain.exceptions import ValidationError
from app.infrastructure.database.models.event import EventType
from app.infrastructure.database.models.session import LearningSession, SessionStatus
from app.presentation.api.schemas.event import EventBatchCreate, EventCreate
from app.presentation.api.schemas.session import SessionCreate


class FakeSessionRepo:
    def __init__(self):
        self.rows: dict = {}

    async def get_by_id(self, session_id):
        return self.rows.get(session_id)

    async def create(self, learning_session):
        if learning_session.id is None:
            learning_session.id = uuid4()
        self.rows[learning_session.id] = learning_session
        return learning_session

    async def update(self, learning_session):
        self.rows[learning_session.id] = learning_session
        return learning_session

    async def get_active_for_user_video(self, user_id, video_id):
        for s in self.rows.values():
            if (
                s.user_id == user_id
                and s.video_id == video_id
                and s.status in (SessionStatus.ACTIVE, SessionStatus.PAUSED)
            ):
                return s
        return None

    async def list_by_user(self, user_id, *, offset=0, limit=20, status=None):
        items = [s for s in self.rows.values() if s.user_id == user_id]
        if status:
            items = [s for s in items if s.status == status]
        return items[offset : offset + limit], len(items)


class FakeVideoRepo:
    def __init__(self, video_id):
        self.video_id = video_id

    async def get_by_id(self, vid):
        if vid == self.video_id:
            return SimpleNamespace(id=vid, is_published=True)
        return None


class FakeEventRepo:
    def __init__(self):
        self.rows = []

    async def create(self, event):
        event.id = uuid4()
        self.rows.append(event)
        return event

    async def create_many(self, events):
        for e in events:
            e.id = uuid4()
            self.rows.append(e)
        return events

    async def list_by_session_ordered(self, session_id, *, limit=2000):
        items = [e for e in self.rows if e.session_id == session_id]
        return sorted(
            items,
            key=lambda e: (
                e.video_timestamp if e.video_timestamp is not None else 1e18,
                e.client_timestamp or datetime.min.replace(tzinfo=timezone.utc),
            ),
        )[:limit]

    async def list_by_user(self, *args, **kwargs):
        return self.rows, len(self.rows)


@pytest.fixture
def user():
    return SimpleNamespace(id=uuid4(), is_superuser=False)


@pytest.fixture
def video_id():
    return uuid4()


@pytest.mark.asyncio
async def test_session_start_active(user, video_id):
    svc = SessionService.__new__(SessionService)
    svc.sessions = FakeSessionRepo()
    svc.videos = FakeVideoRepo(video_id)
    svc.events = FakeEventRepo()

    s = await svc.start(user, SessionCreate(video_id=video_id))
    assert s.status == SessionStatus.ACTIVE
    assert s.user_id == user.id
    assert s.video_id == video_id
    assert s.ended_at is None
    assert s.is_writable is True


@pytest.mark.asyncio
async def test_session_pause_resume_end(user, video_id):
    svc = SessionService.__new__(SessionService)
    svc.sessions = FakeSessionRepo()
    svc.videos = FakeVideoRepo(video_id)
    svc.events = FakeEventRepo()

    s = await svc.start(user, SessionCreate(video_id=video_id))
    paused = await svc.pause(s.id, user)
    assert paused.status == SessionStatus.PAUSED
    assert paused.is_writable is True

    active = await svc.resume(s.id, user)
    assert active.status == SessionStatus.ACTIVE

    ended = await svc.end(s.id, user)
    assert ended.status == SessionStatus.ENDED
    assert ended.ended_at is not None
    assert ended.is_writable is False


@pytest.mark.asyncio
async def test_recover_paused_session(user, video_id):
    svc = SessionService.__new__(SessionService)
    svc.sessions = FakeSessionRepo()
    svc.videos = FakeVideoRepo(video_id)
    svc.events = FakeEventRepo()

    s = await svc.start(user, SessionCreate(video_id=video_id))
    await svc.pause(s.id, user)
    recovered = await svc.recover(user, session_id=s.id)
    assert recovered.status == SessionStatus.ACTIVE


@pytest.mark.asyncio
async def test_reject_events_on_closed_session(user, video_id):
    session_svc = SessionService.__new__(SessionService)
    session_svc.sessions = FakeSessionRepo()
    session_svc.videos = FakeVideoRepo(video_id)
    session_svc.events = FakeEventRepo()

    s = await session_svc.start(user, SessionCreate(video_id=video_id))
    await session_svc.end(s.id, user)

    event_svc = EventService.__new__(EventService)
    event_svc.events = FakeEventRepo()
    event_svc.sessions = session_svc

    with pytest.raises(ValidationError):
        await event_svc.create(
            user,
            EventCreate(
                event_type=EventType.PLAY,
                session_id=s.id,
                video_id=video_id,
                video_timestamp=30.0,
                client_timestamp=datetime.now(timezone.utc),
            ),
        )


@pytest.mark.asyncio
async def test_events_share_session_and_timeline_order(user, video_id):
    session_svc = SessionService.__new__(SessionService)
    session_svc.sessions = FakeSessionRepo()
    session_svc.videos = FakeVideoRepo(video_id)
    event_repo = FakeEventRepo()
    session_svc.events = event_repo

    s = await session_svc.start(user, SessionCreate(video_id=video_id))

    event_svc = EventService.__new__(EventService)
    event_svc.events = event_repo
    event_svc.sessions = session_svc

    batch = EventBatchCreate(
        events=[
            EventCreate(
                event_type=EventType.PLAY,
                session_id=s.id,
                video_id=video_id,
                video_timestamp=30.0,
                client_timestamp="2026-08-08T00:00:30Z",
            ),
            EventCreate(
                event_type=EventType.ATTENTION_SAMPLE,
                session_id=s.id,
                video_id=video_id,
                video_timestamp=42.0,
                attention_score=0.82,
                client_timestamp="2026-08-08T00:00:42Z",
            ),
            EventCreate(
                event_type=EventType.SEEK_FORWARD,
                session_id=s.id,
                video_id=video_id,
                video_timestamp=75.0,
                client_timestamp="2026-08-08T00:01:15Z",
            ),
            EventCreate(
                event_type=EventType.ATTENTION_SAMPLE,
                session_id=s.id,
                video_id=video_id,
                video_timestamp=76.0,
                attention_score=0.31,
                client_timestamp="2026-08-08T00:01:16Z",
            ),
            EventCreate(
                event_type=EventType.ADAPTIVE_DECISION,
                session_id=s.id,
                video_id=video_id,
                video_timestamp=77.0,
                client_timestamp="2026-08-08T00:01:17Z",
                payload={"playback_rate": 0.8, "action": "slowdown"},
            ),
            EventCreate(
                event_type=EventType.SPEED_CHANGE,
                session_id=s.id,
                video_id=video_id,
                video_timestamp=80.0,
                client_timestamp="2026-08-08T00:01:20Z",
                payload={"to": 0.8},
            ),
        ]
    )
    created = await event_svc.create_batch(user, batch)
    assert len(created) == 6
    assert all(e.session_id == s.id for e in created)

    timeline = await session_svc.timeline(s.id, user)
    assert [e.event_type for e in timeline] == [
        EventType.PLAY,
        EventType.ATTENTION_SAMPLE,
        EventType.SEEK_FORWARD,
        EventType.ATTENTION_SAMPLE,
        EventType.ADAPTIVE_DECISION,
        EventType.SPEED_CHANGE,
    ]
    assert timeline[1].attention_score == 0.82
    assert timeline[4].payload["playback_rate"] == 0.8


@pytest.mark.asyncio
async def test_recover_rejects_ended_session(user, video_id):
    svc = SessionService.__new__(SessionService)
    svc.sessions = FakeSessionRepo()
    svc.videos = FakeVideoRepo(video_id)
    svc.events = FakeEventRepo()

    s = await svc.start(user, SessionCreate(video_id=video_id))
    await svc.end(s.id, user)

    with pytest.raises(ValidationError):
        await svc.recover(user, session_id=s.id)
