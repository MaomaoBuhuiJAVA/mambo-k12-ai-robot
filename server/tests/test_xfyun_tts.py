import asyncio
import base64
import json

import pytest

from server.app.voice import xfyun_tts
from server.app.voice.xfyun_tts import XfyunTts, XfyunTtsConfig, XfyunVoiceError


class FakeSocket:
    def __init__(self, messages):
        self.messages = messages
        self.sent = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def send(self, message):
        self.sent.append(json.loads(message))

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.messages:
            raise StopAsyncIteration
        return self.messages.pop(0)


class FakeWebsockets:
    def __init__(self, socket):
        self.socket = socket

    def connect(self, *_args, **_kwargs):
        return self.socket


def test_xfyun_tts_uses_x4_yezi_and_returns_mp3_bytes(monkeypatch):
    audio = base64.b64encode(b"mp3").decode()
    socket = FakeSocket([json.dumps({"code": 0, "data": {"audio": audio, "status": 2}})])
    monkeypatch.setattr(xfyun_tts, "websockets", FakeWebsockets(socket))
    adapter = XfyunTts(XfyunTtsConfig(app_id="app", api_key="key", api_secret="secret"))

    result = asyncio.run(adapter.synthesize("你好"))

    assert result == b"mp3"
    assert socket.sent[0]["business"]["vcn"] == "x4_yezi"
    assert socket.sent[0]["business"]["aue"] == "lame"
    assert socket.sent[0]["data"]["status"] == 2


def test_xfyun_tts_rejects_missing_credentials():
    with pytest.raises(XfyunVoiceError) as caught:
        asyncio.run(XfyunTts(XfyunTtsConfig()).synthesize("你好"))
    assert caught.value.code == "not_configured"
