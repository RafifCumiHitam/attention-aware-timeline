"""AI service configuration."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    project_name: str = "attention-aware-timeline-ai"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    host: str = "0.0.0.0"
    port: int = 8001
    log_level: str = "INFO"

    # Model paths (used when inference is enabled)
    model_path: str = "/app/models"
    device: str = "cpu"
    confidence_threshold: float = 0.5
    max_faces: int = 1
    frame_skip: int = 2
    mediapipe_model_complexity: int = 1

    # Mock mode — always true until real models are wired
    mock_inference: bool = True

    cors_origins: list[str] = ["*"]

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in {"development", "dev", "local"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
