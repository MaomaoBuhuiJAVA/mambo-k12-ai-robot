#!/usr/bin/env python3
"""Run local hand landmark detection outside the Orange Pi browser process."""

from __future__ import annotations

import argparse
import json
import math
import os
import threading
import time
import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit


# Keep the native inference worker modest so voice wake-up and WebKit remain responsive.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

HAND_CONNECTIONS = (
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (0, 9), (9, 10), (10, 11), (11, 12),
    (0, 13), (13, 14), (14, 15), (15, 16),
    (0, 17), (17, 18), (18, 19), (19, 20),
)
FINGER_CHAINS = ((8, 6, 5), (12, 10, 9), (16, 14, 13), (20, 18, 17))
PALM_INDICES = (0, 5, 9, 13, 17)


def _clamp(value: float) -> float:
    return min(1.0, max(0.0, value))


def _point(landmarks: list[tuple[float, float]], index: int) -> tuple[float, float]:
    x, y = landmarks[index]
    return float(x), float(y)


def _distance(first: tuple[float, float], second: tuple[float, float]) -> float:
    return math.hypot(first[0] - second[0], first[1] - second[1])


def finger_is_extended(
    landmarks: list[tuple[float, float]], tip_index: int, pip_index: int
) -> bool:
    wrist = _point(landmarks, 0)
    return _distance(_point(landmarks, tip_index), wrist) > (
        _distance(_point(landmarks, pip_index), wrist) * 1.12
    )


def finger_is_folded(
    landmarks: list[tuple[float, float]], tip_index: int, pip_index: int
) -> bool:
    wrist = _point(landmarks, 0)
    return _distance(_point(landmarks, tip_index), wrist) < (
        _distance(_point(landmarks, pip_index), wrist) * 1.02
    )


def thumb_is_extended(landmarks: list[tuple[float, float]]) -> bool:
    wrist = _point(landmarks, 0)
    return _distance(_point(landmarks, 4), wrist) > (
        _distance(_point(landmarks, 3), wrist) * 1.10
    )


def thumb_is_folded(landmarks: list[tuple[float, float]]) -> bool:
    wrist = _point(landmarks, 0)
    return _distance(_point(landmarks, 4), wrist) < (
        _distance(_point(landmarks, 3), wrist) * 1.02
    )


def classify_landmarks(landmarks: list[tuple[float, float]]) -> str:
    """Classify the robot interaction gestures from normalized hand landmarks."""
    if len(landmarks) < 21:
        return "none"
    try:
        index = finger_is_extended(landmarks, 8, 6)
        middle = finger_is_extended(landmarks, 12, 10)
        ring = finger_is_extended(landmarks, 16, 14)
        pinky = finger_is_extended(landmarks, 20, 18)
        thumb = thumb_is_extended(landmarks)
        index_folded = finger_is_folded(landmarks, 8, 6)
        middle_folded = finger_is_folded(landmarks, 12, 10)
        ring_folded = finger_is_folded(landmarks, 16, 14)
        pinky_folded = finger_is_folded(landmarks, 20, 18)
        thumb_folded = thumb_is_folded(landmarks)
    except (IndexError, TypeError, ValueError):
        return "none"
    if index and middle and ring_folded and pinky_folded:
        return "v_sign"
    if pinky and thumb_folded and index_folded and middle_folded and ring_folded:
        return "pinky_up"
    if thumb and index_folded and middle_folded and ring_folded and pinky_folded:
        return "thumb_up"
    extended = sum((index, middle, ring, pinky))
    folded = sum((index_folded, middle_folded, ring_folded, pinky_folded))
    if extended >= 3:
        return "open_palm"
    if folded >= 3:
        return "fist"
    return "none"


def gesture_confidence(landmarks: list[tuple[float, float]], gesture: str) -> float:
    if gesture == "none" or len(landmarks) < 21:
        return 0.0
    try:
        index = finger_is_extended(landmarks, 8, 6)
        middle = finger_is_extended(landmarks, 12, 10)
        ring = finger_is_extended(landmarks, 16, 14)
        pinky = finger_is_extended(landmarks, 20, 18)
        thumb = thumb_is_extended(landmarks)
        index_folded = finger_is_folded(landmarks, 8, 6)
        middle_folded = finger_is_folded(landmarks, 12, 10)
        ring_folded = finger_is_folded(landmarks, 16, 14)
        pinky_folded = finger_is_folded(landmarks, 20, 18)
        thumb_folded = thumb_is_folded(landmarks)
    except (IndexError, TypeError, ValueError):
        return 0.0
    if gesture == "v_sign":
        matching_fingers = sum((index, middle, ring_folded, pinky_folded))
    elif gesture == "pinky_up":
        matching_fingers = sum((pinky, thumb_folded, index_folded, middle_folded, ring_folded))
    elif gesture == "thumb_up":
        matching_fingers = sum((thumb, index_folded, middle_folded, ring_folded, pinky_folded))
    elif gesture == "open_palm":
        matching_fingers = sum((index, middle, ring, pinky))
    elif gesture == "fist":
        matching_fingers = sum((index_folded, middle_folded, ring_folded, pinky_folded))
    else:
        return 0.0
    return min(0.98, 0.62 + matching_fingers * 0.09)


def cursor_from_mirrored_palm(landmarks: list[tuple[float, float]]) -> dict[str, float] | None:
    """Map a camera-space palm center to the visually mirrored robot cursor."""
    if len(landmarks) < 21:
        return None
    try:
        center_x = sum(_point(landmarks, index)[0] for index in PALM_INDICES) / len(PALM_INDICES)
        center_y = sum(_point(landmarks, index)[1] for index in PALM_INDICES) / len(PALM_INDICES)
    except (IndexError, TypeError, ValueError):
        return None
    return {"x": _clamp(1.0 - center_x), "y": _clamp(center_y)}


