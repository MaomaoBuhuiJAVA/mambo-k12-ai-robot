import asyncio

from fastapi.testclient import TestClient

from server.app.main import app
from server.app.routes import voice as voice_routes


ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token-123456"}


class FakeAsr:
    async def transcribe(self, audio: bytes):
        return type("Result", (), {"text": "你好，Mambo", "duration_ms": len(audio)})()


class FakeTts:
    async def synthesize(self, text: str) -> bytes:
        return f"audio:{text}".encode()


def test_voice_routes_require_admin_authentication() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/voice/asr", content=b"audio")

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_admin_token"


def test_asr_returns_structured_transcript(monkeypatch) -> None:
    monkeypatch.setattr(
        voice_routes,
        "get_voice_services",
        lambda: (FakeAsr(), FakeTts()),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/voice/asr",
            headers={**ADMIN_HEADERS, "Content-Type": "audio/wav"},
            content=b"audio",
        )

    assert response.status_code == 200
    assert response.json() == {"text": "你好，Mambo", "duration_ms": 5}


def test_tts_returns_audio_media_type(monkeypatch) -> None:
    monkeypatch.setattr(
        voice_routes,
        "get_voice_services",
        lambda: (FakeAsr(), FakeTts()),
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/voice/tts",
            headers=ADMIN_HEADERS,
            json={"text": "你好"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"audio:\xe4\xbd\xa0\xe5\xa5\xbd"


def test_tts_rejects_empty_text() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/voice/tts",
            headers=ADMIN_HEADERS,
            json={"text": ""},
        )

    assert response.status_code == 422
