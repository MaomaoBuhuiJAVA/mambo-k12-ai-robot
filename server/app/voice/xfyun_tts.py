from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from email.utils import formatdate
from time import time
from urllib.parse import urlencode

try:
    import websockets
except ModuleNotFoundError:  # Optional until the Core dependency set is installed.
    websockets = None  # type: ignore[assignment]


class XfyunVoiceError(RuntimeError):
    def __init__(self, code: str, message: str = "xfyun voice provider error") -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class XfyunTtsConfig:
    app_id: str = ""
    api_key: str = ""
    api_secret: str = ""
    voice_name: str = "x4_yezi"
    endpoint: str = "wss://tts-api.xfyun.cn/v2/tts"
    max_text_bytes: int = 1_024
    timeout_seconds: float = 30.0


def _authorization(config: XfyunTtsConfig, date: str) -> str:
    request_line = "GET /v2/tts HTTP/1.1"
    signature_origin = f"host: tts-api.xfyun.cn\ndate: {date}\n{request_line}"
    signature = base64.b64encode(
        hmac.new(config.api_secret.encode(), signature_origin.encode(), hashlib.sha256).digest()
    ).decode()
    value = (
        f'api_key="{config.api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    return base64.b64encode(value.encode()).decode()


class XfyunTts:
    def __init__(self, config: XfyunTtsConfig) -> None:
        self.config = config

    def _uri(self) -> str:
        date = formatdate(time(), usegmt=True)
        authorization = _authorization(self.config, date)
        return f"{self.config.endpoint}?{urlencode({'authorization': authorization, 'date': date, 'host': 'tts-api.xfyun.cn'})}"

    async def synthesize(self, text: str) -> bytes:
        value = text.strip()
        if not value or len(value.encode("utf-8")) > self.config.max_text_bytes:
            raise XfyunVoiceError("invalid_text")
        if not self.config.app_id or not self.config.api_key or not self.config.api_secret:
            raise XfyunVoiceError("not_configured")
        if websockets is None:
            raise XfyunVoiceError("provider_unavailable")

        payload = {
            "common": {"app_id": self.config.app_id},
            "business": {"aue": "lame", "auf": "audio/L16;rate=16000", "vcn": self.config.voice_name, "tte": "UTF8"},
            "data": {"status": 2, "text": base64.b64encode(value.encode("utf-8")).decode(), "encoding": "raw"},
        }
        audio = bytearray()
        try:
            async with asyncio.timeout(self.config.timeout_seconds):
                async with websockets.connect(self._uri(), max_size=4 * 1024 * 1024) as socket:
                    await socket.send(json.dumps(payload, ensure_ascii=False))
                    async for message in socket:
                        if not isinstance(message, str):
                            continue
                        try:
                            result = json.loads(message)
                        except json.JSONDecodeError as exc:
                            raise XfyunVoiceError("provider_error") from exc
                        if int(result.get("code", -1)) != 0:
                            raise XfyunVoiceError("provider_error")
                        data = result.get("data") or {}
                        chunk = data.get("audio")
                        if isinstance(chunk, str):
                            audio.extend(base64.b64decode(chunk))
                        if int(data.get("status", 1)) == 2:
                            break
        except XfyunVoiceError:
            raise
        except TimeoutError as exc:
            raise XfyunVoiceError("timeout") from exc
        except Exception as exc:
            raise XfyunVoiceError("request_failed") from exc
        if not audio:
            raise XfyunVoiceError("empty_result")
        return bytes(audio)


__all__ = ["XfyunTts", "XfyunTtsConfig", "XfyunVoiceError"]