@dataclass(frozen=True)
class HandVisionConfig:
    device: str = "/dev/video0"
    model_path: Path = Path(__file__).parents[1] / "apps/web/public/models/hand/hand_landmarker.task"
    width: int = 320
    height: int = 240
    fps: float = 8.0
    jpeg_quality: int = 72
    min_detection_confidence: float = 0.6
    min_presence_confidence: float = 0.55
    min_tracking_confidence: float = 0.55

    @classmethod
    def from_env(cls) -> "HandVisionConfig":
        return cls(
            device=os.getenv("MAMBO_HAND_CAMERA", "/dev/video0"),
            model_path=Path(os.getenv("MAMBO_HAND_MODEL", str(cls.model_path))).expanduser(),
            width=max(160, min(640, int(os.getenv("MAMBO_HAND_WIDTH", "320")))),
            height=max(120, min(480, int(os.getenv("MAMBO_HAND_HEIGHT", "240")))),
            fps=max(2.0, min(12.0, float(os.getenv("MAMBO_HAND_FPS", "8")))),
            jpeg_quality=max(40, min(90, int(os.getenv("MAMBO_HAND_JPEG_QUALITY", "72")))),
        )


@dataclass(frozen=True)
class FaceIdentityConfig:
    """Configuration for low-rate identity checks on the hand camera frames."""

    detector_model_path: Path = Path(__file__).parent / "models" / "face" / "face_detection_yunet_2023mar.onnx"
    recognizer_model_path: Path = Path(__file__).parent / "models" / "face" / "face_recognition_sface_2021dec.onnx"
    store_path: Path = Path.home() / ".local" / "share" / "mambo-hand-vision" / "face" / "identities.json"
    fps: float = 2.0
    min_brightness: float = 35.0
    min_face_size: float = 80.0
    min_score: float = 0.90
    recognition_threshold: float = 0.45
    confirmation_frames: int = 3
    enrollment_samples: int = 5
    enrollment_min_interval_seconds: float = 0.35

    def __post_init__(self) -> None:
        object.__setattr__(self, "fps", max(0.5, min(2.0, float(self.fps))))

    @classmethod
    def from_env(cls) -> "FaceIdentityConfig":
        return cls(
            detector_model_path=Path(
                os.getenv("MAMBO_FACE_DETECTOR_MODEL", str(cls.detector_model_path))
            ).expanduser(),
            recognizer_model_path=Path(
                os.getenv("MAMBO_FACE_RECOGNIZER_MODEL", str(cls.recognizer_model_path))
            ).expanduser(),
            store_path=Path(
                os.getenv("MAMBO_FACE_IDENTITIES", str(cls.store_path))
            ).expanduser(),
            fps=max(0.5, min(2.0, float(os.getenv("MAMBO_FACE_FPS", "2")))),
        )


@dataclass(frozen=True)
class FaceObservation:
    """A single normalized face embedding from the shared camera frame."""

    embedding: list[float]
    width: float
    height: float
    score: float
    frontal: bool


class OpenCVFaceIdentityEngine:
    """OpenCV YuNet + SFace adapter. It deliberately owns no VideoCapture."""

    def __init__(self, config: FaceIdentityConfig) -> None:
        self.config = config
        self._cv2: Any = None
        self._detector: Any = None
        self._recognizer: Any = None

    def open(self) -> None:
        if not self.config.detector_model_path.is_file() or not self.config.recognizer_model_path.is_file():
            raise FileNotFoundError("face identity models are missing")

        import cv2

        self._cv2 = cv2
        self._detector = cv2.FaceDetectorYN.create(
            str(self.config.detector_model_path),
            "",
            (320, 320),
            self.config.min_score,
            0.3,
            5000,
        )
        self._recognizer = cv2.FaceRecognizerSF.create(str(self.config.recognizer_model_path), "")

    def detect(self, frame: Any) -> list[FaceObservation]:
        if self._detector is None or self._recognizer is None:
            raise RuntimeError("face identity engine is not initialized")
        height, width = frame.shape[:2]
        self._detector.setInputSize((int(width), int(height)))
        _result, faces = self._detector.detect(frame)
        if faces is None:
            return []

        observations: list[FaceObservation] = []
        for face in faces:
            row = [float(value) for value in face]
            if len(row) < 15:
                continue
            face_width, face_height, score = row[2], row[3], row[-1]
            if (
                face_width < self.config.min_face_size
                or face_height < self.config.min_face_size
                or score < self.config.min_score
            ):
                continue
            aligned = self._recognizer.alignCrop(frame, face)
            feature = self._recognizer.feature(aligned)
            embedding = [float(value) for value in feature.reshape(-1)]
            normalized = _normalize_embedding(embedding)
            if normalized is None:
                continue
            observations.append(
                FaceObservation(
                    embedding=normalized,
                    width=face_width,
                    height=face_height,
                    score=score,
                    frontal=self._is_frontal(row),
                )
            )
        return observations

    @staticmethod
    def _is_frontal(row: list[float]) -> bool:
        left_eye = (row[4], row[5])
        right_eye = (row[6], row[7])
        eye_distance = _distance(left_eye, right_eye)
        if eye_distance < 1.0:
            return False
        vertical_skew = abs(left_eye[1] - right_eye[1]) / eye_distance
        eye_span = eye_distance / max(row[2], row[3], 1.0)
        return vertical_skew <= 0.22 and eye_span >= 0.18

    def close(self) -> None:
        self._detector = None
        self._recognizer = None
        self._cv2 = None


def _normalize_embedding(values: list[float]) -> list[float] | None:
    magnitude = math.sqrt(sum(float(value) * float(value) for value in values))
    if magnitude <= 1e-9:
        return None
    return [float(value) / magnitude for value in values]


def _cosine_similarity(first: list[float], second: list[float]) -> float:
    if len(first) != len(second):
        return -1.0
    return sum(float(a) * float(b) for a, b in zip(first, second))


