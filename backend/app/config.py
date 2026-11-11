"""Application settings, read from environment variables (or a local .env file)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./fireflies.db"
    # Comma-separated list of origins allowed to call the API (the Next.js app).
    cors_origins: str = "http://localhost:3000"
    # Seed demo data on startup when the database is empty.
    seed_on_startup: bool = True

    # Optional LLM. Without a key the app uses its built-in rule-based
    # summarizer and transcript-grounded Q&A, so it works fully offline.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5-5"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
