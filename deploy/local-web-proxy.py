#!/usr/bin/env python3
"""Serve the robot page from localhost while proxying the Web app upstream."""

from __future__ import annotations

import argparse
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


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


class ProxyHandler(BaseHTTPRequestHandler):
    upstream: str = ""

    def do_GET(self) -> None:
        self._forward()

    def do_HEAD(self) -> None:
        self._forward(head_only=True)

    def do_POST(self) -> None:
        self._forward()

    def do_PUT(self) -> None:
        self._forward()

    def do_PATCH(self) -> None:
        self._forward()

    def do_DELETE(self) -> None:
        self._forward()

    def _forward(self, *, head_only: bool = False) -> None:
        target = f"{self.upstream}{self.path}"
        body = None
        length = int(self.headers.get("Content-Length", "0"))
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
            response = urllib.request.urlopen(request, timeout=60)
        except urllib.error.HTTPError as error:
            response = error
        except OSError as error:
            self.send_error(502, f"upstream unavailable: {error}")
            return

        data = b"" if head_only else response.read()
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
