import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _unique_values(*values: str) -> tuple[str, ...]:
    seen: dict[str, None] = {}
    for value in values:
        if value and value not in seen:
            seen[value] = None
    return tuple(seen.keys())


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"{name} must be set and cannot be empty")
    return value


def _positive_int_env(name: str, default: str) -> int:
    value = int(os.getenv(name, default))
    if value <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return value


def _jwt_algorithm() -> str:
    algorithm = os.getenv("JWT_ALGORITHM", "HS256").strip()
    if algorithm != "HS256":
        raise ValueError("JWT_ALGORITHM must be HS256")
    return algorithm


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "event-manager-api")
    mysql_host: str = os.getenv("MYSQL_HOST", "localhost")
    mysql_port: int = int(os.getenv("MYSQL_PORT", "3306"))
    mysql_database: str = os.getenv("MYSQL_DATABASE", "event_manager")
    mysql_user: str = os.getenv("MYSQL_USER", "event_user")
    mysql_password: str = os.getenv("MYSQL_PASSWORD", "")
    mysql_ssl: bool = os.getenv("MYSQL_SSL", "").strip().lower() in ("1", "true", "yes")
    mysql_ssl_ca: str = os.getenv("MYSQL_SSL_CA", "").strip()
    jwt_secret_key: str = _required_env("JWT_SECRET_KEY")
    jwt_algorithm: str = _jwt_algorithm()
    jwt_access_token_expire_minutes: int = _positive_int_env(
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"
    )
    frontend_url: str = os.getenv("FRONTEND_URL", "").strip()
    cors_origins: tuple[str, ...] = tuple(
        _unique_values(
            *_split_csv(
                os.getenv(
                    "CORS_ORIGINS",
                    ",".join(
                        value
                        for value in (
                            os.getenv("FRONTEND_URL", "").strip(),
                            "http://localhost:3000",
                            "http://localhost:5173",
                            "http://127.0.0.1:5173",
                        )
                        if value
                    ),
                )
            )
        )
    )
    ai_mode: str = os.getenv("AI_MODE", "mock").strip().lower()
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model: str = os.getenv("OPENAI_MODEL", "").strip()
    seed_demo: bool = os.getenv("SEED_DEMO", "").strip().lower() in ("1", "true", "yes")
    demo_password: str = os.getenv("DEMO_PASSWORD", "").strip()
    demo_admin_password: str = os.getenv("DEMO_ADMIN_PASSWORD", "").strip()
    demo_organizer_password: str = os.getenv("DEMO_ORGANIZER_PASSWORD", "").strip()
    demo_staff_password: str = os.getenv("DEMO_STAFF_PASSWORD", "").strip()
    demo_attendee_password: str = os.getenv("DEMO_ATTENDEE_PASSWORD", "").strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
