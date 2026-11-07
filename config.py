"""Server-side configuration. Every secret comes from environment variables."""
import os
from dataclasses import dataclass, field
from dotenv import load_dotenv
from pathlib import Path

# Refuse to read development defaults if a test process reaches config before
# tests/conftest.py initializes its explicit test environment.
from database_safety import assert_safe_application_database_selection, assert_safe_database_selection

assert_safe_database_selection()

# Process environment (for example test and container settings) takes precedence over local defaults.
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=False)

_DEFAULT_DATABASE_URL = "postgresql+psycopg://eureka:eureka_dev_password@localhost:5432/eureka_dev"
_environment = os.getenv("EUREKA_ENV", "development").strip().lower()
assert_safe_application_database_selection(
    os.getenv("DATABASE_URL", _DEFAULT_DATABASE_URL), environment=_environment
)


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv(
        "DATABASE_URL", _DEFAULT_DATABASE_URL))
    environment: str = field(default_factory=lambda: os.getenv("EUREKA_ENV", "development").strip().lower())
    jwt_secret: str = field(default_factory=lambda: os.getenv("JWT_SECRET", ""))
    jwt_issuer: str = "eureka"
    access_token_minutes: int = field(default_factory=lambda: int(os.getenv("ACCESS_TOKEN_MINUTES", "15")))
    refresh_token_days: int = field(default_factory=lambda: int(os.getenv("REFRESH_TOKEN_DAYS", "30")))
    refresh_cookie_name: str = "eureka_refresh"
    auto_migrate: bool = field(default_factory=lambda: os.getenv("AUTO_MIGRATE", "false").lower() == "true")
    cookie_secure: bool = field(default_factory=lambda: os.getenv("COOKIE_SECURE", "false").lower() == "true")
    cors_origins: list[str] = field(default_factory=lambda: _csv(
        os.getenv("CORS_ORIGINS", "http://localhost:3000")))
    google_client_id: str = field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", ""))
    rate_limit_auth_per_minute: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_AUTH_PER_MINUTE", "10")))
    # Session restore runs on every page load and carries no password, so it gets its own, higher limit.
    rate_limit_refresh_per_minute: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_REFRESH_PER_MINUTE", "120")))
    rate_limit_ai_per_minute: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_AI_PER_MINUTE", "30")))


settings = Settings()
