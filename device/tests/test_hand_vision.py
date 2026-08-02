from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import threading
import time
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen

import pytest


SERVICE_PATH = Path(__file__).parents[2] / "deploy" / "mambo-hand-vision.py"


OPEN_PALM = [
    (0.50, 0.86),
    (0.42, 0.75),
    (0.34, 0.62),
    (0.25, 0.50),
    (0.16, 0.42),
    (0.40, 0.64),
    (0.39, 0.48),
    (0.38, 0.30),
    (0.37, 0.14),
    (0.50, 0.62),
    (0.50, 0.42),
    (0.50, 0.23),
    (0.50, 0.07),
    (0.60, 0.64),
    (0.61, 0.48),
    (0.62, 0.30),
    (0.63, 0.14),
    (0.69, 0.68),
    (0.72, 0.56),
    (0.75, 0.43),
    (0.78, 0.32),
]


FIST = [
    (0.50, 0.86),
    (0.43, 0.76),
    (0.36, 0.66),
    (0.31, 0.63),
    (0.36, 0.68),
    (0.40, 0.64),
    (0.39, 0.54),
    (0.40, 0.63),
    (0.41, 0.71),
    (0.50, 0.62),
    (0.50, 0.52),
    (0.50, 0.62),
    (0.50, 0.71),
    (0.60, 0.64),
    (0.61, 0.54),
    (0.60, 0.63),
    (0.59, 0.71),
    (0.69, 0.68),
    (0.70, 0.58),
    (0.67, 0.66),
    (0.64, 0.72),
]


V_SIGN = [
    (0.50, 0.86),
    (0.42, 0.75),
    (0.34, 0.62),
    (0.31, 0.63),
    (0.36, 0.68),
    (0.40, 0.64),
    (0.39, 0.48),
    (0.38, 0.30),
    (0.37, 0.14),
    (0.50, 0.62),
    (0.50, 0.42),
    (0.50, 0.23),
    (0.50, 0.07),
    (0.60, 0.64),
    (0.61, 0.54),
    (0.60, 0.63),
    (0.59, 0.71),
    (0.69, 0.68),
    (0.70, 0.58),
    (0.67, 0.66),
    (0.64, 0.72),
]


def pinky_only_landmarks() -> list[tuple[float, float]]:
    landmarks = list(FIST)
    landmarks[20] = (0.76, 0.12)
    return landmarks


def thumb_only_landmarks() -> list[tuple[float, float]]:
    landmarks = list(FIST)
    landmarks[4] = (0.16, 0.42)
    return landmarks


def pinky_and_thumb_landmarks() -> list[tuple[float, float]]:
    landmarks = pinky_only_landmarks()
    landmarks[4] = thumb_only_landmarks()[4]
    return landmarks


def with_finger_distance_ratio(
    landmarks: list[tuple[float, float]], tip_index: int, pip_index: int, ratio: float
) -> list[tuple[float, float]]:
    adjusted = list(landmarks)
    wrist_x, wrist_y = adjusted[0]
    pip_x, pip_y = adjusted[pip_index]
    adjusted[tip_index] = (
        wrist_x + (pip_x - wrist_x) * ratio,
        wrist_y + (pip_y - wrist_y) * ratio,
    )
    return adjusted


