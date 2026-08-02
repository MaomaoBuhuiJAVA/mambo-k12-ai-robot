#!/usr/bin/env python3
"""Serve the robot page from localhost while proxying the Web app upstream."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable


HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}
TTS_PLAYBACK_LOCK = threading.Lock()
WAKE_EVENT_PATH = "/_mambo/wake"
WAKE_HEARTBEAT_PATH = f"{WAKE_EVENT_PATH}/heartbeat"
WAKE_UNAVAILABLE_PATH = f"{WAKE_EVENT_PATH}/unavailable"
WAKE_CLAIM_PATH = f"{WAKE_EVENT_PATH}/claim"
WAKE_RENEW_PATH = f"{WAKE_EVENT_PATH}/renew"
WAKE_RELEASE_PATH = f"{WAKE_EVENT_PATH}/release"
HAND_VISION_PREFIX = "/_mambo/hand"
HAND_VISION_UPSTREAM = os.getenv("MAMBO_HAND_VISION_UPSTREAM", "http://127.0.0.1:3011").rstrip("/")
HAND_VISION_PATHS = frozenset({"/status", "/frame.jpg", "/start", "/stop"})
HAND_VISION_PROXY_TIMEOUT_SECONDS = 6.0
FACE_VISION_PREFIX = "/_mambo/face"
FACE_VISION_METHODS = {
    "/status": "GET",
    "/start": "POST",
    "/stop": "POST",
    "/enroll": "POST",
    "/cancel-enrollment": "POST",
    "/identities": "GET",
    "/identities/delete": "POST",
}
DEFAULT_UPSTREAM_TIMEOUT_SECONDS = 60.0


class WakeEventStore:
    """Keep the latest local wake signal for the robot browser to poll."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sequence = 0

    def signal(self) -> int:
        with self._lock:
            self._sequence += 1
            return self._sequence

    def snapshot(self) -> int:
        with self._lock:
            return self._sequence


class WakeHealthStore:
    """Track the daemon heartbeat without making the web page trust a stale proxy."""

    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.monotonic,
        stale_after_seconds: float = 8.0,
    ) -> None:
        self._lock = threading.Lock()
        self._clock = clock
        self._stale_after_seconds = max(0.1, stale_after_seconds)
        self._last_heartbeat: float | None = None

    def heartbeat(self) -> None:
        with self._lock:
            self._last_heartbeat = self._clock()

    def unavailable(self) -> None:
        with self._lock:
            self._last_heartbeat = None

    def is_online(self) -> bool:
        with self._lock:
            last_heartbeat = self._last_heartbeat
        return last_heartbeat is not None and self._clock() - last_heartbeat <= self._stale_after_seconds


class WakeCaptureStore:
    """Lease the USB microphone from Sherpa to one browser conversation."""

    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.monotonic,
        claim_timeout_seconds: float = 4.0,
        lease_timeout_seconds: float = 15.0,
    ) -> None:
        self._lock = threading.Lock()
        self._clock = clock
        self._claim_timeout_seconds = max(0.1, claim_timeout_seconds)
        self._lease_timeout_seconds = max(self._claim_timeout_seconds, lease_timeout_seconds)
        self._awaiting_claim_at: float | None = None
        self._claimed_at: float | None = None

    def _expire_locked(self, now: float) -> None:
        if self._claimed_at is not None and now - self._claimed_at > self._lease_timeout_seconds:
            self._claimed_at = None
        if self._awaiting_claim_at is not None and now - self._awaiting_claim_at > self._claim_timeout_seconds:
            self._awaiting_claim_at = None

    def await_claim(self) -> None:
        with self._lock:
            now = self._clock()
            self._awaiting_claim_at = now
            self._claimed_at = None

    def claim(self) -> bool:
        with self._lock:
            now = self._clock()
            self._expire_locked(now)
            if self._awaiting_claim_at is None:
                return False
            self._awaiting_claim_at = None
            self._claimed_at = now
            return True

    def renew(self) -> bool:
        with self._lock:
            now = self._clock()
            self._expire_locked(now)
            if self._claimed_at is None:
                return False
            self._claimed_at = now
            return True

    def release(self) -> None:
        with self._lock:
            self._awaiting_claim_at = None
            self._claimed_at = None

    def snapshot(self) -> str:
        with self._lock:
            self._expire_locked(self._clock())
            if self._claimed_at is not None:
                return "capturing"
            if self._awaiting_claim_at is not None:
                return "awaiting_claim"
            return "idle"


