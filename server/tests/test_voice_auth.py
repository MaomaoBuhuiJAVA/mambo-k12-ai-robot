from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

from server.app.config import Settings
from server.app.voice.xfyun_auth import build_signed_url, credentials_configured


def test_build_signed_url_is_reproducible_for_fixed_request() -> None:
    now = datetime(2026, 7, 18, 2, 0, 0, tzinfo=timezone.utc)

    first = build_signed_url(
        "wss://iat-api.xfyun.cn/v2/iat",
        api_key="api-key",
        api_secret="api-secret",
        now=now,
    )
    second = build_signed_url(
        "wss://iat-api.xfyun.cn/v2/iat",
        api_key="api-key",
        api_secret="api-secret",
        now=now,
    )

    assert first == second
    query = parse_qs(urlparse(first).query)
    assert query["host"] == ["iat-api.xfyun.cn"]
    assert query["date"] == ["Sat, 18 Jul 2026 02:00:00 GMT"]
    assert query["authorization"][0].startswith("YXBpX2tleT0i")


def test_credentials_configured_requires_all_values() -> None:
    assert credentials_configured("app", "key", "secret") is True
    assert credentials_configured("app", "", "secret") is False
    assert credentials_configured("", "key", "secret") is False
    assert credentials_configured("app", "key", "") is False


def test_settings_reads_server_side_voice_credentials(monkeypatch) -> None:
    monkeypatch.setenv("XFUN_IAT_APP_ID", "iat-app")
    monkeypatch.setenv("XFUN_IAT_API_KEY", "iat-key")
    monkeypatch.setenv("XFUN_IAT_API_SECRET", "iat-secret")
    monkeypatch.setenv("XFUN_TTS_APP_ID", "tts-app")
    monkeypatch.setenv("XFUN_TTS_API_KEY", "tts-key")
    monkeypatch.setenv("XFUN_TTS_API_SECRET", "tts-secret")
    monkeypatch.setenv("XFUN_TTS_VOICE", "xiaoyan")

    settings = Settings.from_env()

    assert settings.xfun_iat_app_id == "iat-app"
    assert settings.xfun_iat_api_key == "iat-key"
    assert settings.xfun_iat_api_secret == "iat-secret"
    assert settings.xfun_tts_app_id == "tts-app"
    assert settings.xfun_tts_api_key == "tts-key"
    assert settings.xfun_tts_api_secret == "tts-secret"
    assert settings.xfun_tts_voice == "xiaoyan"
