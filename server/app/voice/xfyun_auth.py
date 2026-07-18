from __future__ import annotations

import base64
import hashlib
import hmac
from datetime import datetime, timezone
from email.utils import format_datetime
from urllib.parse import urlencode, urlparse


def credentials_configured(app_id: str, api_key: str, api_secret: str) -> bool:
    return bool(app_id.strip() and api_key.strip() and api_secret.strip())


def build_signed_url(
    endpoint: str,
    *,
    api_key: str,
    api_secret: str,
    now: datetime | None = None,
) -> str:
    parsed = urlparse(endpoint)
    if parsed.scheme not in {"ws", "wss"} or not parsed.netloc or not parsed.path:
        raise ValueError("voice endpoint must be a websocket URL")
    if not api_key.strip() or not api_secret.strip():
        raise ValueError("voice credentials are not configured")

    timestamp = now or datetime.now(timezone.utc)
    date = format_datetime(timestamp.astimezone(timezone.utc), usegmt=True)
    request_line = f"GET {parsed.path} HTTP/1.1"
    signature_origin = f"host: {parsed.netloc}\ndate: {date}\n{request_line}"
    signature = base64.b64encode(
        hmac.new(
            api_secret.encode("utf-8"),
            signature_origin.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("ascii")
    authorization_origin = (
        f'api_key="{api_key}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature}"'
    )
    authorization = base64.b64encode(
        authorization_origin.encode("utf-8")
    ).decode("ascii")
    query = urlencode(
        {"host": parsed.netloc, "date": date, "authorization": authorization}
    )
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{query}"
