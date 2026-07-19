from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .baidu_errors import BaiduVoiceError
from .baidu_token import BaiduTokenProvider, Requester, _default_requester


@dataclass(frozen=True)
class BaiduTtsConfig:
    cuid: str = "mambo-robot"
    per: int = 110
    spd: int = 5
    pit: int = 5
    vol: int = 5
    aue: int = 3
    max_text_bytes: int = 1024


class BaiduTts:
    def __init__(
        self,
        config: BaiduTtsConfig,
        *,
        token_provider: BaiduTokenProvider,
        requester: Requester = _default_requester,
    ) -> None:
        self.config = config
        self.token_provider = token_provider
        self.requester = requester

    async def synthesize(self, text: str) -> bytes:
        encoded = text.strip().encode("utf-8")
        if not encoded or len(encoded) > self.config.max_text_bytes:
            raise BaiduVoiceError("invalid_text")
        token = await self.token_provider.get_token()
        try:
            response = await self.requester(
                "POST",
                "https://tsn.baidu.com/text2audio",
                data={
                    "tex": text.strip(),
                    "tok": token,
                    "cuid": self.config.cuid[:60],
                    "ctp": 1,
                    "lan": "zh",
                    "spd": self.config.spd,
                    "pit": self.config.pit,
                    "vol": self.config.vol,
                    "per": self.config.per,
                    "aue": self.config.aue,
                },
                headers={"Accept": "audio/mpeg, audio/wav, application/json"},
                timeout=30.0,
            )
            response.raise_for_status()
        except BaiduVoiceError:
            raise
        except Exception as exc:
            raise BaiduVoiceError("tts_request_failed") from exc

        content_type = response.headers.get("content-type", "").lower()
        if "json" in content_type or response.content.lstrip().startswith(b"{"):
            raise BaiduVoiceError("provider_error")
        if not content_type.startswith("audio/") or not response.content:
            raise BaiduVoiceError("invalid_audio_response")
        return bytes(response.content)


__all__ = ["BaiduTts", "BaiduTtsConfig", "BaiduVoiceError"]
