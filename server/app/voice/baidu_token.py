from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any

import httpx

from .baidu_errors import BaiduVoiceError


Requester = Callable[..., Awaitable[Any]]


async def _default_requester(method: str, url: str, **kwargs: Any) -> Any:
    timeout = kwargs.pop("timeout", 10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.request(method, url, **kwargs)


class BaiduTokenProvider:
    def __init__(
        self,
        *,
        app_id: str,
        api_key: str,
        secret_key: str,
        requester: Requester = _default_requester,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.app_id = app_id.strip()
        self.api_key = api_key.strip()
        self.secret_key = secret_key.strip()
        self.requester = requester
        self.clock = clock
        self._access_token = ""
        self._expires_at = 0.0

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.secret_key)

    async def get_token(self) -> str:
        now = self.clock()
        if self._access_token and now < self._expires_at:
            return self._access_token
        if not self.configured:
            raise BaiduVoiceError("not_configured")
        try:
            response = await self.requester(
                "POST",
                "https://aip.baidubce.com/oauth/2.0/token",
                params={
                    "grant_type": "client_credentials",
                    "client_id": self.api_key,
                    "client_secret": self.secret_key,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            payload = response.json()
        except BaiduVoiceError:
            raise
        except Exception as exc:
            raise BaiduVoiceError("token_request_failed") from exc

        token = payload.get("access_token") if isinstance(payload, dict) else None
        expires_in = payload.get("expires_in") if isinstance(payload, dict) else None
        if not isinstance(token, str) or not token.strip() or not isinstance(expires_in, (int, float)):
            raise BaiduVoiceError("token_failed")
        self._access_token = token.strip()
        self._expires_at = now + max(30.0, float(expires_in) - 60.0)
        return self._access_token
