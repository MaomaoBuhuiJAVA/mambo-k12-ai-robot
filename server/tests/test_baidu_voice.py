import asyncio
import json

import pytest

from server.app.config import Settings
from server.app.voice.baidu_asr import BaiduAsr, BaiduAsrConfig
from server.app.voice.baidu_token import BaiduTokenProvider
from server.app.voice.baidu_tts import BaiduTts, BaiduTtsConfig, BaiduVoiceError


class FakeResponse:
    def __init__(self, payload=None, *, content=b"", content_type="application/json"):
        self.payload = payload
        self.content = content
        self.headers = {"content-type": content_type}

    def json(self):
        return self.payload

    def raise_for_status(self):
        return None


def test_baidu_token_provider_caches_until_expiration() -> None:
    calls = []

    async def requester(*_args, **_kwargs):
        calls.append(True)
        return FakeResponse({"access_token": "token-1", "expires_in": 3600})

    provider = BaiduTokenProvider(
        app_id="app",
        api_key="key",
        secret_key="secret",
        requester=requester,
    )

    first = asyncio.run(provider.get_token())
    second = asyncio.run(provider.get_token())

    assert first == "token-1"
    assert second == "token-1"
    assert len(calls) == 1


def test_settings_reads_baidu_speech_credentials(monkeypatch) -> None:
    monkeypatch.setenv("BAIDU_APP_ID", "app")
    monkeypatch.setenv("BAIDU_API_KEY", "key")
    monkeypatch.setenv("BAIDU_SECRET_KEY", "secret")
    monkeypatch.setenv("BAIDU_ASR_DEV_PID", "1537")
    monkeypatch.setenv("BAIDU_TTS_PER", "110")

    settings = Settings.from_env()

    assert settings.baidu_app_id == "app"
    assert settings.baidu_api_key == "key"
    assert settings.baidu_secret_key == "secret"
    assert settings.baidu_asr_dev_pid == 1537
    assert settings.baidu_tts_per == 110


def test_baidu_asr_posts_wav_and_parses_result() -> None:
    requests = []

    async def requester(*args, **kwargs):
        requests.append((args, kwargs))
        if len(requests) == 1:
            return FakeResponse({"access_token": "token-1", "expires_in": 3600})
        return FakeResponse({"err_no": 0, "result": ["你好，Mambo"]})

    token = BaiduTokenProvider(
        app_id="app", api_key="key", secret_key="secret", requester=requester
    )
    adapter = BaiduAsr(
        BaiduAsrConfig(app_id="app", dev_pid=1537, cuid="robot"),
        token_provider=token,
        requester=requester,
    )

    result = asyncio.run(adapter.transcribe(b"wav-data"))

    assert result.text == "你好，Mambo"
    method, url = requests[-1][0]
    kwargs = requests[-1][1]
    assert method == "POST"
    assert url == "https://vop.baidu.com/server_api"
    assert kwargs["content"] == b"wav-data"
    assert kwargs["params"]["token"] == "token-1"
    assert kwargs["params"]["dev_pid"] == 1537


def test_baidu_tts_returns_mp3_and_maps_json_error() -> None:
    calls = []

    async def requester(*args, **kwargs):
        calls.append((args, kwargs))
        if len(calls) == 1:
            return FakeResponse({"access_token": "token-1", "expires_in": 3600})
        return FakeResponse(content=b"mp3", content_type="audio/mp3")

    token = BaiduTokenProvider(
        app_id="app", api_key="key", secret_key="secret", requester=requester
    )
    adapter = BaiduTts(
        BaiduTtsConfig(cuid="robot", per=110),
        token_provider=token,
        requester=requester,
    )

    assert asyncio.run(adapter.synthesize("你好")) == b"mp3"
    tts_kwargs = calls[-1][1]
    assert tts_kwargs["data"]["tok"] == "token-1"
    assert tts_kwargs["data"]["per"] == 110

    async def error_requester(*_args, **_kwargs):
        return FakeResponse({"err_no": 500, "err_msg": "invalid token"})

    error_adapter = BaiduTts(
        BaiduTtsConfig(cuid="robot"),
        token_provider=token,
        requester=error_requester,
    )
    with pytest.raises(BaiduVoiceError) as caught:
        asyncio.run(error_adapter.synthesize("你好"))
    assert caught.value.code == "provider_error"
