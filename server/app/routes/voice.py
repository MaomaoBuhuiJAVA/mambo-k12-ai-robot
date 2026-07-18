from __future__ import annotations

from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from ..auth import require_admin
from ..config import settings
from ..voice.baidu_asr import BaiduAsr, BaiduAsrConfig
from ..voice.baidu_errors import BaiduVoiceError
from ..voice.baidu_token import BaiduTokenProvider
from ..voice.baidu_tts import BaiduTts, BaiduTtsConfig


MAX_AUDIO_BYTES = 1_920_000
MAX_TEXT_BYTES = 1_024
router = APIRouter(
    prefix="/api/v1/voice",
    dependencies=[Depends(require_admin)],
    tags=["voice"],
)


@dataclass(frozen=True)
class VoiceServices:
    asr: BaiduAsr
    tts: BaiduTts


_services: VoiceServices | None = None


def get_voice_services() -> tuple[BaiduAsr, BaiduTts]:
    global _services
    if _services is None:
        token_provider = BaiduTokenProvider(
            app_id=settings.baidu_app_id,
            api_key=settings.baidu_api_key,
            secret_key=settings.baidu_secret_key,
        )
        _services = VoiceServices(
            asr=BaiduAsr(
                BaiduAsrConfig(
                    app_id=settings.baidu_app_id,
                    dev_pid=settings.baidu_asr_dev_pid,
                    cuid="mambo-robot",
                ),
                token_provider=token_provider,
            ),
            tts=BaiduTts(
                BaiduTtsConfig(cuid="mambo-robot", per=settings.baidu_tts_per),
                token_provider=token_provider,
            ),
        )
    return _services.asr, _services.tts


def _voice_error(error: BaiduVoiceError) -> JSONResponse:
    status = {
        "not_configured": 503,
        "invalid_audio": 400,
        "invalid_text": 422,
        "empty_result": 502,
        "provider_error": 502,
        "token_failed": 502,
        "token_request_failed": 502,
        "asr_request_failed": 502,
        "tts_request_failed": 502,
        "invalid_audio_response": 502,
    }.get(error.code, 502)
    return JSONResponse(
        {"error": f"BAIDU_VOICE_{error.code.upper()}"},
        status_code=status,
        headers={"Cache-Control": "no-store"},
    )


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_BYTES)


@router.post("/asr")
async def transcribe(request: Request) -> Response:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in {"audio/wav", "audio/x-wav", "audio/pcm"}:
        raise HTTPException(status_code=415, detail="unsupported_audio_type")
    declared_length = request.headers.get("content-length")
    if declared_length and declared_length.isdigit() and int(declared_length) > MAX_AUDIO_BYTES:
        return _voice_error(BaiduVoiceError("invalid_audio"))
    audio = await request.body()
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        return _voice_error(BaiduVoiceError("invalid_audio"))
    asr, _ = get_voice_services()
    try:
        result = await asr.transcribe(audio)
    except BaiduVoiceError as error:
        return _voice_error(error)
    return JSONResponse(
        {"text": result.text, "duration_ms": result.duration_ms},
        headers={"Cache-Control": "no-store"},
    )


@router.post("/tts")
async def synthesize(request: TtsRequest) -> Response:
    _, tts = get_voice_services()
    try:
        audio = await tts.synthesize(request.text)
    except BaiduVoiceError as error:
        return _voice_error(error)
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )
