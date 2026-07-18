from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    device_auth_token: str
    admin_api_token: str
    heartbeat_interval_seconds: int
    device_stale_after_seconds: int
    database_url: str
    auto_create_schema: bool
    command_timeout_seconds: int
    xfun_iat_app_id: str
    xfun_iat_api_key: str
    xfun_iat_api_secret: str
    xfun_tts_app_id: str
    xfun_tts_api_key: str
    xfun_tts_api_secret: str
    xfun_tts_voice: str
    xfun_tts_audio_format: str

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
            database_url=os.getenv(
                "DATABASE_URL", "sqlite+aiosqlite:///./data/mambo.db"
            ),
            auto_create_schema=os.getenv("AUTO_CREATE_SCHEMA", "false").lower()
            in {"1", "true", "yes", "on"},
            command_timeout_seconds=max(
                1, int(os.getenv("COMMAND_TIMEOUT_SECONDS", "30"))
            ),
            xfun_iat_app_id=os.getenv("XFUN_IAT_APP_ID", "").strip(),
            xfun_iat_api_key=os.getenv("XFUN_IAT_API_KEY", "").strip(),
            xfun_iat_api_secret=os.getenv("XFUN_IAT_API_SECRET", "").strip(),
            xfun_tts_app_id=os.getenv("XFUN_TTS_APP_ID", "").strip(),
            xfun_tts_api_key=os.getenv("XFUN_TTS_API_KEY", "").strip(),
            xfun_tts_api_secret=os.getenv("XFUN_TTS_API_SECRET", "").strip(),
            xfun_tts_voice=os.getenv("XFUN_TTS_VOICE", "xiaoyan").strip() or "xiaoyan",
            xfun_tts_audio_format=os.getenv("XFUN_TTS_AUDIO_FORMAT", "mp3").strip().lower() or "mp3",
        )


settings = Settings.from_env()
