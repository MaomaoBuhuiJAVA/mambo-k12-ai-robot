from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import Header, HTTPException

from .config import settings


def bearer_token(value: str | None) -> str:
    if not value or not value.startswith("Bearer "):
        return ""
    return value[7:]


async def require_admin(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    if not hmac.compare_digest(bearer_token(authorization), settings.admin_api_token):
        raise HTTPException(status_code=401, detail="invalid_admin_token")
