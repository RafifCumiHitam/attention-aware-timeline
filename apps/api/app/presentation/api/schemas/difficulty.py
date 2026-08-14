"""Behavioral Difficulty Timeline schemas."""

from uuid import UUID

from pydantic import BaseModel, Field


class DifficultyWeightsSchema(BaseModel):
    pause_density: float = 0.20
    seek_density: float = 0.20
    backward_seek_density: float = 0.20
    replay_density: float = 0.15
    revisit_density: float = 0.15
    normalized_seek_distance: float = 0.10


class DifficultyBucketResponse(BaseModel):
    video_timestamp_start: float
    video_timestamp_end: float
    difficulty_score: float = Field(ge=0, le=1)
    pause_density: float = Field(ge=0, le=1)
    seek_density: float = Field(ge=0, le=1)
    backward_seek_density: float = Field(ge=0, le=1)
    replay_density: float = Field(ge=0, le=1)
    revisit_density: float = Field(ge=0, le=1)
    normalized_seek_distance: float = Field(ge=0, le=1)


class DifficultyTimelineResponse(BaseModel):
    video_id: UUID
    session_id: UUID | None = None
    bucket_seconds: float
    label: str = "Behavioral Difficulty Score"
    disclaimer: str
    weights: DifficultyWeightsSchema
    event_count: int = 0
    buckets: list[DifficultyBucketResponse]
