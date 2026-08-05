"""User schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    avatar_url: str | None = None
    bio: str | None = None
    attention_tracking_enabled: bool | None = None
    gaze_estimation_enabled: bool | None = None


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_superuser: bool
    avatar_url: str | None = None
    bio: str | None = None
    attention_tracking_enabled: bool
    gaze_estimation_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserPublic(BaseModel):
    id: UUID
    full_name: str
    avatar_url: str | None = None

    model_config = ConfigDict(from_attributes=True)
