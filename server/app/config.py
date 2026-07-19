from __future__ import annotations

import os
from dataclasses import dataclass


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return f"postgresql+asyncpg://{database_url.removeprefix('postgresql://')}"
    return database_url


@dataclass(frozen=True)
class Settings:
    device_auth_token: str
    admin_api_token: str
    heartbeat_interval_seconds: int
    device_stale_after_seconds: int
    database_url: str
    auto_create_schema: bool
    command_timeout_seconds: int
    baidu_app_id: str
    baidu_api_key: str
    baidu_secret_key: str
    baidu_asr_dev_pid: int
    baidu_tts_per: int

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            device_auth_token=os.getenv("DEVICE_AUTH_TOKEN", "dev-device-token-change-me"),
            admin_api_token=os.getenv("ADMIN_API_TOKEN", "dev-admin-token-change-me"),
            heartbeat_interval_seconds=max(
                2, int(os.getenv("HEARTBEAT_INTERVAL_SECONDS", "5"))
            ),
            device_stale_after_seconds=max(
                10, int(os.getenv("DEVICE_STALE_AFTER_SECONDS", "20"))
            ),
            database_url=_normalize_database_url(
                os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/mambo.db")
            ),
            auto_create_schema=os.getenv("AUTO_CREATE_SCHEMA", "false").lower()
            in {"1", "true", "yes", "on"},
            command_timeout_seconds=max(
                1, int(os.getenv("COMMAND_TIMEOUT_SECONDS", "30"))
            ),
            baidu_app_id=os.getenv("BAIDU_APP_ID", "").strip(),
            baidu_api_key=os.getenv("BAIDU_API_KEY", "").strip(),
            baidu_secret_key=os.getenv("BAIDU_SECRET_KEY", "").strip(),
            baidu_asr_dev_pid=max(1, int(os.getenv("BAIDU_ASR_DEV_PID", "1537"))),
            baidu_tts_per=max(0, int(os.getenv("BAIDU_TTS_PER", "110"))),
        )


settings = Settings.from_env()
