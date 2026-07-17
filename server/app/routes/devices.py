from __future__ import annotations

import asyncio
import hmac
import re
from typing import Any
from uuid import uuid4

from anyio import CancelScope
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import bearer_token, require_admin
from ..config import settings
from ..database import get_session, session_factory
from ..manager import manager
from ..models import Device
from ..protocol import (
    CommandRecord,
    CommandRequest,
    DeviceMessage,
    RecentMessageIds,
    ServerMessage,
    utc_now,
)
from ..repositories import (
    command_to_record,
    complete_command,
    create_command,
    fail_command_delivery,
    get_command,
    list_device_commands,
    list_device_status,
    list_devices,
    persist_device_connected,
    persist_device_disconnected,
    persist_device_seen,
)
from ..schemas import DeviceRead, DeviceStatusRead


DEVICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,64}$")

router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(require_admin)],
    tags=["devices"],
)
websocket_router = APIRouter()


async def receive_json_with_timeout(
    websocket: WebSocket, *, timeout_seconds: float
) -> Any:
    return await asyncio.wait_for(websocket.receive_json(), timeout=timeout_seconds)


@router.get("/devices")
async def get_devices(session: AsyncSession = Depends(get_session)) -> dict[str, object]:
    devices = [DeviceRead.model_validate(item) for item in await list_devices(session)]
    return {"items": devices, "count": len(devices)}


@router.get("/devices/{device_id}", response_model=DeviceRead)
async def get_device(
    device_id: str, session: AsyncSession = Depends(get_session)
) -> DeviceRead:
    device = await session.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="device_not_found")
    return DeviceRead.model_validate(device)


@router.get("/devices/{device_id}/status-history", response_model=list[DeviceStatusRead])
async def get_status_history(
    device_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
) -> list[DeviceStatusRead]:
    return [
        DeviceStatusRead.model_validate(item)
        for item in await list_device_status(session, device_id, limit)
    ]


@router.post("/devices/{device_id}/commands", response_model=CommandRecord)
async def issue_command(
    device_id: str,
    request: CommandRequest,
    session: AsyncSession = Depends(get_session),
) -> CommandRecord:
    if await manager.get_device(device_id) is None:
        raise HTTPException(status_code=409, detail="device_not_online")
    record = CommandRecord(
        command_id=str(uuid4()),
        device_id=device_id,
        name=request.name,
        arguments=request.arguments,
        state="sent",
        created_at=utc_now(),
    )
    await create_command(session, record)
    try:
        await manager.issue_command(record)
    except KeyError as exc:
        await fail_command_delivery(session, record.command_id, "device_not_online")
        raise HTTPException(status_code=409, detail="device_not_online") from exc
    except Exception:
        await fail_command_delivery(session, record.command_id, "delivery_failed")
        raise
    return record


@router.get(
    "/devices/{device_id}/commands", response_model=list[CommandRecord]
)
async def read_device_commands(
    device_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
) -> list[CommandRecord]:
    if await session.get(Device, device_id) is None:
        raise HTTPException(status_code=404, detail="device_not_found")
    return [
        command_to_record(item)
        for item in await list_device_commands(session, device_id, limit)
    ]


@router.get("/commands/{command_id}", response_model=CommandRecord)
async def read_command(
    command_id: str, session: AsyncSession = Depends(get_session)
) -> CommandRecord:
    command = await get_command(session, command_id)
    if command is None:
        raise HTTPException(status_code=404, detail="command_not_found")
    return command_to_record(command)


@websocket_router.websocket("/ws/v1/devices/{device_id}")
async def device_socket(websocket: WebSocket, device_id: str) -> None:
    if not DEVICE_ID_PATTERN.fullmatch(device_id):
        await websocket.close(code=4000, reason="invalid_device_id")
        return
    token = bearer_token(websocket.headers.get("authorization"))
    if not hmac.compare_digest(token, settings.device_auth_token):
        await websocket.close(code=4001, reason="invalid_device_token")
        return

    await manager.connect(device_id, websocket)
    async with session_factory() as session:
        await persist_device_connected(session, device_id)
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

    recent_message_ids = RecentMessageIds()
    try:
        while True:
            try:
                raw = await receive_json_with_timeout(
                    websocket,
                    timeout_seconds=settings.device_stale_after_seconds,
                )
            except asyncio.TimeoutError:
                await websocket.close(code=4008, reason="device_inactive")
                return
            try:
                message = DeviceMessage.model_validate(raw)
            except ValidationError:
                await websocket.close(code=4002, reason="invalid_message")
                return
            if message.device_id != device_id:
                await websocket.close(code=4003, reason="device_id_mismatch")
                return

            is_duplicate = recent_message_ids.remember(message.message_id)
            if is_duplicate and message.type != "heartbeat":
                await manager.update_seen(device_id)
                async with session_factory() as session:
                    await persist_device_seen(session, device_id)
                continue

            async with session_factory() as session:
                if message.type == "hello":
                    await manager.update_seen(device_id, hello=message.payload)
                    await persist_device_seen(session, device_id, hello=message.payload)
                elif message.type == "heartbeat":
                    await manager.update_seen(device_id)
                    await persist_device_seen(session, device_id)
                    await manager.send(
                        device_id,
                        ServerMessage(
                            type="heartbeat_ack",
                            payload={"reply_to": message.message_id},
                        ),
                    )
                elif message.type == "status":
                    await manager.update_seen(device_id, status=message.payload)
                    await persist_device_seen(session, device_id, status=message.payload)
                elif message.type == "command_result":
                    await manager.update_seen(device_id)
                    await persist_device_seen(session, device_id)
                    await complete_command(session, device_id, message.payload)
    except WebSocketDisconnect:
        pass
    finally:
        with CancelScope(shield=True):
            removed = await manager.disconnect(device_id, websocket)
            if removed:
                async with session_factory() as session:
                    await persist_device_disconnected(session, device_id)
