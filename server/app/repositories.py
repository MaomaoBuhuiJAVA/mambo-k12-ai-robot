from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Device, DeviceCommand, DeviceStatus, utc_now
from .protocol import CommandRecord


MAX_DEVICE_STATUS_HISTORY = 1_000


async def mark_all_devices_offline(session: AsyncSession) -> None:
    now = utc_now()
    await session.execute(
        update(Device)
        .where(Device.online.is_(True))
        .values(online=False, disconnected_at=now)
    )
    await session.commit()


async def get_or_create_device(session: AsyncSession, device_id: str) -> Device:
    device = await session.get(Device, device_id)
    if device is None:
        device = Device(device_id=device_id)
        session.add(device)
        await session.flush()
    return device


async def persist_device_connected(session: AsyncSession, device_id: str) -> None:
    now = utc_now()
    device = await get_or_create_device(session, device_id)
    device.online = True
    device.connected_at = now
    device.last_seen_at = now
    device.disconnected_at = None
    await session.commit()


async def persist_device_seen(
    session: AsyncSession,
    device_id: str,
    *,
    hello: dict[str, Any] | None = None,
    status: dict[str, Any] | None = None,
) -> None:
    device = await get_or_create_device(session, device_id)
    device.online = True
    device.last_seen_at = utc_now()
    if hello is not None:
        device.agent_version = str(hello.get("agent_version") or "") or None
        device.platform = str(hello.get("platform") or "") or None
        capabilities = hello.get("capabilities", [])
        device.capabilities = [str(item) for item in capabilities]
        hardware = hello.get("hardware", {})
        device.hardware = hardware if isinstance(hardware, dict) else {}
    if status is not None:
        device.latest_status = status
        session.add(DeviceStatus(device_id=device_id, payload=status))
        await session.flush()
        retained_ids = (
            select(DeviceStatus.id)
            .where(DeviceStatus.device_id == device_id)
            .order_by(DeviceStatus.id.desc())
            .limit(MAX_DEVICE_STATUS_HISTORY)
        )
        await session.execute(
            delete(DeviceStatus)
            .where(DeviceStatus.device_id == device_id)
            .where(DeviceStatus.id.not_in(retained_ids))
        )
    await session.commit()


async def persist_device_disconnected(
    session: AsyncSession, device_id: str, disconnected_at: datetime | None = None
) -> None:
    device = await session.get(Device, device_id)
    if device is None:
        return
    device.online = False
    device.disconnected_at = disconnected_at or utc_now()
    await session.commit()


async def list_devices(session: AsyncSession) -> list[Device]:
    result = await session.scalars(select(Device).order_by(Device.device_id))
    return list(result)


async def list_device_status(
    session: AsyncSession, device_id: str, limit: int
) -> list[DeviceStatus]:
    result = await session.scalars(
        select(DeviceStatus)
        .where(DeviceStatus.device_id == device_id)
        .order_by(DeviceStatus.recorded_at.desc())
        .limit(limit)
    )
    return list(result)


async def create_command(session: AsyncSession, record: CommandRecord) -> None:
    session.add(
        DeviceCommand(
            command_id=record.command_id,
            device_id=record.device_id,
            name=record.name,
            arguments=record.arguments,
            state=record.state,
            created_at=record.created_at,
            expires_at=record.expires_at,
        )
    )
    await session.commit()


async def fail_command_delivery(
    session: AsyncSession, command_id: str, error: str
) -> None:
    command = await session.get(DeviceCommand, command_id)
    if command is None:
        return
    command.state = "failed"
    command.completed_at = utc_now()
    command.result = {"ok": False, "error": error}
    await session.commit()


async def complete_command(
    session: AsyncSession, device_id: str, payload: dict[str, Any]
) -> None:
    command_id = str(payload.get("command_id", ""))
    command = await session.get(DeviceCommand, command_id)
    if command is None or command.device_id != device_id or command.state != "sent":
        return
    if command.state != "sent":
        await session.commit()
        return
    command.state = "completed" if bool(payload.get("ok", False)) else "failed"
    command.completed_at = utc_now()
    command.result = payload
    await session.commit()


async def expire_stale_commands(
    session: AsyncSession, now: datetime | None = None
) -> int:
    cutoff = now or utc_now()
    result = await session.scalars(
        select(DeviceCommand).where(
            DeviceCommand.state == "sent",
            DeviceCommand.expires_at <= cutoff,
        )
    )
    commands = list(result)
    for command in commands:
        command.state = "timed_out"
        command.completed_at = cutoff
        command.result = {
            "command_id": command.command_id,
            "ok": False,
            "error": "command_timeout",
            "source": "server",
        }
    if commands:
        await session.commit()
    return len(commands)


async def get_command(session: AsyncSession, command_id: str) -> DeviceCommand | None:
    return await session.get(DeviceCommand, command_id)


async def list_device_commands(
    session: AsyncSession, device_id: str, limit: int
) -> list[DeviceCommand]:
    result = await session.scalars(
        select(DeviceCommand)
        .where(DeviceCommand.device_id == device_id)
        .order_by(DeviceCommand.created_at.desc())
        .limit(limit)
    )
    return list(result)


def command_to_record(command: DeviceCommand) -> CommandRecord:
    return CommandRecord(
        command_id=command.command_id,
        device_id=command.device_id,
        name=command.name,
        arguments=command.arguments,
        state=command.state,
        created_at=command.created_at,
        expires_at=command.expires_at,
        completed_at=command.completed_at,
        result=command.result,
    )
