"""Shared response fields."""

from datetime import datetime

from pydantic import BaseModel, Field


class MockMeta(BaseModel):
    mock: bool = Field(default=True, description="True when response is from mock inference")
    processed_at: datetime
    frame_id: str | None = None
    session_id: str | None = None
