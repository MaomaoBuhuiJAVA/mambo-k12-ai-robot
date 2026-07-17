import asyncio
import threading
import time
from dataclasses import replace

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from server.app import repositories
from server.app.main import app
from server.app.routes import devices as device_routes


DEVICE_HEADERS = {"Authorization": "Bearer test-device-token-123456"}
ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token-123456"}


def envelope(
    message_type: str,
    payload: dict,
    *,
    device_id: str = "test-device-01",
    message_id: str | None = None,
) -> dict:
    return {
        "version": 1,
        "message_id": message_id or f"message-{message_type}-123456",
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
        assert device.json()["last_seen_at"].endswith(("Z", "+00:00"))

        history = client.get(
            "/api/v1/devices/test-device-01/status-history",
            headers=ADMIN_HEADERS,
        )
        assert history.status_code == 200
        assert history.json()[0]["payload"]["cpu_load_1m"] == 0.25
        assert history.json()[0]["recorded_at"].endswith(("Z", "+00:00"))

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


def test_duplicate_status_is_persisted_once_and_heartbeat_is_always_acked() -> None:
    device_id = "dedupe-device-01"
    status = envelope(
        "status",
        {"cpu_load_1m": 0.5},
        device_id=device_id,
        message_id="duplicate-status-123456",
    )
    heartbeat = envelope(
        "heartbeat",
        {},
        device_id=device_id,
        message_id="duplicate-heartbeat-123456",
    )

    with TestClient(app) as client:
        with client.websocket_connect(
            f"/ws/v1/devices/{device_id}", headers=DEVICE_HEADERS
        ) as socket:
            assert socket.receive_json()["type"] == "welcome"
            socket.send_json(status)
            socket.send_json(status)
            socket.send_json(heartbeat)
            socket.send_json(heartbeat)

            first_ack = socket.receive_json()
            second_ack = socket.receive_json()
            assert first_ack["type"] == "heartbeat_ack"
            assert second_ack["type"] == "heartbeat_ack"
            assert first_ack["payload"]["reply_to"] == heartbeat["message_id"]
            assert second_ack["payload"]["reply_to"] == heartbeat["message_id"]

            history = client.get(
                f"/api/v1/devices/{device_id}/status-history",
                headers=ADMIN_HEADERS,
            )
            assert history.status_code == 200
            assert len(history.json()) == 1


def test_duplicate_command_result_cannot_overwrite_first_result() -> None:
    device_id = "dedupe-result-device-01"
    with TestClient(app) as client:
        with client.websocket_connect(
            f"/ws/v1/devices/{device_id}", headers=DEVICE_HEADERS
        ) as socket:
            assert socket.receive_json()["type"] == "welcome"
            issued = client.post(
                f"/api/v1/devices/{device_id}/commands",
                headers=ADMIN_HEADERS,
                json={"name": "ping", "arguments": {}},
            )
            assert issued.status_code == 200
            command_id = issued.json()["command_id"]
            assert socket.receive_json()["payload"]["command_id"] == command_id

            socket.send_json(
                envelope(
                    "command_result",
                    {"command_id": command_id, "ok": True, "pong": "first"},
                    device_id=device_id,
                    message_id="duplicate-command-result-123456",
                )
            )
            socket.send_json(
                envelope(
                    "command_result",
                    {"command_id": command_id, "ok": False, "error": "replayed"},
                    device_id=device_id,
                    message_id="duplicate-command-result-123456",
                )
            )
            socket.send_json(
                envelope(
                    "heartbeat",
                    {},
                    device_id=device_id,
                    message_id="result-barrier-heartbeat-123456",
                )
            )
            assert socket.receive_json()["type"] == "heartbeat_ack"

            command = client.get(
                f"/api/v1/commands/{command_id}", headers=ADMIN_HEADERS
            )
            assert command.status_code == 200
            assert command.json()["state"] == "completed"
            assert command.json()["result"]["pong"] == "first"


def test_terminal_command_ignores_replay_with_new_message_id() -> None:
    device_id = "terminal-result-device-01"
    with TestClient(app) as client:
        with client.websocket_connect(
            f"/ws/v1/devices/{device_id}", headers=DEVICE_HEADERS
        ) as socket:
            assert socket.receive_json()["type"] == "welcome"
            issued = client.post(
                f"/api/v1/devices/{device_id}/commands",
                headers=ADMIN_HEADERS,
                json={"name": "ping", "arguments": {}},
            )
            command_id = issued.json()["command_id"]
            assert socket.receive_json()["payload"]["command_id"] == command_id

            socket.send_json(
                envelope(
                    "command_result",
                    {"command_id": command_id, "ok": True, "pong": "first"},
                    device_id=device_id,
                    message_id="terminal-command-first-123456",
                )
            )
            socket.send_json(
                envelope(
                    "command_result",
                    {"command_id": command_id, "ok": False, "error": "replayed"},
                    device_id=device_id,
                    message_id="terminal-command-replay-123456",
                )
            )
            socket.send_json(
                envelope(
                    "heartbeat",
                    {},
                    device_id=device_id,
                    message_id="terminal-command-barrier-123456",
                )
            )
            assert socket.receive_json()["type"] == "heartbeat_ack"

            command = client.get(
                f"/api/v1/commands/{command_id}", headers=ADMIN_HEADERS
            )
            assert command.status_code == 200
            assert command.json()["state"] == "completed"
            assert command.json()["result"]["pong"] == "first"


def test_status_history_retention_is_bounded(monkeypatch) -> None:
    device_id = "bounded-history-device-01"
    monkeypatch.setattr(repositories, "MAX_DEVICE_STATUS_HISTORY", 3, raising=False)

    with TestClient(app) as client:
        with client.websocket_connect(
            f"/ws/v1/devices/{device_id}", headers=DEVICE_HEADERS
        ) as socket:
            assert socket.receive_json()["type"] == "welcome"
            for sequence in range(4):
                socket.send_json(
                    envelope(
                        "status",
                        {"sequence": sequence},
                        device_id=device_id,
                        message_id=f"bounded-history-status-{sequence}",
                    )
                )
            socket.send_json(
                envelope(
                    "heartbeat",
                    {},
                    device_id=device_id,
                    message_id="bounded-history-barrier-123456",
                )
            )
            assert socket.receive_json()["type"] == "heartbeat_ack"

            history = client.get(
                f"/api/v1/devices/{device_id}/status-history?limit=1000",
                headers=ADMIN_HEADERS,
            )
            assert history.status_code == 200
            assert [item["payload"]["sequence"] for item in history.json()] == [
                3,
                2,
                1,
            ]


def test_receive_json_with_timeout_stops_waiting_for_inactive_socket() -> None:
    helper = getattr(device_routes, "receive_json_with_timeout", None)
    assert helper is not None, "gateway must expose its inactivity timeout helper"

    class InactiveSocket:
        async def receive_json(self) -> dict:
            await asyncio.Event().wait()
            raise AssertionError("unreachable")

    async def receive() -> None:
        await helper(InactiveSocket(), timeout_seconds=0.01)

    try:
        asyncio.run(receive())
    except asyncio.TimeoutError:
        pass
    else:
        raise AssertionError("inactive receive did not time out")


def test_inactive_device_is_closed_and_persisted_offline(monkeypatch) -> None:
    device_id = "inactive-device-01"
    monkeypatch.setattr(
        device_routes,
        "settings",
        replace(device_routes.settings, device_stale_after_seconds=0.05),
    )

    with TestClient(app) as client:
        with client.websocket_connect(
            f"/ws/v1/devices/{device_id}", headers=DEVICE_HEADERS
        ) as socket:
            assert socket.receive_json()["type"] == "welcome"
            outcome: dict[str, object] = {}

            def receive_close() -> None:
                try:
                    outcome["message"] = socket.receive_json()
                except BaseException as exc:  # Test thread must report disconnect.
                    outcome["error"] = exc

            receiver = threading.Thread(target=receive_close, daemon=True)
            receiver.start()
            receiver.join(timeout=1)
            assert not receiver.is_alive(), "gateway left inactive socket open"
            assert isinstance(outcome.get("error"), WebSocketDisconnect)
            assert outcome["error"].code == 4008

        device = client.get(
            f"/api/v1/devices/{device_id}", headers=ADMIN_HEADERS
        )
        assert device.status_code == 200
        assert device.json()["online"] is False