WAKE_EVENTS = WakeEventStore()
WAKE_HEALTH = WakeHealthStore()
WAKE_CAPTURE = WakeCaptureStore()


def hand_vision_target(path: str) -> str | None:
    """Return the loopback visual-service URL for one explicitly allowed route."""
    parsed = urlsplit(path)
    if not parsed.path.startswith(f"{HAND_VISION_PREFIX}/"):
        return None
    suffix = parsed.path[len(HAND_VISION_PREFIX) :]
    if suffix not in HAND_VISION_PATHS:
        return None
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{HAND_VISION_UPSTREAM}{suffix}{query}"


def face_vision_target(method: str, path: str) -> str | None:
    """Return the loopback visual-service URL for one allowed face route."""
    parsed = urlsplit(path)
    if not parsed.path.startswith(f"{FACE_VISION_PREFIX}/"):
        return None
    suffix = parsed.path[len(FACE_VISION_PREFIX) :]
    if FACE_VISION_METHODS.get(suffix) != method:
        return None
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{HAND_VISION_UPSTREAM}/face{suffix}{query}"


def is_face_vision_path(path: str) -> bool:
    parsed = urlsplit(path)
    return parsed.path == FACE_VISION_PREFIX or parsed.path.startswith(f"{FACE_VISION_PREFIX}/")


def proxy_timeout_seconds(target: str) -> float:
    if target.startswith(f"{HAND_VISION_UPSTREAM}/"):
        return HAND_VISION_PROXY_TIMEOUT_SECONDS
    return DEFAULT_UPSTREAM_TIMEOUT_SECONDS


def is_tts_audio_response(method: str, path: str, status: int, content_type: str) -> bool:
    return (
        method == "POST"
        and urlsplit(path).path == "/api/voice/tts"
        and status == 200
        and content_type.split(";", 1)[0].strip().lower() == "audio/mpeg"
    )