def load_service():
    assert SERVICE_PATH.is_file(), (
        "The independent hand-vision service must be deployed at "
        "deploy/mambo-hand-vision.py"
    )
    spec = importlib.util.spec_from_file_location("mambo_hand_vision", SERVICE_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_hand_vision_service_is_packaged_with_the_robot_deployment() -> None:
    assert SERVICE_PATH.is_file()


def test_camera_backend_requests_the_working_mjpeg_capture_format() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")

    assert 'camera.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))' in source


def test_camera_preview_defers_all_user_facing_hand_guidance_to_the_chinese_web_ui() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")

    assert "Show one hand" not in source
    assert "Open palm" not in source
    assert "Hold fist" not in source


@pytest.mark.parametrize(
    ("landmarks", "expected_gesture"),
    [
        (OPEN_PALM, "open_palm"),
        (FIST, "fist"),
        ([(0.50, 0.50)] * 21, "none"),
    ],
)
def test_classifies_21_normalized_landmarks_into_supported_gestures(
    landmarks: list[tuple[float, float]], expected_gesture: str
) -> None:
    service = load_service()
    classify = getattr(service, "classify_landmarks", None)

    assert callable(classify)
    assert classify(landmarks) == expected_gesture


@pytest.mark.parametrize(
    ("landmarks", "expected_gesture"),
    [
        (V_SIGN, "v_sign"),
        (pinky_only_landmarks(), "pinky_up"),
        (thumb_only_landmarks(), "thumb_up"),
    ],
)
def test_classifies_navigation_hand_poses(
    landmarks: list[tuple[float, float]], expected_gesture: str
) -> None:
    service = load_service()

    assert service.classify_landmarks(landmarks) == expected_gesture
    assert service.gesture_confidence(landmarks, expected_gesture) == pytest.approx(0.98)


@pytest.mark.parametrize(
    ("landmarks", "unexpected_gesture"),
    [
        (pinky_only_landmarks()[:8] + [OPEN_PALM[8]] + pinky_only_landmarks()[9:], "pinky_up"),
        (pinky_and_thumb_landmarks(), "pinky_up"),
        (thumb_only_landmarks()[:8] + [OPEN_PALM[8]] + thumb_only_landmarks()[9:], "thumb_up"),
    ],
)
def test_single_finger_navigation_poses_require_no_other_extended_fingers(
    landmarks: list[tuple[float, float]], unexpected_gesture: str
) -> None:
    service = load_service()

    assert service.classify_landmarks(landmarks) != unexpected_gesture


@pytest.mark.parametrize(
    ("tip_index", "pip_index"),
    [
        (16, 14),
        (20, 18),
    ],
)
def test_v_sign_rejects_an_extra_extended_ring_or_pinky(
    tip_index: int, pip_index: int
) -> None:
    service = load_service()
    landmarks = with_finger_distance_ratio(V_SIGN, tip_index, pip_index, 1.20)

    assert service.classify_landmarks(landmarks) != "v_sign"


@pytest.mark.parametrize("ratio", [1.06, 1.20])
def test_v_sign_accepts_a_neutral_or_extended_thumb(ratio: float) -> None:
    service = load_service()
    landmarks = with_finger_distance_ratio(V_SIGN, 4, 3, ratio)

    assert service.classify_landmarks(landmarks) == "v_sign"
    assert service.gesture_confidence(landmarks, "v_sign") == pytest.approx(0.98)


@pytest.mark.parametrize(
    ("landmarks", "tip_index", "pip_index", "ratio", "unexpected_gesture"),
    [
        (V_SIGN, 16, 14, 1.07, "v_sign"),
        (V_SIGN, 20, 18, 1.07, "v_sign"),
        (pinky_only_landmarks(), 4, 3, 1.06, "pinky_up"),
        (pinky_only_landmarks(), 8, 6, 1.07, "pinky_up"),
        (pinky_only_landmarks(), 12, 10, 1.07, "pinky_up"),
        (pinky_only_landmarks(), 16, 14, 1.07, "pinky_up"),
        (thumb_only_landmarks(), 8, 6, 1.07, "thumb_up"),
        (thumb_only_landmarks(), 12, 10, 1.07, "thumb_up"),
        (thumb_only_landmarks(), 16, 14, 1.07, "thumb_up"),
        (thumb_only_landmarks(), 20, 18, 1.07, "thumb_up"),
    ],
)
def test_navigation_poses_require_folded_non_target_fingers(
    landmarks: list[tuple[float, float]],
    tip_index: int,
    pip_index: int,
    ratio: float,
    unexpected_gesture: str,
) -> None:
    service = load_service()
    neutral_landmarks = with_finger_distance_ratio(landmarks, tip_index, pip_index, ratio)

    assert service.classify_landmarks(neutral_landmarks) != unexpected_gesture


def test_mirrored_palm_center_becomes_normalized_cursor_coordinates() -> None:
    service = load_service()
    cursor_from_mirrored_palm = getattr(service, "cursor_from_mirrored_palm", None)
    landmarks = [(0.05, 0.95)] * 21
    for index in (0, 5, 9, 13, 17):
        landmarks[index] = (0.80, 0.40)

    assert callable(cursor_from_mirrored_palm)
    cursor = cursor_from_mirrored_palm(landmarks)

    assert cursor["x"] == pytest.approx(0.20)
    assert cursor["y"] == pytest.approx(0.40)
    assert 0.0 <= cursor["x"] <= 1.0
    assert 0.0 <= cursor["y"] <= 1.0


def test_status_snapshot_is_json_safe_without_a_camera_object() -> None:
    service = load_service()
    state_type = getattr(service, "HandVisionState", None)

    assert state_type is not None
    state = state_type()
    snapshot = state.snapshot()

    assert snapshot["status"] == "idle"
    assert snapshot["gesture"] == "none"
    assert snapshot["cursor"] is None
    assert snapshot["brightness"] == 0.0
    assert snapshot["error"] is None
    assert "camera" not in snapshot
    assert "frame" not in snapshot
    assert "image" not in snapshot
    assert json.loads(json.dumps(snapshot)) == snapshot


def test_error_status_is_a_serializable_payload_for_the_robot_web_page() -> None:
    service = load_service()
    state_type = getattr(service, "HandVisionState", None)

    assert state_type is not None
    state = state_type()
    state.set_error("camera_unavailable", "Unable to open the USB camera")
    snapshot = state.snapshot()

    assert snapshot["status"] == "error"
    assert snapshot["gesture"] == "none"
    assert snapshot["cursor"] is None
    assert snapshot["error"] == {
        "code": "camera_unavailable",
        "message": "Unable to open the USB camera",
    }
    assert "traceback" not in snapshot
    assert json.loads(json.dumps(snapshot)) == snapshot


def test_error_state_discards_the_last_camera_preview() -> None:
    service = load_service()
    state_type = getattr(service, "HandVisionState", None)

    assert state_type is not None
    state = state_type()
    state.set_frame(
        OPEN_PALM,
        jpeg=b"previous-preview",
        width=320,
        height=240,
        fps=8.0,
        latency_ms=22.0,
        brightness=9.5,
    )
    state.set_error("vision_unavailable", "The model stopped")

    assert state.latest_jpeg() is None
    assert state.snapshot()["brightness"] == 0.0


def test_status_snapshot_reports_camera_brightness_from_the_latest_frame() -> None:
    service = load_service()
    state_type = getattr(service, "HandVisionState", None)

    assert state_type is not None
    state = state_type()
    state.set_frame(
        OPEN_PALM,
        jpeg=b"frame",
        width=320,
        height=240,
        fps=8.0,
        latency_ms=22.0,
        brightness=13.7,
    )

    assert state.snapshot()["brightness"] == 13.7


def test_status_snapshot_reports_the_age_of_the_last_camera_frame() -> None:
    service = load_service()
    state_type = getattr(service, "HandVisionState", None)

    assert state_type is not None
    now = [100.0]
    state = state_type(clock=lambda: now[0])
    state.set_frame(
        OPEN_PALM,
        jpeg=b"frame",
        width=320,
        height=240,
        fps=8.0,
        latency_ms=22.0,
        brightness=40.0,
    )
    now[0] = 102.6

    assert state.snapshot()["frame_age_ms"] == 2600.0


def test_hand_service_does_not_start_a_second_camera_worker_while_the_previous_one_is_releasing() -> None:
    service = load_service()
    config_type = getattr(service, "HandVisionConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert config_type is not None
    assert service_type is not None
    release_worker = threading.Event()
    worker = threading.Thread(target=release_worker.wait, daemon=True)
    worker.start()
    vision = service_type(config_type(), stop_join_seconds=0.01)
    vision._thread = worker
    vision._stop_event = threading.Event()

    try:
        stopped = vision.stop()
        assert stopped["status"] == "idle"
        assert vision._thread is worker

        restarting = vision.start()
        assert restarting["status"] == "error"
        assert restarting["error"]["code"] == "camera_releasing"
    finally:
        release_worker.set()
        worker.join(timeout=0.5)


def test_face_models_missing_is_reported_without_changing_hand_status(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    hand_state_type = getattr(service, "HandVisionState", None)

    assert config_type is not None
    assert identity_type is not None
    assert hand_state_type is not None
    hand_state = hand_state_type()
    hand_state.set_running()
    identity = identity_type(
        config_type(
            detector_model_path=tmp_path / "missing-yunet.onnx",
            recognizer_model_path=tmp_path / "missing-sface.onnx",
            store_path=tmp_path / "identities.json",
        )
    )

    snapshot = identity.start()

    assert snapshot["status"] == "unavailable"
    assert snapshot["error"] == {"code": "face_models_missing", "message": "人脸模型文件未安装"}
    assert hand_state.snapshot()["status"] == "running"


def test_face_enrollment_rejects_an_empty_label_before_starting_models(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)

    assert config_type is not None
    assert identity_type is not None
    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=lambda _config: pytest.fail("invalid input must not load models"),
    )

    snapshot = identity.begin_enrollment("   ")

    assert snapshot["status"] == "idle"
    assert snapshot["state"] == "idle"
    assert snapshot["error"] == {"code": "invalid_label", "message": "请填写要录入的身份名称"}


def test_face_enrollment_collects_five_spaced_samples_and_hides_embeddings(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert config_type is not None
    assert identity_type is not None
    assert observation_type is not None

    class FakeEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=[3.0, 4.0],
                    width=120.0,
                    height=130.0,
                    score=0.96,
                    frontal=True,
                )
            ]

    now = [100.0]
    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=lambda _config: FakeEngine(),
        clock=lambda: now[0],
    )
    identity.start()
    assert identity.begin_enrollment("小明")["enrollment"] == {
        "label": "小明",
        "collected": 0,
        "required": 5,
    }

    for index in range(5):
        now[0] = 100.0 + index * 0.36
        snapshot = identity.process_frame(object(), brightness=75.0)

    assert snapshot["state"] == "confirmed"
    assert snapshot["enrollment"] is None
    assert snapshot["identity"]["label"] == "小明"
    assert snapshot["identity"]["confirmed"] is True
    assert snapshot["identity"]["samples"] == 5
    assert "embedding" not in snapshot["identity"]
    public_identities = identity.identities_snapshot()
    assert public_identities == {
        "count": 1,
        "identities": [
            {
                "id": snapshot["identity"]["id"],
                "label": "小明",
                "samples": 5,
                "created_at": snapshot["identity"]["created_at"],
            }
        ],
    }
    assert "embedding" not in json.dumps(public_identities, ensure_ascii=False)
    persisted = json.loads((tmp_path / "identities.json").read_text(encoding="utf-8"))
    assert persisted["identities"][0]["embedding"] == pytest.approx([0.6, 0.8])


