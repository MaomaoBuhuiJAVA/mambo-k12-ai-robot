from __future__ import annotations

from fastapi.testclient import TestClient

from server.app.main import app


ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token-123456"}


def test_learning_record_lifecycle() -> None:
    with TestClient(app) as client:
        student_response = client.post(
            "/api/v1/students",
            headers=ADMIN_HEADERS,
            json={
                "display_name": "测试学生",
                "stage": "upper_primary",
                "interests": ["机器人", "编程"],
            },
        )
        assert student_response.status_code == 201
        student = student_response.json()

        course_response = client.post(
            "/api/v1/courses",
            headers=ADMIN_HEADERS,
            json={
                "title": "让机器人学会分类",
                "stage": "upper_primary",
                "description": "通过图像分类认识机器学习。",
                "status": "published",
                "course_data": {"knowledge_points": ["特征", "分类"]},
            },
        )
        assert course_response.status_code == 201
        course = course_response.json()

        session_response = client.post(
            "/api/v1/learning-sessions",
            headers=ADMIN_HEADERS,
            json={
                "student_id": student["student_id"],
                "course_id": course["course_id"],
            },
        )
        assert session_response.status_code == 201
        learning_session = session_response.json()
        session_id = learning_session["session_id"]

        for role, content in (
            ("user", "什么是图像分类？"),
            ("assistant", "图像分类就是让计算机判断图片属于哪一类。"),
        ):
            message = client.post(
                f"/api/v1/learning-sessions/{session_id}/messages",
                headers=ADMIN_HEADERS,
                json={"role": role, "content": content, "modality_data": {}},
            )
            assert message.status_code == 201

        attempt = client.post(
            f"/api/v1/learning-sessions/{session_id}/attempts",
            headers=ADMIN_HEADERS,
            json={
                "knowledge_point": "图像分类",
                "question_data": {"question": "猫的照片应归入哪一类？"},
                "answer_data": {"answer": "猫"},
                "correct": True,
                "score": 1.0,
                "feedback": "回答正确",
            },
        )
        assert attempt.status_code == 201
        assert attempt.json()["correct"] is True

        messages = client.get(
            f"/api/v1/learning-sessions/{session_id}/messages",
            headers=ADMIN_HEADERS,
        )
        assert [item["role"] for item in messages.json()] == ["user", "assistant"]

        attempts = client.get(
            f"/api/v1/learning-sessions/{session_id}/attempts",
            headers=ADMIN_HEADERS,
        )
        assert attempts.status_code == 200
        assert len(attempts.json()) == 1

        ended = client.post(
            f"/api/v1/learning-sessions/{session_id}/end",
            headers=ADMIN_HEADERS,
            json={"state": "completed"},
        )
        assert ended.status_code == 200
        assert ended.json()["state"] == "completed"

        rejected = client.post(
            f"/api/v1/learning-sessions/{session_id}/messages",
            headers=ADMIN_HEADERS,
            json={"role": "user", "content": "结束后不能继续", "modality_data": {}},
        )
        assert rejected.status_code == 409


def test_student_and_course_stage_must_match() -> None:
    with TestClient(app) as client:
        student = client.post(
            "/api/v1/students",
            headers=ADMIN_HEADERS,
            json={"display_name": "初中生", "stage": "middle_school"},
        ).json()
        course = client.post(
            "/api/v1/courses",
            headers=ADMIN_HEADERS,
            json={"title": "高中神经网络", "stage": "high_school"},
        ).json()

        response = client.post(
            "/api/v1/learning-sessions",
            headers=ADMIN_HEADERS,
            json={
                "student_id": student["student_id"],
                "course_id": course["course_id"],
            },
        )
        assert response.status_code == 409
        assert response.json()["detail"] == "student_course_stage_mismatch"
