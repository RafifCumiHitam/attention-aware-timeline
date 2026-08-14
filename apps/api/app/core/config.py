"""Application settings using Pydantic Settings v2."""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = Field(default="development", alias="ENVIRONMENT")
    project_name: str = Field(default="attention-aware-timeline", alias="PROJECT_NAME")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    api_v1_prefix: str = "/api/v1"

    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_workers: int = Field(default=4, alias="API_WORKERS")
    api_reload: bool = Field(default=True, alias="API_RELOAD")

    database_url: str = Field(
        default="postgresql+asyncpg://aat_user:change_me_strong_password@localhost:5432/attention_aware_timeline",
        alias="DATABASE_URL",
    )
    database_url_sync: str = Field(
        default="postgresql://aat_user:change_me_strong_password@localhost:5432/attention_aware_timeline",
        alias="DATABASE_URL_SYNC",
    )
    # SQLAlchemy echo — extremely expensive in local loops. Default OFF.
    database_echo: bool = Field(default=False, alias="DATABASE_ECHO")
    database_pool_size: int = Field(default=5, alias="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=10, alias="DATABASE_MAX_OVERFLOW")

    jwt_secret_key: str = Field(
        default="change_me_to_a_very_long_random_secret_key_at_least_32_chars",
        alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(default=30, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    jwt_refresh_token_expire_days: int = Field(default=7, alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS")

    cors_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        alias="CORS_ORIGINS",
    )

    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    youtube_api_key: str = Field(default="", alias="YOUTUBE_API_KEY")
    youtube_api_base: str = Field(
        default="https://www.googleapis.com/youtube/v3", alias="YOUTUBE_API_BASE"
    )
    youtube_http_timeout: float = Field(default=12.0, alias="YOUTUBE_HTTP_TIMEOUT")

    default_page_size: int = 20
    max_page_size: int = 100

    enable_attention_tracking: bool = Field(default=True, alias="ENABLE_ATTENTION_TRACKING")
    enable_websocket: bool = Field(default=True, alias="ENABLE_WEBSOCKET")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list) -> list:
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in ("development", "dev", "local")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")


@lru_cache
def get_settings() -> Settings:
    return Settings()