def test_face_service_reports_sample_progress_and_rejects_low_light(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert config_type is not None
    assert identity_type is not None
    assert observation_type is not None

    class FakeEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=[1.0, 0.0],
                    width=100.0,
                    height=100.0,
                    score=0.95,
                    frontal=True,
                )
            ]

    now = [20.0]
    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=lambda _config: FakeEngine(),
        clock=lambda: now[0],
    )
    identity.begin_enrollment("小红")
    dark = identity.process_frame(object(), brightness=12.0)
    assert dark["state"] == "low_light"
    assert dark["enrollment"]["collected"] == 0

    now[0] += 0.36
    collecting = identity.process_frame(object(), brightness=76.0)
    assert collecting["state"] == "collecting"
    assert collecting["enrollment"] == {"label": "小红", "collected": 1, "required": 5}


def test_face_recognition_requires_three_consecutive_matching_frames(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert config_type is not None
    assert identity_type is not None
    assert observation_type is not None

    class FakeEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=[1.0, 0.0],
                    width=120.0,
                    height=120.0,
                    score=0.97,
                    frontal=True,
                )
            ]

    now = [10.0]
    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=lambda _config: FakeEngine(),
        clock=lambda: now[0],
    )
    identity.begin_enrollment("小华")
    for index in range(5):
        now[0] = 10.0 + index * 0.36
        identity.process_frame(object(), brightness=80.0)

    states: list[str] = []
    confirmations: list[bool] = []
    for index in range(3):
        now[0] += 0.5
        snapshot = identity.process_frame(object(), brightness=80.0)
        states.append(snapshot["state"])
        confirmations.append(snapshot["identity"]["confirmed"])

    assert states == ["recognizing", "recognizing", "confirmed"]
    assert confirmations == [False, False, True]


