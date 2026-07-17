import os

os.environ["DEVICE_AUTH_TOKEN"] = "test-device-token-123456"
os.environ["ADMIN_API_TOKEN"] = "test-admin-token-123456"

from fastapi.testclient import TestClient

from server.app.main import app


DEVICE_HEADERS = {"Authorization": "Bearer test-device-token-123456"}
ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token-123456"}


def envelope(message_type: str, payload: dict) -> dict:
    return {
        "version": 1,
        "message_id": f"message-{message_type}-123456",
        "type": message_type,
        "device_id": "test-device-01",
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

            socket.send_json(envelope("hello", {"agent_version": "0.1.0"}))
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

            result = client.get(
                f"/api/v1/commands/{command_id}", headers=ADMIN_HEADERS
            )
            assert result.status_code == 200
            assert result.json()["state"] == "completed"


def test_admin_endpoint_rejects_missing_token() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/devices").status_code == 401

