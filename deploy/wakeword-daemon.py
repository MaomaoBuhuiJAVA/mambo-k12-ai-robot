#!/usr/bin/env python3
"""Run the local Chinese wake-word listener for the Mambo robot."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
from typing import Callable, Sequence
import urllib.request


DEFAULT_HOME = Path("/home/orangepi/.local/share/mambo-wakeword")


@dataclass(frozen=True)
class WakeWordConfig:
    home: Path = DEFAULT_HOME
    audio_device: str = "plughw:2,0"
    proxy_url: str = "http://127.0.0.1:3010/_mambo/wake"
    keywords_path: Path | None = None
    threshold: float = 0.35
    retry_seconds: float = 1.0
    heartbeat_seconds: float = 3.0
    handoff_poll_seconds: float = 0.25

    @property
    def runtime_dir(self) -> Path:
        return self.home / "runtime"

    @property
    def model_dir(self) -> Path:
        return self.home / "model"

    @property
    def keywords_file(self) -> Path:
        if self.keywords_path is not None:
            return self.keywords_path
        return self.home / "keywords.txt"

    @property
    def heartbeat_url(self) -> str:
        return f"{self.proxy_url.rstrip('/')}/heartbeat"

    @property
    def unavailable_url(self) -> str:
        return f"{self.proxy_url.rstrip('/')}/unavailable"


def build_spotter_command(config: WakeWordConfig) -> list[str]:
    model_dir = config.model_dir
    return [
        str(config.runtime_dir / "bin" / "sherpa-onnx-keyword-spotter-alsa"),
        f"--tokens={model_dir / 'tokens.txt'}",
        f"--encoder={model_dir / 'encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx'}",
        f"--decoder={model_dir / 'decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx'}",
        f"--joiner={model_dir / 'joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx'}",
        "--model-type=zipformer2",
        "--provider=cpu",
        "--num-threads=1",
        f"--keywords-file={config.keywords_file}",
        f"--keywords-threshold={config.threshold}",
        config.audio_device,
    ]


def is_keyword_detection(line: str) -> bool:
    normalized = line.lower()
    if "detected" in normalized and "keyword" in normalized:
        return True
    if re.search(r'"keyword"\s*:\s*"[^\"]+"', line):
        return True
    _, separator, payload = line.partition(":")
    if not separator:
        return False
    try:
        result = json.loads(payload)
    except json.JSONDecodeError:
        return False
    return isinstance(result, dict) and isinstance(result.get("keyword"), str) and bool(result["keyword"].strip())


def is_listener_ready(output: Sequence[str], audio_device: str) -> bool:
    """Sherpa owns the intended microphone only after both startup messages arrive."""
    return (
        any("Recording started!" in line for line in output)
        and any(f"Use recording device: {audio_device}" in line for line in output)
    )


def notify_browser(proxy_url: str) -> bool:
    request = urllib.request.Request(proxy_url, data=b"", method="POST")
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            return 200 <= response.status < 300
    except OSError:
        return False


def notify_listener_state(config: WakeWordConfig, ready: bool) -> bool:
    return notify_browser(config.heartbeat_url if ready else config.unavailable_url)


def start_heartbeat(
    config: WakeWordConfig,
    *,
    listening_ready: threading.Event,
    notify: Callable[[str], bool] = notify_browser,
) -> tuple[threading.Event, threading.Thread]:
    """Refresh only the health of a listener that has claimed the microphone."""
    stopped = threading.Event()

    def run() -> None:
        while not stopped.is_set():
            if listening_ready.is_set():
                notify(config.heartbeat_url)
            stopped.wait(config.heartbeat_seconds)

    thread = threading.Thread(target=run, name="mambo-wakeword-heartbeat", daemon=True)
    thread.start()
    return stopped, thread


def spotter_environment(config: WakeWordConfig) -> dict[str, str]:
    environment = os.environ.copy()
    library_dir = str(config.runtime_dir / "lib")
    current = environment.get("LD_LIBRARY_PATH", "")
    environment["LD_LIBRARY_PATH"] = f"{library_dir}:{current}" if current else library_dir
    return environment


def stop_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=2)


def browser_capture_state(config: WakeWordConfig) -> str | None:
    request = urllib.request.Request(config.proxy_url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            payload = json.loads(response.read())
    except (OSError, json.JSONDecodeError):
        return None
    state = payload.get("capture") if isinstance(payload, dict) else None
    return state if state in {"idle", "awaiting_claim", "capturing"} else None


def wait_for_browser_capture_release(
    config: WakeWordConfig,
    *,
    should_stop: Callable[[], bool],
    sleep: Callable[[float], None] = time.sleep,
    read_state: Callable[[WakeWordConfig], str | None] = browser_capture_state,
) -> None:
    """Do not reopen ALSA until the browser has released its claimed session."""
    while not should_stop():
        if read_state(config) not in {"awaiting_claim", "capturing"}:
            return
        sleep(config.handoff_poll_seconds)


def listen_once(config: WakeWordConfig, listening_ready: threading.Event) -> bool:
    listening_ready.clear()
    notify_listener_state(config, False)
    process = subprocess.Popen(
        build_spotter_command(config),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        env=spotter_environment(config),
    )
    try:
        assert process.stdout is not None
        startup_output: list[str] = []
        for line in process.stdout:
            print(line, end="", flush=True)
            startup_output.append(line)
            if not listening_ready.is_set() and is_listener_ready(startup_output, config.audio_device):
                listening_ready.set()
                notify_listener_state(config, True)
            if is_keyword_detection(line):
                listening_ready.clear()
                notify_listener_state(config, False)
                stop_process(process)
                return True
        return False
    finally:
        listening_ready.clear()
        notify_listener_state(config, False)
        stop_process(process)


def run_forever(
    config: WakeWordConfig,
    *,
    should_stop: Callable[[], bool],
    sleep: Callable[[float], None] = time.sleep,
) -> None:
    listening_ready = threading.Event()
    heartbeat_stop, heartbeat_thread = start_heartbeat(config, listening_ready=listening_ready)
    try:
        while not should_stop():
            detected = listen_once(config, listening_ready)
            if should_stop():
                return
            if detected:
                print("Wake word detected; transferring microphone to the browser.", flush=True)
                if notify_browser(config.proxy_url):
                    wait_for_browser_capture_release(config, should_stop=should_stop, sleep=sleep)
            else:
                sleep(config.retry_seconds)
    finally:
        heartbeat_stop.set()
        heartbeat_thread.join(timeout=2)


def parse_args(argv: Sequence[str] | None = None) -> WakeWordConfig:
    parser = argparse.ArgumentParser(description="Run the local Mambo wake-word listener")
    parser.add_argument("--home", type=Path, default=DEFAULT_HOME)
    parser.add_argument("--audio-device", default="plughw:2,0")
    parser.add_argument("--proxy-url", default="http://127.0.0.1:3010/_mambo/wake")
    parser.add_argument("--keywords-file", type=Path)
    parser.add_argument("--threshold", type=float, default=0.35)
    parser.add_argument("--heartbeat-seconds", type=float, default=3.0)
    parser.add_argument("--handoff-poll-seconds", type=float, default=0.25)
    args = parser.parse_args(argv)
    return WakeWordConfig(
        home=args.home,
        audio_device=args.audio_device,
        proxy_url=args.proxy_url,
        keywords_path=args.keywords_file.expanduser() if args.keywords_file else None,
        threshold=max(0.0, args.threshold),
        heartbeat_seconds=max(0.5, args.heartbeat_seconds),
        handoff_poll_seconds=max(0.05, args.handoff_poll_seconds),
    )


def main(argv: Sequence[str] | None = None) -> int:
    config = parse_args(argv)
    stopping = False

    def request_stop(*_args: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    run_forever(config, should_stop=lambda: stopping)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
