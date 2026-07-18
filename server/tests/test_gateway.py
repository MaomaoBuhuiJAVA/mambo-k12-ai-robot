import asyncio
import time
from datetime import timedelta

from fastapi.testclient import TestClient

from server.app.database import session_factory
from server.app.main import app
from server.app.models import Device, DeviceCommand, utc_now
from server.app.repositories import complete_command, expire_stale_commands


DEVICE_HEADERS = {"Authorization": "Bearer test-device-token-123456"}
ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token-123456"}


def envelope(
    message_type: str, payload: dict, device_id: str = "test-device-01"
) -> dict:
    return {
        "version": 1,
        "message_id": f"message-{message_type}-123456",
        "type": message_type,
        "device_id": device_id,
        "timestamp": "2026-07-17T10:00:00Z",
        "payload": payload,
    }


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_device_lifecycle_and_command() -> None:
    with TestClient(app) as client:
        with client.websocket_connect(
            "/ws/v1/devices/test-device-01", headers=DEVICE_HEADERS
        ) as socket:
            welcome = socket.receive_json()
            assert welcome["type"] == "welcome"

            socket.send_json(
                envelope(
                    "hello",
                    {
                        "agent_version": "0.1.0",
                        "platform": "Linux-aarch64",
                        "capabilities": ["audio", "camera", "display", "npu"],
                    },
                )
            )
            socket.send_json(envelope("heartbeat", {}))
            assert socket.receive_json()["type"] == "heartbeat_ack"
            socket.send_json(envelope("status", {"cpu_load_1m": 0.25}))

            devices = client.get("/api/v1/devices", headers=ADMIN_HEADERS)
            assert devices.status_code == 200
            assert devices.json()["items"][0]["device_id"] == "test-device-01"

            issued = client.post(
                "/api/v1/devices/test-device-01/commands",
                headers=ADMIN_HEADERS,
                json={"name": "get_status", "arguments": {}},
            )
            assert issued.status_code == 200
            command_id = issued.json()["command_id"]

            command = socket.receive_json()
            assert command["type"] == "command"
            assert command["payload"]["command_id"] == command_id

            socket.send_json(
                envelope(
                    "command_result",
                    {"command_id": command_id, "ok": True, "status": {}},
                )
            )

            deadline = time.monotonic() + 1
            while True:
                result = client.get(
                    f"/api/v1/commands/{command_id}", headers=ADMIN_HEADERS
                )
                if result.json()["state"] != "sent" or time.monotonic() >= deadline:
                    break
                time.sleep(0.01)
            assert result.status_code == 200
            assert result.json()["state"] == "completed"

        deadline = time.monotonic() + 1
        while True:
            device = client.get(
                "/api/v1/devices/test-device-01", headers=ADMIN_HEADERS
            )
            if device.json()["online"] is False or time.monotonic() >= deadline:
                break
            time.sleep(0.01)
        assert device.status_code == 200
        assert device.json()["online"] is False
        assert device.json()["agent_version"] == "0.1.0"
        assert device.json()["latest_status"]["cpu_load_1m"] == 0.25

        history = client.get(
            "/api/v1/devices/test-device-01/status-history",
            headers=ADMIN_HEADERS,
        )
        assert history.status_code == 200
        assert history.json()[0]["payload"]["cpu_load_1m"] == 0.25

        persisted_command = client.get(
            f"/api/v1/commands/{command_id}", headers=ADMIN_HEADERS
        )
        assert persisted_command.status_code == 200
        assert persisted_command.json()["state"] == "completed"

        command_history = client.get(
            "/api/v1/devices/test-device-01/commands", headers=ADMIN_HEADERS
        )
        assert command_history.status_code == 200
        assert command_history.json()[0]["command_id"] == command_id


def test_admin_endpoint_rejects_missing_token() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/devices").status_code == 401


def test_new_command_has_deadline_and_is_returned() -> None:
    with TestClient(app) as client:
        with client.websocket_connect(
            "/ws/v1/devices/deadline-device-01", headers=DEVICE_HEADERS
        ) as socket:
            assert socket.receive_json()["type"] == "welcome"
            socket.send_json(
                envelope(
                    "hello",
                    {"agent_version": "0.1.0"},
                    device_id="deadline-device-01",
                )
            )
            socket.send_json(
                envelope("heartbeat", {}, device_id="deadline-device-01")
            )
            assert socket.receive_json()["type"] == "heartbeat_ack"

            response = client.post(
                "/api/v1/devices/deadline-device-01/commands",
                headers=ADMIN_HEADERS,
                json={"name": "capture_snapshot", "arguments": {}},
            )
            assert response.status_code == 200
            command = response.json()
            assert command["expires_at"] is not None

            delivered = socket.receive_json()
            assert delivered["payload"]["name"] == "capture_snapshot"


def test_expired_command_cannot_be_overwritten_by_late_result() -> None:
    command_id = "expired-command-000000000000000000000000000000"
    device_id = "expired-device-01"

    async def seed_expired_command() -> None:
        now = utc_now()
        async with session_factory() as session:
            session.add(Device(device_id=device_id))
            session.add(
                DeviceCommand(
                    command_id=command_id,
                    device_id=device_id,
                    name="ping",
                    arguments={},
                    state="sent",
                    created_at=now - timedelta(minutes=1),
                    expires_at=now - timedelta(seconds=30),
                )
            )
            await session.commit()

    async def late_result() -> None:
        async with session_factory() as session:
            await complete_command(
                session,
                device_id,
                {"command_id": command_id, "ok": True, "pong": "late"},
            )

    asyncio.run(seed_expired_command())
    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/commands/{command_id}", headers=ADMIN_HEADERS
        )
        assert response.status_code == 200
        assert response.json()["state"] == "timed_out"

    asyncio.run(late_result())
    with TestClient(app) as client:
        response = client.get(
            f"/api/v1/commands/{command_id}", headers=ADMIN_HEADERS
        )
        assert response.json()["state"] == "timed_out"