class FaceIdentityService:
    """Identity state machine fed by frames from the existing hand camera worker."""

    def __init__(
        self,
        config: FaceIdentityConfig,
        *,
        engine_factory: Callable[[FaceIdentityConfig], Any] = OpenCVFaceIdentityEngine,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.config = config
        self._engine_factory = engine_factory
        self._clock = clock
        self._lock = threading.Lock()
        self._engine: Any = None
        self._session_epoch = 0
        self._inflight_engines: dict[int, tuple[Any, int]] = {}
        self._retired_engines: list[Any] = []
        self._status = "idle"
        self._state = "idle"
        self._message = "人脸识别未启动"
        self._error: dict[str, str] | None = None
        self._enrollment: dict[str, object] | None = None
        self._last_sample_at: float | None = None
        self._last_processed_at: float | None = None
        self._candidate_id: str | None = None
        self._candidate_count = 0
        self._identity: dict[str, object] | None = None
        self._identities = self._load_identities()

    def start(self) -> dict[str, object]:
        with self._lock:
            if self._status in {"running", "loading"}:
                return self._snapshot_locked()
            self._session_epoch += 1
            epoch = self._session_epoch
            self._status = "loading"
            self._error = None
        engine: Any = None
        try:
            engine = self._engine_factory(self.config)
            engine.open()
        except FileNotFoundError:
            self._close_engine(engine)
            with self._lock:
                if epoch != self._session_epoch:
                    return self._snapshot_locked()
                self._engine = None
                self._status = "unavailable"
                self._state = "idle"
                self._message = "人脸模型文件未安装"
                self._error = {"code": "face_models_missing", "message": "人脸模型文件未安装"}
                return self._snapshot_locked()
        except Exception:
            self._close_engine(engine)
            with self._lock:
                if epoch != self._session_epoch:
                    return self._snapshot_locked()
                self._engine = None
                self._status = "unavailable"
                self._state = "idle"
                self._message = "人脸识别模型不可用"
                self._error = {"code": "face_models_unavailable", "message": "人脸识别模型不可用"}
                return self._snapshot_locked()
        with self._lock:
            if epoch != self._session_epoch or self._status != "loading":
                snapshot = self._snapshot_locked()
                stale = True
            else:
                self._engine = engine
                self._status = "running"
                self._state = "no_face"
                self._message = "未检测到人脸"
                self._error = None
                self._identity = None
                self._candidate_id = None
                self._candidate_count = 0
                return self._snapshot_locked()
        if stale:
            self._close_engine(engine)
            return snapshot

    def stop(self) -> dict[str, object]:
        with self._lock:
            self._session_epoch += 1
            engine = self._retire_current_engine_locked()
            self._engine = None
            self._status = "idle"
            self._state = "idle"
            self._message = "人脸识别未启动"
            self._error = None
            self._enrollment = None
            self._last_sample_at = None
            self._identity = None
            self._candidate_id = None
            self._candidate_count = 0
            snapshot = self._snapshot_locked()
        self._close_engine(engine)
        return snapshot

    def set_unavailable(self, code: str, message: str) -> dict[str, object]:
        """Record a camera/input failure without changing the hand service state."""
        with self._lock:
            self._session_epoch += 1
            engine = self._retire_current_engine_locked()
            self._engine = None
            self._status = "unavailable"
            self._state = "unknown"
            self._message = str(message)
            self._error = {"code": str(code), "message": str(message)}
            self._enrollment = None
            self._last_sample_at = None
            self._identity = None
            self._candidate_id = None
            self._candidate_count = 0
            snapshot = self._snapshot_locked()
        self._close_engine(engine)
        return snapshot

    def is_running(self) -> bool:
        with self._lock:
            return self._status == "running"

    def is_due(self, now: float | None = None) -> bool:
        now = self._clock() if now is None else now
        with self._lock:
            if self._status != "running":
                return False
            return (
                self._last_processed_at is None
                or now - self._last_processed_at >= 1.0 / self.config.fps
            )

    def begin_enrollment(self, label: object) -> dict[str, object]:
        normalized_label = label.strip() if isinstance(label, str) else ""
        if not normalized_label or len(normalized_label) > 32:
            with self._lock:
                self._error = {
                    "code": "invalid_label",
                    "message": "请填写要录入的身份名称",
                }
                return self._snapshot_locked()
        if not self.is_running():
            started = self.start()
            if started["status"] != "running":
                return started
        with self._lock:
            if self._status != "running":
                return self._snapshot_locked()
            self._session_epoch += 1
            self._enrollment = {"label": normalized_label, "samples": []}
            self._last_sample_at = None
            self._identity = None
            self._state = "collecting"
            self._message = f"正在采集人脸样本（0/{self.config.enrollment_samples}）"
            self._error = None
            return self._snapshot_locked()

    def cancel_enrollment(self) -> dict[str, object]:
        with self._lock:
            self._session_epoch += 1
            self._enrollment = None
            self._last_sample_at = None
            if self._status == "running":
                self._state = "no_face"
                self._message = "未检测到人脸"
            return self._snapshot_locked()

    def process_frame(self, frame: Any, *, brightness: float) -> dict[str, object]:
        now = self._clock()
        with self._lock:
            engine = self._engine
            if self._status != "running" or engine is None:
                return self._snapshot_locked()
            epoch = self._session_epoch
            self._acquire_engine_lease_locked(engine)
            self._last_processed_at = now
        if brightness < self.config.min_brightness:
            with self._lock:
                if self._is_current_engine_locked(epoch, engine):
                    self._clear_recognition_locked()
                    self._state = "low_light"
                    self._message = "环境光线不足，请打开灯后重试"
                snapshot = self._snapshot_locked()
                retired_engine = self._release_engine_lease_locked(engine)
            self._close_engine(retired_engine)
            return snapshot
        try:
            observations = engine.detect(frame)
        except Exception:
            with self._lock:
                if self._is_current_engine_locked(epoch, engine):
                    self._clear_recognition_locked()
                    self._state = "unknown"
                    self._message = "人脸识别暂时不可用"
                    self._error = {"code": "face_engine_unavailable", "message": "人脸识别暂时不可用"}
                snapshot = self._snapshot_locked()
                retired_engine = self._release_engine_lease_locked(engine)
            self._close_engine(retired_engine)
            return snapshot
        with self._lock:
            if self._is_current_engine_locked(epoch, engine):
                self._error = None
                if len(observations) == 0:
                    self._clear_recognition_locked()
                    self._state = "no_face"
                    self._message = "未检测到人脸"
                    snapshot = self._snapshot_locked()
                elif len(observations) != 1:
                    self._clear_recognition_locked()
                    self._state = "multiple_faces"
                    self._message = "请确保画面中只有一张人脸"
                    snapshot = self._snapshot_locked()
                else:
                    observation = observations[0]
                    if (
                        observation.width < self.config.min_face_size
                        or observation.height < self.config.min_face_size
                        or observation.score < self.config.min_score
                        or not observation.frontal
                    ):
                        self._clear_recognition_locked()
                        self._state = "no_face"
                        self._message = "请靠近并正对镜头"
                        snapshot = self._snapshot_locked()
                    elif self._enrollment is not None:
                        snapshot = self._collect_enrollment_locked(observation, now)
                    else:
                        snapshot = self._recognize_locked(observation)
            else:
                snapshot = self._snapshot_locked()
            retired_engine = self._release_engine_lease_locked(engine)
        self._close_engine(retired_engine)
        return snapshot

    @staticmethod
    def _close_engine(engine: Any) -> None:
        if engine is None:
            return
        try:
            engine.close()
        except Exception:
            pass

    def _is_current_engine_locked(self, epoch: int, engine: Any) -> bool:
        return (
            self._session_epoch == epoch
            and self._status == "running"
            and self._engine is engine
        )

    def _acquire_engine_lease_locked(self, engine: Any) -> None:
        key = id(engine)
        active = self._inflight_engines.get(key)
        if active is None or active[0] is not engine:
            self._inflight_engines[key] = (engine, 1)
            return
        self._inflight_engines[key] = (engine, active[1] + 1)

    def _retire_current_engine_locked(self) -> Any:
        engine = self._engine
        if engine is None:
            return None
        active = self._inflight_engines.get(id(engine))
        if active is not None and active[0] is engine and active[1] > 0:
            self._retired_engines.append(engine)
            return None
        return engine

    def _release_engine_lease_locked(self, engine: Any) -> Any:
        key = id(engine)
        active = self._inflight_engines.get(key)
        if active is None or active[0] is not engine:
            return None
        remaining = active[1] - 1
        if remaining > 0:
            self._inflight_engines[key] = (engine, remaining)
            return None
        del self._inflight_engines[key]
        for index, retired in enumerate(self._retired_engines):
            if retired is engine:
                return self._retired_engines.pop(index)
        return None

    def identities_snapshot(self) -> dict[str, object]:
        with self._lock:
            return {
                "count": len(self._identities),
                "identities": [self._public_identity(identity) for identity in self._identities],
            }

    def delete_identity(self, identity_id: object) -> dict[str, object]:
        value = identity_id.strip() if isinstance(identity_id, str) else ""
        with self._lock:
            identities = [identity for identity in self._identities if identity["id"] != value]
            if len(identities) != len(self._identities):
                try:
                    self._persist_identities_locked(identities)
                except OSError:
                    return {
                        "count": len(self._identities),
                        "identities": [
                            self._public_identity(identity) for identity in self._identities
                        ],
                        "error": {
                            "code": "face_identity_store_unavailable",
                            "message": "人脸身份保存失败",
                        },
                    }
                self._identities = identities
            return {
                "count": len(self._identities),
                "identities": [self._public_identity(identity) for identity in self._identities],
            }

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            return self._snapshot_locked()

    def _collect_enrollment_locked(self, observation: FaceObservation, now: float) -> dict[str, object]:
        assert self._enrollment is not None
        samples = self._enrollment["samples"]
        assert isinstance(samples, list)
        if (
            self._last_sample_at is None
            or now - self._last_sample_at + 1e-9 >= self.config.enrollment_min_interval_seconds
        ):
            samples.append(list(observation.embedding))
            self._last_sample_at = now
        collected = len(samples)
        if collected < self.config.enrollment_samples:
            self._state = "collecting"
            self._message = f"正在采集人脸样本（{collected}/{self.config.enrollment_samples}）"
            return self._snapshot_locked()
        averaged = [
            sum(float(sample[index]) for sample in samples) / collected
            for index in range(len(observation.embedding))
        ]
        embedding = _normalize_embedding(averaged)
        if embedding is None:
            self._state = "collecting"
            self._message = "人脸特征无效，请调整位置后重试"
            return self._snapshot_locked()
        identity = {
            "id": uuid.uuid4().hex,
            "label": str(self._enrollment["label"]),
            "embedding": embedding,
            "samples": collected,
            "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        identities = [*self._identities, identity]
        try:
            self._persist_identities_locked(identities)
        except OSError:
            self._session_epoch += 1
            self._retire_current_engine_locked()
            self._engine = None
            self._enrollment = None
            self._last_sample_at = None
            self._identity = None
            self._candidate_id = None
            self._candidate_count = 0
            self._status = "error"
            self._state = "unknown"
            self._message = "人脸身份保存失败"
            self._error = {
                "code": "face_identity_store_unavailable",
                "message": "人脸身份保存失败",
            }
            return self._snapshot_locked()
        self._identities = identities
        self._enrollment = None
        self._last_sample_at = None
        self._state = "confirmed"
        self._message = f"已完成{identity['label']}的人脸录入"
        self._identity = {**self._public_identity(identity), "confirmed": True}
        self._candidate_id = None
        self._candidate_count = 0
        return self._snapshot_locked()

    def _recognize_locked(self, observation: FaceObservation) -> dict[str, object]:
        best: dict[str, object] | None = None
        best_score = -1.0
        for identity in self._identities:
            score = _cosine_similarity(observation.embedding, identity["embedding"])
            if score > best_score:
                best = identity
                best_score = score
        if best is None or best_score < self.config.recognition_threshold:
            self._clear_recognition_locked()
            self._state = "unknown"
            self._message = "暂未识别到已录入身份"
            return self._snapshot_locked()
        identity_id = str(best["id"])
        if self._candidate_id == identity_id:
            self._candidate_count += 1
        else:
            self._candidate_id = identity_id
            self._candidate_count = 1
        confirmed = self._candidate_count >= self.config.confirmation_frames
        self._identity = {
            **self._public_identity(best),
            "confidence": round(best_score, 3),
            "confirmed": confirmed,
        }
        if confirmed:
            self._state = "confirmed"
            self._message = f"已确认身份：{best['label']}"
        else:
            self._state = "recognizing"
            self._message = f"正在确认身份（{self._candidate_count}/{self.config.confirmation_frames}）"
        return self._snapshot_locked()

    def _clear_recognition_locked(self) -> None:
        self._identity = None
        self._candidate_id = None
        self._candidate_count = 0

    def _snapshot_locked(self) -> dict[str, object]:
        enrollment = None
        if self._enrollment is not None:
            samples = self._enrollment["samples"]
            enrollment = {
                "label": str(self._enrollment["label"]),
                "collected": len(samples) if isinstance(samples, list) else 0,
                "required": self.config.enrollment_samples,
            }
        return {
            "status": self._status,
            "state": self._state,
            "message": self._message,
            "enrollment": enrollment,
            "identity": dict(self._identity) if self._identity else None,
            "error": dict(self._error) if self._error else None,
        }

    @staticmethod
    def _public_identity(identity: dict[str, object]) -> dict[str, object]:
        return {
            "id": identity["id"],
            "label": identity["label"],
            "samples": identity["samples"],
            "created_at": identity["created_at"],
        }

    def _load_identities(self) -> list[dict[str, object]]:
        try:
            payload = json.loads(self.config.store_path.read_text(encoding="utf-8"))
            entries = payload.get("identities", []) if isinstance(payload, dict) else []
        except (OSError, ValueError, TypeError):
            return []
        identities: list[dict[str, object]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            required = ("id", "label", "embedding", "samples", "created_at")
            if not all(key in entry for key in required):
                continue
            try:
                values = [float(value) for value in entry["embedding"]]
                embedding = _normalize_embedding(values)
                samples = int(entry["samples"])
            except (TypeError, ValueError):
                continue
            if embedding is None or samples < 1:
                continue
            identities.append(
                {
                    "id": str(entry["id"]),
                    "label": str(entry["label"]),
                    "embedding": embedding,
                    "samples": samples,
                    "created_at": str(entry["created_at"]),
                }
            )
        return identities

    def _persist_identities_locked(self, identities: list[dict[str, object]] | None = None) -> None:
        self.config.store_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"identities": self._identities if identities is None else identities}
        temporary = self.config.store_path.with_name(
            f".{self.config.store_path.name}.{uuid.uuid4().hex}.tmp"
        )
        try:
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            os.replace(temporary, self.config.store_path)
        except OSError:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
            raise


class HandVisionState:
    """Thread-safe, JSON-only state exposed to the local robot web page."""

    def __init__(self, *, clock: Callable[[], float] = time.monotonic) -> None:
        self._lock = threading.Lock()
        self._clock = clock
        self._status = "idle"
        self._sequence = 0
        self._gesture = "none"
        self._confidence = 0.0
        self._cursor: dict[str, float] | None = None
        self._landmarks: list[dict[str, float]] = []
        self._fps = 0.0
        self._latency_ms = 0.0
        self._width = 0
        self._height = 0
        self._brightness = 0.0
        self._last_frame_at: float | None = None
        self._error: dict[str, str] | None = None
        self._jpeg: bytes | None = None

    def set_loading(self) -> None:
        with self._lock:
            self._status = "loading"
            self._error = None

    def set_running(self) -> None:
        with self._lock:
            self._status = "running"
            self._error = None

    def set_idle(self) -> None:
        with self._lock:
            self._status = "idle"
            self._gesture = "none"
            self._confidence = 0.0
            self._cursor = None
            self._landmarks = []
            self._fps = 0.0
            self._latency_ms = 0.0
            self._width = 0
            self._height = 0
            self._brightness = 0.0
            self._last_frame_at = None
            self._error = None
            self._jpeg = None

    def set_error(self, code: str, message: str) -> None:
        with self._lock:
            self._status = "error"
            self._gesture = "none"
            self._confidence = 0.0
            self._cursor = None
            self._landmarks = []
            self._brightness = 0.0
            self._last_frame_at = None
            self._jpeg = None
            self._error = {"code": str(code), "message": str(message)}

    def set_frame(
        self,
        landmarks: list[tuple[float, float]],
        *,
        jpeg: bytes,
        width: int,
        height: int,
        fps: float,
        latency_ms: float,
        brightness: float,
    ) -> None:
        gesture = classify_landmarks(landmarks)
        confidence = gesture_confidence(landmarks, gesture)
        cursor = cursor_from_mirrored_palm(landmarks) if gesture != "none" else None
        serializable_landmarks = [
            {"x": round(_clamp(float(x)), 5), "y": round(_clamp(float(y)), 5)}
            for x, y in landmarks[:21]
        ]
        with self._lock:
            self._status = "running"
            self._sequence += 1
            self._gesture = gesture
            self._confidence = round(confidence, 3)
            self._cursor = cursor
            self._landmarks = serializable_landmarks
            self._fps = round(max(0.0, fps), 2)
            self._latency_ms = round(max(0.0, latency_ms), 1)
            self._width = max(0, int(width))
            self._height = max(0, int(height))
            self._brightness = round(min(255.0, max(0.0, brightness)), 1)
            self._last_frame_at = self._clock()
            self._error = None
            self._jpeg = jpeg

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            frame_age_ms = (
                None
                if self._last_frame_at is None
                else round(max(0.0, self._clock() - self._last_frame_at) * 1000, 1)
            )
            return {
                "status": self._status,
                "sequence": self._sequence,
                "gesture": self._gesture,
                "confidence": self._confidence,
                "cursor": dict(self._cursor) if self._cursor else None,
                "landmarks": [dict(point) for point in self._landmarks],
                "fps": self._fps,
                "latency_ms": self._latency_ms,
                "width": self._width,
                "height": self._height,
                "brightness": self._brightness,
                "frame_age_ms": frame_age_ms,
                "error": dict(self._error) if self._error else None,
            }

    def latest_jpeg(self) -> bytes | None:
        with self._lock:
            return self._jpeg


class MediaPipeHandBackend:
    """Camera and CPU MediaPipe adapter, imported only inside the worker thread."""

    def __init__(self, config: HandVisionConfig) -> None:
        self.config = config
        self._cv2: Any = None
        self._mp: Any = None
        self._detector: Any = None
        self._camera: Any = None
        self._last_timestamp_ms = 0

    def open(self) -> None:
        import cv2

        camera = cv2.VideoCapture(self.config.device, getattr(cv2, "CAP_V4L2", 0))
        camera.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
        camera.set(cv2.CAP_PROP_FPS, self.config.fps)
        camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not camera.isOpened():
            camera.release()
            raise RuntimeError("unable to open the USB camera")

        self._cv2 = cv2
        self._camera = camera

    def _ensure_hand_detector(self) -> None:
        if self._detector is not None:
            return
        if not self.config.model_path.is_file():
            raise FileNotFoundError("hand_landmarker.task is missing")

        import mediapipe as mp
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision

        options = vision.HandLandmarkerOptions(
            base_options=python.BaseOptions(
                model_asset_path=str(self.config.model_path),
                delegate=python.BaseOptions.Delegate.CPU,
            ),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=self.config.min_detection_confidence,
            min_hand_presence_confidence=self.config.min_presence_confidence,
            min_tracking_confidence=self.config.min_tracking_confidence,
        )
        self._mp = mp
        self._detector = vision.HandLandmarker.create_from_options(options)

    def read(
        self,
        *,
        detect_hand: bool = True,
        include_face_frame: bool = False,
        include_preview: bool = True,
    ) -> tuple[list[tuple[float, float]], bytes | None, int, int, float, float, Any | None]:
        if not self._camera:
            raise RuntimeError("vision backend is not initialized")
        captured, frame = self._camera.read()
        if not captured or frame is None:
            raise RuntimeError("unable to read a camera frame")

        height, width = frame.shape[:2]
        brightness = sum(float(value) for value in self._cv2.mean(frame)[:3]) / 3.0
        face_frame = frame.copy() if include_face_frame else None
        landmarks: list[tuple[float, float]] = []
        latency_ms = 0.0
        if detect_hand:
            self._ensure_hand_detector()
            rgb = self._cv2.cvtColor(frame, self._cv2.COLOR_BGR2RGB)
            timestamp_ms = max(self._last_timestamp_ms + 1, int(time.monotonic() * 1000))
            self._last_timestamp_ms = timestamp_ms
            started = time.monotonic()
            result = self._detector.detect_for_video(
                self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb),
                timestamp_ms,
            )
            latency_ms = (time.monotonic() - started) * 1000
            landmarks = [
                (float(point.x), float(point.y))
                for point in (result.hand_landmarks[0] if result.hand_landmarks else [])
            ]
            gesture = classify_landmarks(landmarks)
            self._draw_overlay(frame, landmarks, gesture)
        jpeg: bytes | None = None
        if include_preview:
            encoded, jpeg_data = self._cv2.imencode(
                ".jpg",
                frame,
                [int(self._cv2.IMWRITE_JPEG_QUALITY), self.config.jpeg_quality],
            )
            if not encoded:
                raise RuntimeError("unable to encode the hand preview")
            jpeg = bytes(jpeg_data)
        return landmarks, jpeg, width, height, latency_ms, brightness, face_frame

    def _draw_overlay(self, frame: Any, landmarks: list[tuple[float, float]], gesture: str) -> None:
        height, width = frame.shape[:2]
        color = (74, 200, 244) if gesture == "fist" else (172, 198, 54)
        for first, second in HAND_CONNECTIONS:
            if len(landmarks) < 21:
                break
            start = (round(landmarks[first][0] * width), round(landmarks[first][1] * height))
            end = (round(landmarks[second][0] * width), round(landmarks[second][1] * height))
            self._cv2.line(frame, start, end, color, 2, self._cv2.LINE_AA)
        for x, y in landmarks:
            point = (round(x * width), round(y * height))
            self._cv2.circle(frame, point, 4, (255, 255, 255), -1, self._cv2.LINE_AA)
            self._cv2.circle(frame, point, 4, color, 1, self._cv2.LINE_AA)

    def close(self) -> None:
        if self._detector is not None:
            try:
                self._detector.close()
            except Exception:
                pass
        if self._camera is not None:
            try:
                self._camera.release()
            except Exception:
                pass
        self._detector = None
        self._camera = None
        self._mp = None


class HandVisionService:
    """One camera worker shared by the hand and face consumers."""

    def __init__(
        self,
        config: HandVisionConfig,
        *,
        face_config: FaceIdentityConfig | None = None,
        backend_factory: Callable[[HandVisionConfig], Any] = MediaPipeHandBackend,
        face_engine_factory: Callable[[FaceIdentityConfig], Any] = OpenCVFaceIdentityEngine,
        stop_join_seconds: float = 2.0,
    ) -> None:
        self.config = config
        self.state = HandVisionState()
        self.face = FaceIdentityService(
            face_config or FaceIdentityConfig.from_env(),
            engine_factory=face_engine_factory,
        )
        self._backend_factory = backend_factory
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop_event: threading.Event | None = None
        self._generation = 0
        self._hand_consumer = False
        self._face_consumer = False
        self._face_stop_epoch = 0
        self._restart_after_release = False
        self._stop_join_seconds = max(0.0, float(stop_join_seconds))

    def start(self) -> dict[str, object]:
        with self._lock:
            self._hand_consumer = True
            return self._ensure_worker_locked()

    def stop(self) -> dict[str, object]:
        with self._lock:
            self._hand_consumer = False
            self.state.set_idle()
            thread = self._release_camera_if_unused_locked()
        self._join_and_reap(thread)
        return self.state.snapshot()

    def face_status(self) -> dict[str, object]:
        return self.face.snapshot()

    def face_start(self) -> dict[str, object]:
        with self._lock:
            stop_epoch = self._face_stop_epoch
        snapshot = self.face.start()
        if snapshot["status"] != "running":
            return snapshot
        with self._lock:
            if stop_epoch != self._face_stop_epoch or not self.face.is_running():
                return self.face.snapshot()
            self._face_consumer = True
            self._ensure_worker_locked()
        return self.face.snapshot()

    def face_stop(self) -> dict[str, object]:
        with self._lock:
            self._face_stop_epoch += 1
        snapshot = self.face.stop()
        with self._lock:
            self._face_consumer = False
            thread = self._release_camera_if_unused_locked()
        self._join_and_reap(thread)
        return snapshot

    def face_enroll(self, label: object) -> dict[str, object]:
        with self._lock:
            stop_epoch = self._face_stop_epoch
        snapshot = self.face.begin_enrollment(label)
        if snapshot["status"] != "running":
            return snapshot
        with self._lock:
            if stop_epoch != self._face_stop_epoch or not self.face.is_running():
                return self.face.snapshot()
            self._face_consumer = True
            self._ensure_worker_locked()
        return self.face.snapshot()

    def face_cancel_enrollment(self) -> dict[str, object]:
        return self.face.cancel_enrollment()

    def face_identities(self) -> dict[str, object]:
        return self.face.identities_snapshot()

    def face_delete_identity(self, identity_id: object) -> dict[str, object]:
        return self.face.delete_identity(identity_id)

    def _ensure_worker_locked(self) -> dict[str, object]:
        if self._thread is not None:
            if self._thread.is_alive():
                if self._stop_event is not None and self._stop_event.is_set():
                    if self._face_consumer:
                        self._restart_after_release = True
                    if self._hand_consumer:
                        self.state.set_error(
                            "camera_releasing",
                            "Hand camera is still shutting down",
                        )
                    return self.state.snapshot()
                if self._hand_consumer and self.state.snapshot()["status"] == "idle":
                    self.state.set_loading()
                return self.state.snapshot()
            self._thread = None
            self._stop_event = None
        self._generation += 1
        generation = self._generation
        stop_event = threading.Event()
        self._stop_event = stop_event
        if self._hand_consumer:
            self.state.set_loading()
        self._thread = threading.Thread(
            target=self._run,
            args=(generation, stop_event),
            name="mambo-hand-vision",
            daemon=True,
        )
        self._thread.start()
        return self.state.snapshot()

    def _release_camera_if_unused_locked(self) -> threading.Thread | None:
        if self._hand_consumer or self._face_consumer:
            return None
        self._restart_after_release = False
        self._generation += 1
        thread = self._thread
        if self._stop_event is not None:
            self._stop_event.set()
        return thread

    def _join_and_reap(self, thread: threading.Thread | None) -> None:
        if thread and thread.is_alive():
            thread.join(timeout=self._stop_join_seconds)
        with self._lock:
            if self._thread is thread and (thread is None or not thread.is_alive()):
                self._thread = None
                self._stop_event = None

    def _is_current(self, generation: int) -> bool:
        with self._lock:
            return generation == self._generation

    def _consumer_state(self) -> tuple[bool, bool]:
        with self._lock:
            return self._hand_consumer, self._face_consumer

    def _disable_hand_after_model_error(self) -> None:
        with self._lock:
            self._hand_consumer = False
            self.state.set_error("model_unavailable", "Hand landmark model is unavailable")

    def _mark_face_camera_unavailable(self, code: str, message: str) -> None:
        self.face.set_unavailable(code, message)
        self._disable_face_consumer_after_terminal_status()

    def _disable_face_consumer_after_terminal_status(self) -> None:
        with self._lock:
            self._face_consumer = False
            self._release_camera_if_unused_locked()

    def _complete_worker(self, stop_event: threading.Event) -> None:
        """Release the camera owner before starting a queued face-only worker."""
        with self._lock:
            if self._thread is not threading.current_thread() or self._stop_event is not stop_event:
                return
            self._thread = None
            self._stop_event = None
            if self._restart_after_release and (self._hand_consumer or self._face_consumer):
                self._restart_after_release = False
                self._ensure_worker_locked()
                return
            self._restart_after_release = False
            if stop_event.is_set() and not self._hand_consumer:
                self.state.set_idle()

    def _run(self, generation: int, stop_event: threading.Event) -> None:
        backend: Any = None
        try:
            backend = self._backend_factory(self.config)
            backend.open()
            if not self._is_current(generation):
                return
            last_frame_at: float | None = None
            while not stop_event.is_set() and self._is_current(generation):
                hand_active, face_active = self._consumer_state()
                if not hand_active and not face_active:
                    break
                if hand_active:
                    self.state.set_running()
                loop_started = time.monotonic()
                face_due = face_active and self.face.is_due(loop_started)
                try:
                    (
                        landmarks,
                        jpeg,
                        width,
                        height,
                        latency_ms,
                        brightness,
                        face_frame,
                    ) = backend.read(
                        detect_hand=hand_active,
                        include_face_frame=face_due,
                        include_preview=hand_active,
                    )
                except FileNotFoundError:
                    if hand_active and self._is_current(generation):
                        self._disable_hand_after_model_error()
                        continue
                    raise
                now = time.monotonic()
                actual_fps = 0.0 if last_frame_at is None else 1.0 / max(0.001, now - last_frame_at)
                last_frame_at = now
                if hand_active and self._is_current(generation):
                    if jpeg is None:
                        raise RuntimeError("unable to encode the hand preview")
                    self.state.set_frame(
                        landmarks,
                        jpeg=jpeg,
                        width=width,
                        height=height,
                        fps=actual_fps,
                        latency_ms=latency_ms,
                        brightness=brightness,
                    )
                if face_due:
                    face_snapshot = self.face.process_frame(face_frame, brightness=brightness)
                    if face_snapshot["status"] != "running":
                        self._disable_face_consumer_after_terminal_status()
                interval = 1.0 / (self.config.fps if hand_active else self.face.config.fps)
                remaining = interval - (time.monotonic() - loop_started)
                if remaining > 0:
                    stop_event.wait(remaining)
        except RuntimeError as error:
            if self._is_current(generation):
                message = str(error)
                code = "camera_unavailable" if "camera" in message else "vision_unavailable"
                hand_active, face_active = self._consumer_state()
                if hand_active:
                    self.state.set_error(code, message)
                if face_active:
                    self._mark_face_camera_unavailable(
                        code,
                        "人脸摄像头不可用" if code == "camera_unavailable" else "人脸识别输入不可用",
                    )
        except Exception:
            if self._is_current(generation):
                hand_active, face_active = self._consumer_state()
                if hand_active:
                    self.state.set_error("vision_unavailable", "Hand vision service could not start")
                if face_active:
                    self._mark_face_camera_unavailable("vision_unavailable", "人脸识别输入不可用")
        finally:
            if backend is not None:
                backend.close()
            self._complete_worker(stop_event)


class HandVisionHandler(BaseHTTPRequestHandler):
    service: HandVisionService

    def do_GET(self) -> None:
        if not self._is_local_request():
            self.send_error(403, "local requests only")
            return
        path = urlsplit(self.path).path
        if path == "/face/status":
            self._send_json(200, self.service.face_status())
            return
        if path == "/face/identities":
            self._send_json(200, self.service.face_identities())
            return
        if path == "/status":
            self._send_json(200, self.service.state.snapshot())
            return
        if path == "/frame.jpg":
            frame = self.service.state.latest_jpeg()
            if frame is None:
                self.send_response(204)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(frame)))
            self.end_headers()
            self.wfile.write(frame)
            return
        self.send_error(404, "not found")

    def do_POST(self) -> None:
        if not self._is_local_request():
            self.send_error(403, "local requests only")
            return
        path = urlsplit(self.path).path
        if path == "/face/start":
            self._discard_request_body()
            self._send_json(202, self.service.face_start())
            return
        if path == "/face/stop":
            self._discard_request_body()
            self._send_json(200, self.service.face_stop())
            return
        if path == "/face/enroll":
            payload = self._read_json_object()
            self._send_json(202, self.service.face_enroll(payload.get("label")))
            return
        if path == "/face/cancel-enrollment":
            self._discard_request_body()
            self._send_json(200, self.service.face_cancel_enrollment())
            return
        if path == "/face/identities/delete":
            payload = self._read_json_object()
            self._send_json(200, self.service.face_delete_identity(payload.get("id")))
            return
        if path == "/start":
            self._discard_request_body()
            self._send_json(202, self.service.start())
            return
        if path == "/stop":
            self._discard_request_body()
            self._send_json(200, self.service.stop())
            return
        self.send_error(404, "not found")

    def _is_local_request(self) -> bool:
        return self.client_address[0] in {"127.0.0.1", "::1"}

    def _discard_request_body(self) -> None:
        try:
            length = max(0, min(1024, int(self.headers.get("Content-Length", "0"))))
        except ValueError:
            length = 0
        if length:
            self.rfile.read(length)

    def _read_json_object(self) -> dict[str, object]:
        try:
            length = max(0, min(4096, int(self.headers.get("Content-Length", "0"))))
        except ValueError:
            length = 0
        if not length:
            return {}
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return {}
        return payload if isinstance(payload, dict) else {}

    def _send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def main() -> int:
    parser = argparse.ArgumentParser(description="Run local Orange Pi hand landmark detection")
    parser.add_argument("--listen", default=os.getenv("MAMBO_HAND_LISTEN", "127.0.0.1:3011"))
    parser.add_argument("--device")
    parser.add_argument("--model")
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--fps", type=float)
    args = parser.parse_args()

    config = HandVisionConfig.from_env()
    replacements: dict[str, object] = {}
    if args.device:
        replacements["device"] = args.device
    if args.model:
        replacements["model_path"] = Path(args.model).expanduser()
    if args.width:
        replacements["width"] = max(160, min(640, args.width))
    if args.height:
        replacements["height"] = max(120, min(480, args.height))
    if args.fps:
        replacements["fps"] = max(2.0, min(12.0, args.fps))
    if replacements:
        config = replace(config, **replacements)

    host, port_text = args.listen.rsplit(":", 1)
    HandVisionHandler.service = HandVisionService(config)
    server = ThreadingHTTPServer((host, int(port_text)), HandVisionHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        HandVisionHandler.service.stop()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