def play_tts_audio(data: bytes) -> bool:
    cache_dir = Path(os.getenv("ROBOT_TTS_CACHE_DIR", "/tmp/mambo-tts-cache"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=cache_dir, suffix=".mp3", delete=False) as artifact:
        artifact.write(data)
        source = Path(artifact.name)

    try:
        with TTS_PLAYBACK_LOCK:
            result = subprocess.run(
                ["mpv", "--no-video", "--no-terminal", "--really-quiet", "--volume=50", str(source)],
                check=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=120,
            )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False
    finally:
        source.unlink(missing_ok=True)


class ProxyHandler(BaseHTTPRequestHandler):
    upstream: str = ""

    def do_GET(self) -> None:
        if self._handle_face_vision_proxy():
            return
        if target := hand_vision_target(self.path):
            self._forward(target=target)
            return
        if self._handle_wake_event():
            return
        self._forward()

    def do_HEAD(self) -> None:
        if self._handle_face_vision_proxy(head_only=True):
            return
        if target := hand_vision_target(self.path):
            self._forward(head_only=True, target=target)
            return
        self._forward(head_only=True)

    def do_POST(self) -> None:
        if self._handle_face_vision_proxy():
            return
        if target := hand_vision_target(self.path):
            self._forward(target=target)
            return
        if self._handle_wake_event():
            return
        self._forward()

    def do_PUT(self) -> None:
        if self._handle_face_vision_proxy():
            return
        self._forward()

    def do_PATCH(self) -> None:
        if self._handle_face_vision_proxy():
            return
        self._forward()

    def do_DELETE(self) -> None:
        if self._handle_face_vision_proxy():
            return
        self._forward()

    def _handle_face_vision_proxy(self, *, head_only: bool = False) -> bool:
        if target := face_vision_target(self.command, self.path):
            if self.client_address[0] not in {"127.0.0.1", "::1"}:
                self.send_error(403, "face vision endpoint is local only")
                return True
            self._forward(head_only=head_only, target=target)
            return True
        if is_face_vision_path(self.path):
            self.send_error(404, "face vision route not allowed")
            return True
        return False

    def _handle_wake_event(self) -> bool:
        path = urlsplit(self.path).path
        if path not in {
            WAKE_EVENT_PATH,
            WAKE_HEARTBEAT_PATH,
            WAKE_UNAVAILABLE_PATH,
            WAKE_CLAIM_PATH,
            WAKE_RENEW_PATH,
            WAKE_RELEASE_PATH,
        }:
            return False
        if self.client_address[0] not in {"127.0.0.1", "::1"}:
            self.send_error(403, "wake event endpoint is local only")
            return True
        if self.command == "POST":
            length = int(self.headers.get("Content-Length", "0"))
            if length:
                self.rfile.read(min(length, 1024))
            if path == WAKE_HEARTBEAT_PATH:
                WAKE_HEALTH.heartbeat()
            elif path == WAKE_UNAVAILABLE_PATH:
                WAKE_HEALTH.unavailable()
            elif path == WAKE_CLAIM_PATH:
                if not WAKE_CAPTURE.claim():
                    self.send_error(409, "no wake microphone lease is available")
                    return True
            elif path == WAKE_RENEW_PATH:
                if not WAKE_CAPTURE.renew():
                    self.send_error(409, "wake microphone lease has expired")
                    return True
            elif path == WAKE_RELEASE_PATH:
                WAKE_CAPTURE.release()
            else:
                WAKE_EVENTS.signal()
                WAKE_CAPTURE.await_claim()
            self.send_response(204)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        if self.command == "GET" and path == WAKE_EVENT_PATH:
            data = json.dumps({
                "sequence": WAKE_EVENTS.snapshot(),
                "online": WAKE_HEALTH.is_online(),
                "capture": WAKE_CAPTURE.snapshot(),
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return True
        self.send_error(405, "method not allowed")
        return True

    def _forward(self, *, head_only: bool = False, target: str | None = None) -> None:
        target = target or f"{self.upstream}{self.path}"
        body = None
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "invalid Content-Length")
            return
        if length:
            body = self.rfile.read(min(length, 16 * 1024 * 1024))
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in HOP_BY_HOP and key.lower() != "host"
        }
        request = urllib.request.Request(
            target,
            data=body,
            headers=headers,
            method=self.command,
        )
        try:
            response = urllib.request.urlopen(request, timeout=proxy_timeout_seconds(target))
        except urllib.error.HTTPError as error:
            response = error
        except OSError as error:
            self.send_error(502, f"upstream unavailable: {error}")
            return

        data = b"" if head_only else response.read()
        content_type = response.headers.get("Content-Type", "")
        if is_tts_audio_response(self.command, self.path, response.status, content_type):
            if not play_tts_audio(data):
                self.send_error(502, "device audio playback failed")
                return
            self.send_response(204)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Mambo-Device-Playback", "complete")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        self.send_response(response.status)
        for key, value in response.headers.items():
            if key.lower() in HOP_BY_HOP or key.lower() == "content-length":
                continue
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if data:
            self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        if os.environ.get("ROBOT_PROXY_DEBUG") == "1":
            print(format % args, flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--listen", default=os.getenv("ROBOT_PROXY_LISTEN", "127.0.0.1:3010"))
    parser.add_argument("--upstream", default=os.getenv("ROBOT_PROXY_UPSTREAM", "http://192.168.1.18:3001"))
    args = parser.parse_args()
    host, port_text = args.listen.rsplit(":", 1)
    ProxyHandler.upstream = args.upstream.rstrip("/")
    server = ThreadingHTTPServer((host, int(port_text)), ProxyHandler)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
