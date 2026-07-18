from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Any

from .baidu_errors import BaiduVoiceError
from .baidu_token import BaiduTokenProvider, Requester, _default_requester


@dataclass(frozen=True)
class BaiduAsrConfig:
    app_id: str = ""
    dev_pid: int = 1537
    cuid: str = "mambo-robot"
    timeout_seconds: float = 30.0
    max_audio_bytes: int = 1_920_000


@dataclass(frozen=True)
class AsrResult:
    text: str
    duration_ms: int


class BaiduAsr:
    def __init__(
        self,
        config: BaiduAsrConfig,
        *,
        token_provider: BaiduTokenProvider,
        requester: Requester = _default_requester,
    ) -> None:
        self.config = config
        self.token_provider = token_provider
        self.requester = requester

    async def transcribe(self, audio: bytes) -> AsrResult:
        if not audio or len(audio) > self.config.max_audio_bytes:
            raise BaiduVoiceError("invalid_audio")
        started = monotonic()
        token = await self.token_provider.get_token()
        try:
            response = await self.requester(
                "POST",
                "https://vop.baidu.com/server_api",
                params={
                    "cuid": self.config.cuid[:60],
                    "token": token,
                    "dev_pid": self.config.dev_pid,
                },
                headers={
                    "Accept": "application/json",
                    "Content-Type": "audio/wav;rate=16000",
                },
                content=audio,
                timeout=self.config.timeout_seconds,
            )
            response.raise_for_status()
            payload: Any = response.json()
        except BaiduVoiceError:
            raise
        except Exception as exc:
            raise BaiduVoiceError("asr_request_failed") from exc

        if not isinstance(payload, dict) or int(payload.get("err_no", -1)) != 0:
            raise BaiduVoiceError("provider_error")
        results = payload.get("result")
        text = results[0].strip() if isinstance(results, list) and results and isinstance(results[0], str) else ""
        if not text:
            raise BaiduVoiceError("empty_result")
        return AsrResult(text=text[:4000], duration_ms=max(0, round((monotonic() - started) * 1000)))