def test_face_identity_delete_completes_and_persists_without_public_embeddings(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)

    assert config_type is not None
    assert identity_type is not None
    store_path = tmp_path / "identities.json"
    store_path.write_text(
        json.dumps(
            {
                "identities": [
                    {
                        "id": "student-1",
                        "label": "小明",
                        "embedding": [1.0, 0.0],
                        "samples": 5,
                        "created_at": "2026-07-19T00:00:00Z",
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    identity = identity_type(config_type(store_path=store_path))
    completed = threading.Event()
    result: list[dict[str, object]] = []

    def delete() -> None:
        result.append(identity.delete_identity("student-1"))
        completed.set()

    worker = threading.Thread(target=delete, daemon=True)
    worker.start()

    assert completed.wait(timeout=0.3)
    assert result == [{"count": 0, "identities": []}]
    assert json.loads(store_path.read_text(encoding="utf-8")) == {"identities": []}


def test_face_identity_delete_keeps_memory_and_disk_when_atomic_persist_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)

    assert config_type is not None
    assert identity_type is not None
    store_path = tmp_path / "identities.json"
    persisted_payload = {
        "identities": [
            {
                "id": "student-1",
                "label": "student",
                "embedding": [1.0, 0.0],
                "samples": 5,
                "created_at": "2026-07-19T00:00:00Z",
            }
        ]
    }
    store_path.write_text(json.dumps(persisted_payload), encoding="utf-8")
    identity = identity_type(config_type(store_path=store_path))

    def fail_atomic_replace(_source: object, _target: object) -> None:
        raise OSError("storage is read-only")

    monkeypatch.setattr(service.os, "replace", fail_atomic_replace)

    result = identity.delete_identity("student-1")

    assert result == {
        "count": 1,
        "identities": [
            {
                "id": "student-1",
                "label": "student",
                "samples": 5,
                "created_at": "2026-07-19T00:00:00Z",
            }
        ],
        "error": {
            "code": "face_identity_store_unavailable",
            "message": "人脸身份保存失败",
        },
    }
    assert identity.identities_snapshot() == {
        "count": 1,
        "identities": result["identities"],
    }
    assert json.loads(store_path.read_text(encoding="utf-8")) == persisted_payload
    assert list(tmp_path.glob(".identities.json.*.tmp")) == []


def test_face_config_never_allows_more_than_two_identity_frames_per_second() -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)

    assert config_type is not None
    assert config_type(fps=24.0).fps == 2.0


def test_face_and_hand_consumers_share_one_camera_until_both_stop(tmp_path: Path) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None

    entered = threading.Event()
    release = threading.Event()
    opened = [0]
    closed = [0]

    class FakeBackend:
        def __init__(self, _config: object) -> None:
            return

        def open(self) -> None:
            opened[0] += 1

        def read(
            self,
            *,
            detect_hand: bool = True,
            include_face_frame: bool = False,
            include_preview: bool = True,
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            entered.set()
            release.wait(timeout=1.0)
            return [], b"frame", 320, 240, 0.0, 70.0, object()

        def close(self) -> None:
            closed[0] += 1

    class FakeFaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return []

    vision = service_type(
        hand_config_type(fps=8.0),
        face_config=face_config_type(store_path=tmp_path / "identities.json"),
        backend_factory=FakeBackend,
        face_engine_factory=lambda _config: FakeFaceEngine(),
        stop_join_seconds=0.01,
    )
    try:
        vision.start()
        assert entered.wait(timeout=0.5)
        vision.face_start()
        hand_stopped = vision.stop()
        assert hand_stopped["status"] == "idle"
        assert opened == [1]
        assert closed == [0]

        vision.face_stop()
        release.set()
        deadline = time.monotonic() + 0.5
        while closed == [0] and time.monotonic() < deadline:
            time.sleep(0.01)
        assert closed == [1]
        assert opened == [1]
    finally:
        release.set()
        vision.stop()
        vision.face_stop()


def test_local_handler_exposes_the_face_identity_routes() -> None:
    service = load_service()
    handler_type = getattr(service, "HandVisionHandler", None)

    assert handler_type is not None
    calls: list[tuple[str, object | None]] = []

    class FakeService:
        def face_status(self) -> dict[str, object]:
            calls.append(("status", None))
            return {"status": "idle", "state": "idle"}

        def face_start(self) -> dict[str, object]:
            calls.append(("start", None))
            return {"status": "running", "state": "no_face"}

        def face_stop(self) -> dict[str, object]:
            calls.append(("stop", None))
            return {"status": "idle", "state": "idle"}

        def face_enroll(self, label: object) -> dict[str, object]:
            calls.append(("enroll", label))
            return {"status": "running", "state": "collecting"}

        def face_cancel_enrollment(self) -> dict[str, object]:
            calls.append(("cancel", None))
            return {"status": "running", "state": "no_face"}

        def face_identities(self) -> dict[str, object]:
            calls.append(("identities", None))
            return {"count": 0, "identities": []}

        def face_delete_identity(self, identity_id: object) -> dict[str, object]:
            calls.append(("delete", identity_id))
            return {"count": 0, "identities": []}

    handler_type.service = FakeService()
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_type)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with urlopen(f"{base_url}/face/status", timeout=1) as response:
            assert response.status == 200
            assert json.loads(response.read()) == {"status": "idle", "state": "idle"}

        def post(path: str, payload: dict[str, object]) -> dict[str, object]:
            request = Request(
                f"{base_url}{path}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(request, timeout=1) as response:
                return json.loads(response.read())

        assert post("/face/start", {})["status"] == "running"
        assert post("/face/enroll", {"label": "小明"})["state"] == "collecting"
        assert post("/face/cancel-enrollment", {})["state"] == "no_face"
        assert post("/face/identities/delete", {"id": "identity-1"})["count"] == 0
        with urlopen(f"{base_url}/face/identities", timeout=1) as response:
            assert json.loads(response.read()) == {"count": 0, "identities": []}
        assert post("/face/stop", {})["status"] == "idle"
        assert calls == [
            ("status", None),
            ("start", None),
            ("enroll", "小明"),
            ("cancel", None),
            ("delete", "identity-1"),
            ("identities", None),
            ("stop", None),
        ]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_face_start_after_hand_stop_restarts_only_after_the_releasing_camera_closes(
    tmp_path: Path,
) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None
    first_read = threading.Event()
    release_first = threading.Event()
    second_read = threading.Event()
    release_second = threading.Event()
    opened: list[int] = []
    closed: list[int] = []

    class BlockingBackend:
        def __init__(self, _config: object) -> None:
            self.index = len(opened) + 1

        def open(self) -> None:
            opened.append(self.index)

        def read(
            self,
            *,
            detect_hand: bool = True,
            include_face_frame: bool = False,
            include_preview: bool = True,
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            if self.index == 1:
                first_read.set()
                release_first.wait(timeout=1.0)
            else:
                second_read.set()
                release_second.wait(timeout=1.0)
            return [], b"frame", 320, 240, 0.0, 70.0, object()

        def close(self) -> None:
            closed.append(self.index)

    class FakeFaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return []

    vision = service_type(
        hand_config_type(fps=8.0),
        face_config=face_config_type(store_path=tmp_path / "identities.json"),
        backend_factory=BlockingBackend,
        face_engine_factory=lambda _config: FakeFaceEngine(),
        stop_join_seconds=0.01,
    )
    try:
        vision.start()
        assert first_read.wait(timeout=0.5)
        vision.stop()

        assert vision.face_start()["status"] == "running"
        assert opened == [1]

        release_first.set()
        assert second_read.wait(timeout=0.7)
        assert opened == [1, 2]
        assert closed == [1]
    finally:
        release_first.set()
        release_second.set()
        vision.stop()
        vision.face_stop()


@pytest.mark.parametrize("failure_stage", ["open", "read"])
def test_face_only_camera_failures_are_reported_by_the_face_status(
    tmp_path: Path,
    failure_stage: str,
) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None

    class FailingBackend:
        def __init__(self, _config: object) -> None:
            return

        def open(self) -> None:
            if failure_stage == "open":
                raise RuntimeError("unable to open the USB camera")

        def read(
            self,
            *,
            detect_hand: bool = True,
            include_face_frame: bool = False,
            include_preview: bool = True,
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            raise RuntimeError("unable to read a camera frame")

        def close(self) -> None:
            return

    class FakeFaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return []

    vision = service_type(
        hand_config_type(),
        face_config=face_config_type(store_path=tmp_path / "identities.json"),
        backend_factory=FailingBackend,
        face_engine_factory=lambda _config: FakeFaceEngine(),
    )
    try:
        vision.face_start()
        deadline = time.monotonic() + 0.5
        while vision.face_status()["status"] == "running" and time.monotonic() < deadline:
            time.sleep(0.01)

        face = vision.face_status()
        assert face["status"] == "unavailable"
        assert face["error"]["code"] == "camera_unavailable"
        assert vision.state.snapshot()["status"] == "idle"
    finally:
        vision.face_stop()


def test_malformed_identity_json_does_not_prevent_hand_service_construction(tmp_path: Path) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None
    store_path = tmp_path / "identities.json"
    store_path.write_text("{this is not valid json", encoding="utf-8")

    vision = service_type(
        hand_config_type(),
        face_config=face_config_type(store_path=store_path),
    )

    assert vision.face_identities() == {"count": 0, "identities": []}
    assert vision.state.snapshot()["status"] == "idle"


def test_bad_identity_embedding_is_isolated_without_crashing_hand_service(tmp_path: Path) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None
    store_path = tmp_path / "identities.json"
    store_path.write_text(
        json.dumps(
            {
                "identities": [
                    {
                        "id": "bad",
                        "label": "bad-data",
                        "embedding": ["not-a-number"],
                        "samples": 5,
                        "created_at": "2026-07-19T00:00:00Z",
                    },
                    {
                        "id": "good",
                        "label": "student",
                        "embedding": [1.0, 0.0],
                        "samples": 5,
                        "created_at": "2026-07-19T00:00:00Z",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )

    vision = service_type(
        hand_config_type(),
        face_config=face_config_type(store_path=store_path),
    )

    assert vision.face_identities() == {
        "count": 1,
        "identities": [
            {
                "id": "good",
                "label": "student",
                "samples": 5,
                "created_at": "2026-07-19T00:00:00Z",
            }
        ],
    }
    assert vision.state.snapshot()["status"] == "idle"


def test_identity_store_failure_returns_face_error_without_stopping_active_hand_worker(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    observation_type = getattr(service, "FaceObservation", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert observation_type is not None
    assert service_type is not None
    blocked_parent = tmp_path / "not-a-directory"
    blocked_parent.write_text("file", encoding="utf-8")
    hand_frames = [0]
    hand_running = threading.Event()

    class ActiveBackend:
        def __init__(self, _config: object) -> None:
            return

        def open(self) -> None:
            return

        def read(
            self,
            *,
            detect_hand: bool = True,
            include_face_frame: bool = False,
            include_preview: bool = True,
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            hand_frames[0] += 1
            hand_running.set()
            return [], b"frame", 320, 240, 0.0, 75.0, object()

        def close(self) -> None:
            return

    class FakeFaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=[1.0, 0.0],
                    width=120.0,
                    height=120.0,
                    score=0.97,
                    frontal=True,
                )
            ]

    vision = service_type(
        hand_config_type(fps=12.0),
        face_config=face_config_type(
            store_path=blocked_parent / "identities.json",
            enrollment_min_interval_seconds=0.0,
        ),
        backend_factory=ActiveBackend,
        face_engine_factory=lambda _config: FakeFaceEngine(),
    )
    try:
        vision.start()
        assert hand_running.wait(timeout=0.5)
        original_is_due = vision.face.is_due
        monkeypatch.setattr(
            vision.face,
            "is_due",
            lambda now: vision.face.is_running() and original_is_due(now) or vision.face.is_running(),
        )
        assert vision.face_enroll("student")["status"] == "running"

        deadline = time.monotonic() + 1.0
        while vision.face_status()["status"] == "running" and time.monotonic() < deadline:
            time.sleep(0.01)

        face = vision.face_status()
        before = hand_frames[0]
        time.sleep(0.15)
        assert face["status"] == "error"
        assert face["error"]["code"] == "face_identity_store_unavailable"
        assert vision.state.snapshot()["status"] == "running"
        assert hand_frames[0] > before
    finally:
        vision.stop()
        vision.face_stop()


def test_face_enrollment_ignores_samples_arriving_sooner_than_350ms(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert config_type is not None
    assert identity_type is not None
    assert observation_type is not None

    class FakeEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=[1.0, 0.0],
                    width=120.0,
                    height=120.0,
                    score=0.97,
                    frontal=True,
                )
            ]

    now = [10.0]
    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=lambda _config: FakeEngine(),
        clock=lambda: now[0],
    )
    identity.begin_enrollment("student")

    assert identity.process_frame(object(), brightness=75.0)["enrollment"]["collected"] == 1
    now[0] += 0.20
    assert identity.process_frame(object(), brightness=75.0)["enrollment"]["collected"] == 1
    now[0] += 0.15
    assert identity.process_frame(object(), brightness=75.0)["enrollment"]["collected"] == 2


def test_face_enrollment_rejects_low_score_small_and_multiple_faces(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert config_type is not None
    assert identity_type is not None
    assert observation_type is not None

    def observation(*, width: float = 120.0, score: float = 0.97) -> object:
        return observation_type(
            embedding=[1.0, 0.0],
            width=width,
            height=width,
            score=score,
            frontal=True,
        )

    batches = [
        [observation(score=0.89)],
        [observation(width=79.0)],
        [observation(), observation()],
    ]

    class FakeEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return batches.pop(0)

    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=lambda _config: FakeEngine(),
    )
    identity.begin_enrollment("student")

    low_score = identity.process_frame(object(), brightness=75.0)
    small = identity.process_frame(object(), brightness=75.0)
    multiple = identity.process_frame(object(), brightness=75.0)

    assert low_score["state"] == "no_face"
    assert small["state"] == "no_face"
    assert multiple["state"] == "multiple_faces"
    assert multiple["enrollment"]["collected"] == 0


def test_face_recognition_below_threshold_resets_the_confirmation_streak(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert config_type is not None
    assert identity_type is not None
    assert observation_type is not None
    store_path = tmp_path / "identities.json"
    store_path.write_text(
        json.dumps(
            {
                "identities": [
                    {
                        "id": "student-1",
                        "label": "student",
                        "embedding": [1.0, 0.0],
                        "samples": 5,
                        "created_at": "2026-07-19T00:00:00Z",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    embeddings = [[1.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 0.0], [1.0, 0.0]]

    class FakeEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=embeddings.pop(0),
                    width=120.0,
                    height=120.0,
                    score=0.97,
                    frontal=True,
                )
            ]

    identity = identity_type(
        config_type(store_path=store_path),
        engine_factory=lambda _config: FakeEngine(),
    )
    identity.start()
    states = [identity.process_frame(object(), brightness=75.0)["state"] for _ in range(5)]

    assert states == ["recognizing", "unknown", "recognizing", "recognizing", "confirmed"]


def test_real_face_http_payloads_never_expose_identity_embeddings(tmp_path: Path) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    handler_type = getattr(service, "HandVisionHandler", None)
    service_type = getattr(service, "HandVisionService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert handler_type is not None
    assert service_type is not None
    assert observation_type is not None
    store_path = tmp_path / "identities.json"
    store_path.write_text(
        json.dumps(
            {
                "identities": [
                    {
                        "id": "student-1",
                        "label": "student",
                        "embedding": [1.0, 0.0],
                        "samples": 5,
                        "created_at": "2026-07-19T00:00:00Z",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    class FakeFaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=[1.0, 0.0],
                    width=120.0,
                    height=120.0,
                    score=0.97,
                    frontal=True,
                )
            ]

    vision = service_type(
        hand_config_type(),
        face_config=face_config_type(store_path=store_path),
        face_engine_factory=lambda _config: FakeFaceEngine(),
    )
    vision.face.start()
    for _ in range(3):
        vision.face.process_frame(object(), brightness=75.0)
    handler_type.service = vision
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_type)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with urlopen(f"{base_url}/face/status", timeout=1) as response:
            status_body = response.read().decode("utf-8")
        with urlopen(f"{base_url}/face/identities", timeout=1) as response:
            identities_body = response.read().decode("utf-8")

        assert "embedding" not in status_body
        assert "embedding" not in identities_body
        assert json.loads(status_body)["identity"]["label"] == "student"
        assert json.loads(identities_body)["identities"][0]["label"] == "student"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)
        vision.face.stop()


def test_face_start_is_single_flight_and_stop_invalidates_a_stale_open(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)

    assert config_type is not None
    assert identity_type is not None
    opening = threading.Event()
    release_open = threading.Event()
    engines: list[object] = []

    class BlockingEngine:
        def __init__(self) -> None:
            self.closed = threading.Event()

        def open(self) -> None:
            opening.set()
            release_open.wait(timeout=1.0)

        def close(self) -> None:
            self.closed.set()

    def make_engine(_config: object) -> object:
        engine = BlockingEngine()
        engines.append(engine)
        return engine

    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=make_engine,
    )
    result: list[dict[str, object]] = []
    worker = threading.Thread(target=lambda: result.append(identity.start()), daemon=True)
    worker.start()
    assert opening.wait(timeout=0.5)

    assert identity.start()["status"] == "loading"
    assert len(engines) == 1
    assert identity.stop()["status"] == "idle"

    release_open.set()
    worker.join(timeout=0.5)

    assert not worker.is_alive()
    assert result[0]["status"] == "idle"
    assert result[0]["state"] == "idle"
    assert engines[0].closed.is_set()
    assert identity.snapshot()["status"] == "idle"


def test_stale_hand_service_face_start_after_stop_never_opens_a_camera_worker(
    tmp_path: Path,
) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None
    opening = threading.Event()
    release_open = threading.Event()
    backend_opens = [0]

    class BlockingEngine:
        def open(self) -> None:
            opening.set()
            release_open.wait(timeout=1.0)

        def close(self) -> None:
            return

    class CameraBackend:
        def __init__(self, _config: object) -> None:
            return

        def open(self) -> None:
            backend_opens[0] += 1

        def read(
            self, *, detect_hand: bool = True, include_face_frame: bool = False, include_preview: bool = True
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            return [], b"frame", 320, 240, 0.0, 70.0, object() if include_face_frame else None

        def close(self) -> None:
            return

    vision = service_type(
        hand_config_type(),
        face_config=face_config_type(store_path=tmp_path / "identities.json"),
        backend_factory=CameraBackend,
        face_engine_factory=lambda _config: BlockingEngine(),
    )
    result: list[dict[str, object]] = []
    worker = threading.Thread(target=lambda: result.append(vision.face_start()), daemon=True)
    worker.start()
    try:
        assert opening.wait(timeout=0.5)
        assert vision.face_stop()["status"] == "idle"

        release_open.set()
        worker.join(timeout=0.5)

        assert not worker.is_alive()
        assert result[0]["status"] == "idle"
        assert backend_opens == [0]
        assert vision.face_status()["status"] == "idle"
    finally:
        release_open.set()
        vision.stop()
        vision.face_stop()


def test_hand_service_stop_after_face_start_completes_cannot_claim_a_camera_worker(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None
    start_completed = threading.Event()
    release_consumer_claim = threading.Event()
    backend_opens = [0]

    class FaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

    class CameraBackend:
        def __init__(self, _config: object) -> None:
            return

        def open(self) -> None:
            backend_opens[0] += 1

        def read(
            self, *, detect_hand: bool = True, include_face_frame: bool = False, include_preview: bool = True
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            return [], b"frame" if include_preview else None, 320, 240, 0.0, 70.0, object()

        def close(self) -> None:
            return

    vision = service_type(
        hand_config_type(),
        face_config=face_config_type(store_path=tmp_path / "identities.json"),
        backend_factory=CameraBackend,
        face_engine_factory=lambda _config: FaceEngine(),
    )
    original_start = vision.face.start

    def delayed_start() -> dict[str, object]:
        snapshot = original_start()
        start_completed.set()
        release_consumer_claim.wait(timeout=1.0)
        return snapshot

    monkeypatch.setattr(vision.face, "start", delayed_start)
    result: list[dict[str, object]] = []
    worker = threading.Thread(target=lambda: result.append(vision.face_start()), daemon=True)
    worker.start()
    try:
        assert start_completed.wait(timeout=0.5)
        assert vision.face_status()["status"] == "running"
        assert vision.face_stop()["status"] == "idle"

        release_consumer_claim.set()
        worker.join(timeout=0.5)

        assert not worker.is_alive()
        assert result[0]["status"] == "idle"
        assert backend_opens == [0]
    finally:
        release_consumer_claim.set()
        vision.stop()
        vision.face_stop()


@pytest.mark.parametrize("retire_operation", ["stop", "unavailable"])
def test_stale_detection_cannot_use_a_closed_engine_or_mutate_a_new_enrollment(
    tmp_path: Path,
    retire_operation: str,
) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)
    observation_type = getattr(service, "FaceObservation", None)

    assert config_type is not None
    assert identity_type is not None
    assert observation_type is not None
    entered_detect = threading.Event()
    release_detect = threading.Event()
    engines: list[object] = []

    class FirstEngine:
        def __init__(self) -> None:
            self.closed = threading.Event()

        def open(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            entered_detect.set()
            release_detect.wait(timeout=1.0)
            if self.closed.is_set():
                raise AssertionError("detect ran after the engine was closed")
            return [
                observation_type(
                    embedding=[1.0, 0.0],
                    width=120.0,
                    height=120.0,
                    score=0.97,
                    frontal=True,
                )
            ]

        def close(self) -> None:
            self.closed.set()

    class SecondEngine:
        def open(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return []

        def close(self) -> None:
            return

    def make_engine(_config: object) -> object:
        engine: object = FirstEngine() if not engines else SecondEngine()
        engines.append(engine)
        return engine

    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=make_engine,
    )
    identity.start()
    identity.begin_enrollment("old")
    result: list[dict[str, object]] = []
    worker = threading.Thread(
        target=lambda: result.append(identity.process_frame(object(), brightness=75.0)),
        daemon=True,
    )
    worker.start()
    assert entered_detect.wait(timeout=0.5)

    if retire_operation == "stop":
        identity.stop()
    else:
        identity.set_unavailable("camera_unavailable", "camera unavailable")
    assert not engines[0].closed.is_set()
    assert identity.start()["status"] == "running"
    assert identity.begin_enrollment("new")["enrollment"]["collected"] == 0

    release_detect.set()
    worker.join(timeout=0.5)

    assert not worker.is_alive()
    assert engines[0].closed.is_set()
    current = identity.snapshot()
    assert current["status"] == "running"
    assert current["enrollment"] == {"label": "new", "collected": 0, "required": 5}


def test_face_only_persistence_failure_releases_camera_and_later_start_is_clean(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    observation_type = getattr(service, "FaceObservation", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert observation_type is not None
    assert service_type is not None
    blocked_parent = tmp_path / "not-a-directory"
    blocked_parent.write_text("file", encoding="utf-8")
    opened: list[int] = []
    closed: list[int] = []
    engine_closed = [0]
    second_read = threading.Event()
    release_second = threading.Event()

    class FaceBackend:
        def __init__(self, _config: object) -> None:
            self.index = len(opened) + 1

        def open(self) -> None:
            opened.append(self.index)

        def read(
            self, *, detect_hand: bool = True, include_face_frame: bool = False, include_preview: bool = True
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            if self.index == 2:
                second_read.set()
                release_second.wait(timeout=1.0)
            return [], b"frame" if include_preview else None, 320, 240, 0.0, 75.0, object()

        def close(self) -> None:
            closed.append(self.index)

    class FakeFaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            engine_closed[0] += 1

        def detect(self, _frame: object) -> list[object]:
            return [
                observation_type(
                    embedding=[1.0, 0.0],
                    width=120.0,
                    height=120.0,
                    score=0.97,
                    frontal=True,
                )
            ]

    vision = service_type(
        hand_config_type(),
        face_config=face_config_type(
            store_path=blocked_parent / "identities.json",
            enrollment_min_interval_seconds=0.0,
        ),
        backend_factory=FaceBackend,
        face_engine_factory=lambda _config: FakeFaceEngine(),
    )
    try:
        original_is_due = vision.face.is_due
        monkeypatch.setattr(
            vision.face,
            "is_due",
            lambda now: vision.face.is_running() and (original_is_due(now) or True),
        )
        assert vision.face_enroll("student")["status"] == "running"

        deadline = time.monotonic() + 3.0
        while vision.face_status()["status"] == "running" and time.monotonic() < deadline:
            time.sleep(0.01)

        assert vision.face_status()["status"] == "error"
        deadline = time.monotonic() + 0.5
        while closed != [1] and time.monotonic() < deadline:
            time.sleep(0.01)
        assert closed == [1]
        assert engine_closed == [1]

        assert vision.face_start()["status"] == "running"
        assert second_read.wait(timeout=0.5)
        assert opened == [1, 2]
    finally:
        release_second.set()
        vision.stop()
        vision.face_stop()


def test_successful_face_frame_clears_a_previous_engine_error(tmp_path: Path) -> None:
    service = load_service()
    config_type = getattr(service, "FaceIdentityConfig", None)
    identity_type = getattr(service, "FaceIdentityService", None)

    assert config_type is not None
    assert identity_type is not None
    failures = [True, False]

    class RecoveringEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            if failures.pop(0):
                raise RuntimeError("temporary inference failure")
            return []

    identity = identity_type(
        config_type(store_path=tmp_path / "identities.json"),
        engine_factory=lambda _config: RecoveringEngine(),
    )
    identity.start()

    failed = identity.process_frame(object(), brightness=75.0)
    recovered = identity.process_frame(object(), brightness=75.0)

    assert failed["error"]["code"] == "face_engine_unavailable"
    assert recovered["state"] == "no_face"
    assert recovered["error"] is None


def test_camera_backend_avoids_unneeded_face_copy_and_preview_encoding() -> None:
    service = load_service()
    config_type = getattr(service, "HandVisionConfig", None)
    backend_type = getattr(service, "MediaPipeHandBackend", None)

    assert config_type is not None
    assert backend_type is not None
    copied = [0]
    encoded = [0]

    class Frame:
        shape = (240, 320, 3)

        def copy(self) -> object:
            copied[0] += 1
            return self

    frame = Frame()

    class Camera:
        def read(self) -> tuple[bool, object]:
            return True, frame

    class CV2:
        IMWRITE_JPEG_QUALITY = 1

        @staticmethod
        def mean(_frame: object) -> tuple[float, float, float, float]:
            return 75.0, 75.0, 75.0, 0.0

        @staticmethod
        def imencode(_extension: str, _frame: object, _options: object) -> tuple[bool, bytes]:
            encoded[0] += 1
            return True, b"jpeg"

    backend = backend_type(config_type())
    backend._camera = Camera()
    backend._cv2 = CV2()

    hand_only = backend.read(
        detect_hand=False,
        include_face_frame=False,
        include_preview=True,
    )
    face_only = backend.read(
        detect_hand=False,
        include_face_frame=True,
        include_preview=False,
    )

    assert hand_only[1] == b"jpeg"
    assert hand_only[-1] is None
    assert face_only[1] is None
    assert face_only[-1] is frame
    assert copied == [1]
    assert encoded == [1]


def test_shared_hand_face_worker_copies_raw_frame_only_for_due_face_inference(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = load_service()
    hand_config_type = getattr(service, "HandVisionConfig", None)
    face_config_type = getattr(service, "FaceIdentityConfig", None)
    service_type = getattr(service, "HandVisionService", None)

    assert hand_config_type is not None
    assert face_config_type is not None
    assert service_type is not None
    first_read = threading.Event()
    release_first = threading.Event()
    shared_calls_ready = threading.Event()
    release_worker = threading.Event()
    shared_flags: list[tuple[bool, bool, bool]] = []
    processed_frames: list[object] = []

    class SpyBackend:
        def __init__(self, _config: object) -> None:
            self.calls = 0

        def open(self) -> None:
            return

        def read(
            self,
            *,
            detect_hand: bool = True,
            include_face_frame: bool = False,
            include_preview: bool = True,
        ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, object | None]:
            self.calls += 1
            if self.calls == 1:
                first_read.set()
                release_first.wait(timeout=1.0)
            else:
                shared_flags.append((detect_hand, include_face_frame, include_preview))
                if len(shared_flags) >= 4:
                    shared_calls_ready.set()
                    release_worker.wait(timeout=1.0)
            return [], b"frame" if include_preview else None, 320, 240, 0.0, 75.0, object()

        def close(self) -> None:
            return

    class FakeFaceEngine:
        def open(self) -> None:
            return

        def close(self) -> None:
            return

        def detect(self, _frame: object) -> list[object]:
            return []

    vision = service_type(
        hand_config_type(fps=8.0),
        face_config=face_config_type(store_path=tmp_path / "identities.json"),
        backend_factory=SpyBackend,
        face_engine_factory=lambda _config: FakeFaceEngine(),
        stop_join_seconds=0.01,
    )
    due_ticks = [True, False, False, True]

    def is_due(_now: float) -> bool:
        return due_ticks.pop(0) if due_ticks else False

    def process_frame(frame: object, *, brightness: float) -> dict[str, object]:
        assert brightness == 75.0
        processed_frames.append(frame)
        return {"status": "running"}

    try:
        vision.start()
        assert first_read.wait(timeout=0.5)
        assert vision.face_start()["status"] == "running"
        monkeypatch.setattr(vision.face, "is_due", is_due)
        monkeypatch.setattr(vision.face, "process_frame", process_frame)

        release_first.set()
        assert shared_calls_ready.wait(timeout=1.0)
        release_worker.set()
        deadline = time.monotonic() + 0.5
        while len(processed_frames) < 2 and time.monotonic() < deadline:
            time.sleep(0.01)

        assert shared_flags[:4] == [
            (True, True, True),
            (True, False, True),
            (True, False, True),
            (True, True, True),
        ]
        assert len(processed_frames) == 2
    finally:
        release_first.set()
        release_worker.set()
        vision.stop()
        vision.face_stop()
