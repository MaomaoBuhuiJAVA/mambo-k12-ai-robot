from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    device_auth_token: str
    admin_api_token: str
    heartbeat_interval_seconds: int
    device_stale_after_seconds: int

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
        )


settings = Settings.from_env()

