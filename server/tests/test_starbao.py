from __future__ import annotations

from fastapi.testclient import TestClient

from server.app.main import app


ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token-123456"}


def test_get_or_creates_one_authoritative_conversation_per_device() -> None:
    device_id = "starbao-test-device-01"

    with TestClient(app) as client:
        first = client.get(
            f"/api/v1/starbao/conversations/{device_id}",
            headers=ADMIN_HEADERS,
        )
        second = client.get(
            f"/api/v1/starbao/conversations/{device_id}",
            headers=ADMIN_HEADERS,
        )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == {
        "conversation_id": second.json()["conversation_id"],
        "device_id": device_id,
        "speak_on_orangepi": False,
        "latest_sequence": 0,
    }


def test_updates_the_shared_orangepi_speech_setting() -> None:
    device_id = "starbao-settings-device-01"

    with TestClient(app) as client:
        client.get(
            f"/api/v1/starbao/conversations/{device_id}",
            headers=ADMIN_HEADERS,
        )
        updated = client.patch(
            f"/api/v1/starbao/conversations/{device_id}/settings",
            headers=ADMIN_HEADERS,
            json={"speak_on_orangepi": True},
        )
        restored = client.get(
            f"/api/v1/starbao/conversations/{device_id}",
            headers=ADMIN_HEADERS,
        )

    assert updated.status_code == 200
    assert updated.json()["speak_on_orangepi"] is True
    assert restored.json()["speak_on_orangepi"] is True


def test_appends_a_message_once_for_the_same_client_message_id() -> None:
    device_id = "starbao-message-device-01"
    payload = {
        "client_message_id": "web-message-0001",
        "role": "user",
        "origin": "web",
        "content": "为什么数字要排队？",
        "announce_on_orangepi": True,
    }

    with TestClient(app) as client:
        first = client.post(
            f"/api/v1/starbao/conversations/{device_id}/messages",
            headers=ADMIN_HEADERS,
            json=payload,
        )
        duplicate = client.post(
            f"/api/v1/starbao/conversations/{device_id}/messages",
            headers=ADMIN_HEADERS,
            json=payload,
        )

    assert first.status_code == 201
    assert duplicate.status_code == 200
    assert first.json()["message_id"] == duplicate.json()["message_id"]
    assert first.json()["sequence"] == 1
    assert first.json()["client_message_id"] == payload["client_message_id"]
    assert first.json()["announce_on_orangepi"] is True


def test_lists_messages_in_server_sequence_after_a_cursor() -> None:
    device_id = "starbao-cursor-device-01"

    with TestClient(app) as client:
        first = client.post(
            f"/api/v1/starbao/conversations/{device_id}/messages",
            headers=ADMIN_HEADERS,
            json={
                "client_message_id": "cursor-message-0001",
                "role": "user",
                "origin": "web",
                "content": "第一句话",
            },
        )
        second = client.post(
            f"/api/v1/starbao/conversations/{device_id}/messages",
            headers=ADMIN_HEADERS,
            json={
                "client_message_id": "cursor-message-0002",
                "role": "assistant",
                "origin": "starbao",
                "content": "第二句话",
                "reply_to_message_id": first.json()["message_id"],
            },
        )
        all_messages = client.get(
            f"/api/v1/starbao/conversations/{device_id}/messages?after=0&limit=100",
            headers=ADMIN_HEADERS,
        )
        unseen_messages = client.get(
            f"/api/v1/starbao/conversations/{device_id}/messages?after=1&limit=100",
            headers=ADMIN_HEADERS,
        )

    assert first.status_code == 201
    assert second.status_code == 201
    assert all_messages.status_code == 200
    assert all_messages.json()["latest_sequence"] == 2
    assert [item["sequence"] for item in all_messages.json()["messages"]] == [1, 2]
    assert unseen_messages.status_code == 200
    assert [item["sequence"] for item in unseen_messages.json()["messages"]] == [2]
