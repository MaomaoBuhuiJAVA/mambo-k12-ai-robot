import importlib.util
import json
from pathlib import Path
import socket
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


MODULE_PATH = Path(__file__).with_name("local-web-proxy.py")
SPEC = importlib.util.spec_from_file_location("local_web_proxy", MODULE_PATH)
assert SPEC and SPEC.loader
proxy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proxy)


class LocalWebProxyTests(unittest.TestCase):
    def test_rejects_non_loopback_face_requests_before_forwarding(self) -> None:
        class NonLoopbackProxyHandler(proxy.ProxyHandler):
            def setup(self) -> None:
                super().setup()
                self.client_address = ("198.51.100.8", self.client_address[1])

        class RecordingVisionHandler(BaseHTTPRequestHandler):
            requests: list[tuple[str, str]] = []

            def _record(self) -> None:
                self.requests.append((self.command, self.path))
                self.send_response(204)
                self.send_header("Content-Length", "0")
                self.end_headers()

            do_GET = _record
            do_POST = _record

            def log_message(self, _format: str, *_args: object) -> None:
                return

        vision_server = ThreadingHTTPServer(("127.0.0.1", 0), RecordingVisionHandler)
        vision_thread = threading.Thread(target=vision_server.serve_forever, daemon=True)
        proxy_server = ThreadingHTTPServer(("127.0.0.1", 0), NonLoopbackProxyHandler)
        proxy_thread = threading.Thread(target=proxy_server.serve_forever, daemon=True)
        original_vision_upstream = proxy.HAND_VISION_UPSTREAM
        proxy.HAND_VISION_UPSTREAM = f"http://127.0.0.1:{vision_server.server_port}"
        vision_thread.start()
        proxy_thread.start()
        try:
            routes = (
                ("GET", "/status"),
                ("POST", "/start"),
                ("POST", "/stop"),
                ("POST", "/enroll"),
                ("POST", "/cancel-enrollment"),
                ("GET", "/identities"),
                ("POST", "/identities/delete"),
            )
            for method, suffix in routes:
                with self.subTest(method=method, suffix=suffix):
                    request = urllib.request.Request(
                        f"http://127.0.0.1:{proxy_server.server_port}/_mambo/face{suffix}",
                        data=b"{}" if method == "POST" else None,
                        method=method,
                    )
                    try:
                        with urllib.request.urlopen(request, timeout=1) as response:
                            status = response.status
                    except urllib.error.HTTPError as error:
                        status = error.code
                        error.close()

                    self.assertEqual(status, 403)

            self.assertEqual(RecordingVisionHandler.requests, [])
        finally:
            proxy.HAND_VISION_UPSTREAM = original_vision_upstream
            proxy_server.shutdown()
            proxy_server.server_close()
            proxy_thread.join(timeout=1)
            vision_server.shutdown()
            vision_server.server_close()
            vision_thread.join(timeout=1)

    def test_rejects_nonnumeric_content_length_for_face_posts(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), proxy.ProxyHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            response = b""
            try:
                with socket.create_connection(("127.0.0.1", server.server_port), timeout=1) as connection:
                    connection.sendall(
                        b"POST /_mambo/face/start HTTP/1.1\r\n"
                        b"Host: localhost\r\n"
                        b"Content-Length: not-a-number\r\n"
                        b"Connection: close\r\n\r\n"
                    )
                    response = connection.recv(4096)
            except OSError:
                pass

            parts = response.split(b" ", 2)
            status = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
            self.assertEqual(status, 400)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

    def test_routes_only_explicit_face_paths_and_methods_to_the_loopback_vision_service(self) -> None:
        target_for = getattr(proxy, "face_vision_target", lambda *_args: None)

        expected_targets = {
            ("GET", "/_mambo/face/status"): "http://127.0.0.1:3011/face/status",
            ("POST", "/_mambo/face/start"): "http://127.0.0.1:3011/face/start",
            ("POST", "/_mambo/face/stop"): "http://127.0.0.1:3011/face/stop",
            ("POST", "/_mambo/face/enroll"): "http://127.0.0.1:3011/face/enroll",
            ("POST", "/_mambo/face/cancel-enrollment"): "http://127.0.0.1:3011/face/cancel-enrollment",
            ("GET", "/_mambo/face/identities?limit=8"): "http://127.0.0.1:3011/face/identities?limit=8",
            ("POST", "/_mambo/face/identities/delete"): "http://127.0.0.1:3011/face/identities/delete",
        }
        for (method, path), target in expected_targets.items():
            with self.subTest(method=method, path=path):
                self.assertEqual(target_for(method, path), target)

        self.assertIsNone(target_for("GET", "/_mambo/face/frame.jpg"))
        self.assertIsNone(target_for("GET", "/_mambo/face/unknown"))
        self.assertIsNone(target_for("POST", "/_mambo/face/status"))
        self.assertIsNone(target_for("GET", "/api/face/status"))

    def test_uses_the_vision_timeout_for_face_loopback_requests(self) -> None:
        target_for = getattr(proxy, "face_vision_target", lambda *_args: None)
        timeout_for = getattr(proxy, "proxy_timeout_seconds", lambda _target: 60.0)
        target = target_for("GET", "/_mambo/face/status")

        self.assertEqual(target, "http://127.0.0.1:3011/face/status")
        self.assertEqual(timeout_for(target), 6.0)

    def test_rejects_unknown_face_proxy_paths_without_forwarding_to_the_web_upstream(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), proxy.ProxyHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/_mambo/face/unknown"
            try:
                with urllib.request.urlopen(url, timeout=1) as response:
                    status = response.status
            except urllib.error.HTTPError as error:
                status = error.code
                error.close()
            except OSError:
                status = 0

            self.assertEqual(status, 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

    def test_routes_only_hand_vision_paths_to_the_loopback_vision_service(self) -> None:
        target_for = getattr(proxy, "hand_vision_target", lambda _path: None)

        self.assertEqual(
            target_for("/_mambo/hand/status"),
            "http://127.0.0.1:3011/status",
        )
        self.assertEqual(
            target_for("/_mambo/hand/frame.jpg?sequence=8"),
            "http://127.0.0.1:3011/frame.jpg?sequence=8",
        )
        self.assertIsNone(target_for("/_mambo/hand/unknown"))
        self.assertIsNone(target_for("/api/device"))

    def test_uses_a_short_upstream_timeout_only_for_hand_vision_requests(self) -> None:
        timeout_for = getattr(proxy, "proxy_timeout_seconds", lambda _target: 60.0)

        self.assertEqual(timeout_for("http://127.0.0.1:3011/start"), 6.0)
        self.assertEqual(timeout_for("http://192.168.1.18:3011/api/chat"), 60.0)

    def test_identifies_successful_tts_audio_responses(self) -> None:
        matcher = getattr(proxy, "is_tts_audio_response", lambda *_: False)

        self.assertTrue(matcher("POST", "/api/voice/tts", 200, "audio/mpeg"))
        self.assertFalse(matcher("POST", "/api/voice/tts", 502, "audio/mpeg"))
        self.assertFalse(matcher("GET", "/api/voice/tts", 200, "audio/mpeg"))
        self.assertFalse(matcher("POST", "/api/chat", 200, "audio/mpeg"))

    def test_wake_event_store_increments_for_each_local_wake_signal(self) -> None:
        store_type = getattr(proxy, "WakeEventStore", None)

        self.assertIsNotNone(store_type)
        store = store_type()
        self.assertEqual(store.snapshot(), 0)
        self.assertEqual(store.signal(), 1)
        self.assertEqual(store.signal(), 2)
        self.assertEqual(store.snapshot(), 2)

    def test_wake_health_expires_without_a_fresh_daemon_heartbeat(self) -> None:
        health_type = getattr(proxy, "WakeHealthStore", None)

        self.assertIsNotNone(health_type)
        now = [100.0]
        health = health_type(clock=lambda: now[0], stale_after_seconds=5.0)
        self.assertFalse(health.is_online())

        health.heartbeat()
        self.assertTrue(health.is_online())

        health.unavailable()
        self.assertFalse(health.is_online())

        health.heartbeat()
        now[0] = 105.1
        self.assertFalse(health.is_online())

    def test_wake_capture_session_waits_for_claim_and_releases_after_the_browser_finishes(self) -> None:
        capture_type = getattr(proxy, "WakeCaptureStore", None)

        self.assertIsNotNone(capture_type)
        now = [100.0]
        capture = capture_type(clock=lambda: now[0], claim_timeout_seconds=3.0, lease_timeout_seconds=20.0)
        self.assertEqual(capture.snapshot(), "idle")

        capture.await_claim()
        self.assertEqual(capture.snapshot(), "awaiting_claim")
        self.assertTrue(capture.claim())
        self.assertEqual(capture.snapshot(), "capturing")

        capture.release()
        self.assertEqual(capture.snapshot(), "idle")

    def test_wake_capture_recovers_promptly_when_a_browser_crashes_without_releasing(self) -> None:
        capture_type = getattr(proxy, "WakeCaptureStore", None)

        self.assertIsNotNone(capture_type)
        now = [100.0]
        capture = capture_type(clock=lambda: now[0])
        capture.await_claim()
        self.assertTrue(capture.claim())

        now[0] = 115.1
        self.assertEqual(capture.snapshot(), "idle")

    def test_accepts_a_local_wake_event_without_forwarding_to_the_web_server(self) -> None:
        proxy.WAKE_EVENTS = proxy.WakeEventStore()
        server = ThreadingHTTPServer(("127.0.0.1", 0), proxy.ProxyHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/_mambo/wake"
            request = urllib.request.Request(url, data=b"", method="POST")
            try:
                with urllib.request.urlopen(request, timeout=1) as response:
                    status = response.status
            except (OSError, urllib.error.HTTPError):
                status = 0

            self.assertEqual(status, 204)
            self.assertEqual(proxy.WAKE_EVENTS.snapshot(), 1)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

    def test_reports_the_latest_wake_event_sequence_to_the_local_robot_page(self) -> None:
        proxy.WAKE_EVENTS = proxy.WakeEventStore()
        proxy.WAKE_HEALTH = proxy.WakeHealthStore(stale_after_seconds=60.0)
        proxy.WAKE_CAPTURE = proxy.WakeCaptureStore(claim_timeout_seconds=60.0, lease_timeout_seconds=60.0)
        proxy.WAKE_EVENTS.signal()
        proxy.WAKE_HEALTH.heartbeat()
        server = ThreadingHTTPServer(("127.0.0.1", 0), proxy.ProxyHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/_mambo/wake"
            try:
                with urllib.request.urlopen(url, timeout=1) as response:
                    payload = json.loads(response.read())
            except (OSError, urllib.error.HTTPError):
                payload = {}

            self.assertEqual(payload, {"sequence": 1, "online": True, "capture": "idle"})
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

    def test_accepts_a_local_wake_heartbeat_without_creating_a_wake_event(self) -> None:
        proxy.WAKE_EVENTS = proxy.WakeEventStore()
        proxy.WAKE_HEALTH = proxy.WakeHealthStore(stale_after_seconds=60.0)
        proxy.WAKE_CAPTURE = proxy.WakeCaptureStore(claim_timeout_seconds=60.0, lease_timeout_seconds=60.0)
        server = ThreadingHTTPServer(("127.0.0.1", 0), proxy.ProxyHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/_mambo/wake/heartbeat"
            request = urllib.request.Request(url, data=b"", method="POST")
            with urllib.request.urlopen(request, timeout=1) as response:
                self.assertEqual(response.status, 204)

            self.assertEqual(proxy.WAKE_EVENTS.snapshot(), 0)
            self.assertTrue(proxy.WAKE_HEALTH.is_online())
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

    def test_browser_claim_and_release_keep_the_wake_listener_paused_for_the_audio_session(self) -> None:
        proxy.WAKE_EVENTS = proxy.WakeEventStore()
        proxy.WAKE_CAPTURE = proxy.WakeCaptureStore(claim_timeout_seconds=60.0, lease_timeout_seconds=60.0)
        server = ThreadingHTTPServer(("127.0.0.1", 0), proxy.ProxyHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}/_mambo/wake"
            with urllib.request.urlopen(urllib.request.Request(base, data=b"", method="POST"), timeout=1):
                pass
            with urllib.request.urlopen(urllib.request.Request(f"{base}/claim", data=b"", method="POST"), timeout=1) as response:
                self.assertEqual(response.status, 204)
            self.assertEqual(proxy.WAKE_CAPTURE.snapshot(), "capturing")

            with urllib.request.urlopen(urllib.request.Request(f"{base}/release", data=b"", method="POST"), timeout=1) as response:
                self.assertEqual(response.status, 204)
            self.assertEqual(proxy.WAKE_CAPTURE.snapshot(), "idle")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)


if __name__ == "__main__":
    unittest.main()
