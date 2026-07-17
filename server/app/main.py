from __future__ import annotations

import hmac
import re
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from .config import settings
from .manager import manager
from .protocol import CommandRecord, CommandRequest, DeviceMessage, ServerMessage


DEVICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,64}$")

app = FastAPI(title="Mambo Device Gateway", version="0.1.0")


def _bearer_token(value: str | None) -> str:
    if not value or not value.startswith("Bearer "):
        return ""
    return value[7:]


async def require_admin(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    token = _bearer_token(authorization)
    if not hmac.compare_digest(token, settings.admin_api_token):
        raise HTTPException(status_code=401, detail="invalid_admin_token")


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "mambo-device-gateway"}


@app.get("/api/v1/devices", dependencies=[Depends(require_admin)])
async def list_devices() -> dict[str, object]:
    devices = await manager.list_devices()
    return {"items": devices, "count": len(devices)}


@app.get("/api/v1/devices/{device_id}", dependencies=[Depends(require_admin)])
async def get_device(device_id: str) -> dict[str, object]:
    device = await manager.get_device(device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="device_not_online")
    return device


@app.post(
    "/api/v1/devices/{device_id}/commands",
    response_model=CommandRecord,
    dependencies=[Depends(require_admin)],
)
async def issue_command(device_id: str, request: CommandRequest) -> CommandRecord:
    try:
        return await manager.issue_command(device_id, request.name, request.arguments)
    except KeyError as exc:
        raise HTTPException(status_code=409, detail="device_not_online") from exc


@app.get(
    "/api/v1/commands/{command_id}",
    response_model=CommandRecord,
    dependencies=[Depends(require_admin)],
)
async def get_command(command_id: str) -> CommandRecord:
    record = await manager.get_command(command_id)
    if record is None:
        raise HTTPException(status_code=404, detail="command_not_found")
    return record


@app.websocket("/ws/v1/devices/{device_id}")
async def device_socket(websocket: WebSocket, device_id: str) -> None:
    if not DEVICE_ID_PATTERN.fullmatch(device_id):
        await websocket.close(code=4000, reason="invalid_device_id")
        return

    token = _bearer_token(websocket.headers.get("authorization"))
    if not hmac.compare_digest(token, settings.device_auth_token):
        await websocket.close(code=4001, reason="invalid_device_token")
        return

    await manager.connect(device_id, websocket)
    await manager.send(
        device_id,
        ServerMessage(
            type="welcome",
            payload={
                "device_id": device_id,
                "heartbeat_interval_seconds": settings.heartbeat_interval_seconds,
                "device_stale_after_seconds": settings.device_stale_after_seconds,
            },
        ),
    )

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                message = DeviceMessage.model_validate(raw)
            except ValidationError:
                await websocket.close(code=4002, reason="invalid_message")
                return
            if message.device_id != device_id:
                await websocket.close(code=4003, reason="device_id_mismatch")
                return

            if message.type == "hello":
                await manager.update_seen(device_id, hello=message.payload)
            elif message.type == "heartbeat":
                await manager.update_seen(device_id)
                await manager.send(
                    device_id,
                    ServerMessage(
                        type="heartbeat_ack",
                        payload={"reply_to": message.message_id},
                    ),
                )
            elif message.type == "status":
                await manager.update_seen(device_id, status=message.payload)
            elif message.type == "command_result":
                await manager.update_seen(device_id)
                await manager.complete_command(device_id, message.payload)
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(device_id, websocket)

