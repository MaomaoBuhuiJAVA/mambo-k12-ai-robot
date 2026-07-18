from __future__ import annotations

import ctypes
import ctypes.util
import math
import os
import time
from dataclasses import dataclass
from typing import Callable, Protocol

from .process import ProcessExecutionError


class MouseBackend(Protocol):
    width: int
    height: int

    def move(self, x: int, y: int) -> None: ...

    def click(self) -> None: ...

    def close(self) -> None: ...


class XTestBackend:
    """Small ctypes wrapper so XTest works without python-xlib or xdotool."""

    def __init__(self, display_name: str, xauthority_path: str = "") -> None:
        x11_name = ctypes.util.find_library("X11") or "libX11.so.6"
        xtst_name = ctypes.util.find_library("Xtst") or "libXtst.so.6"
        try:
            self._x11 = ctypes.CDLL(x11_name)
            self._xtst = ctypes.CDLL(xtst_name)
        except OSError as exc:
            raise ProcessExecutionError("XTest libraries are unavailable", code="mouse_unavailable") from exc

        self._x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
        self._x11.XOpenDisplay.restype = ctypes.c_void_p
        self._x11.XDefaultScreen.argtypes = [ctypes.c_void_p]
        self._x11.XDefaultScreen.restype = ctypes.c_int
        self._x11.XDisplayWidth.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self._x11.XDisplayWidth.restype = ctypes.c_int
        self._x11.XDisplayHeight.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self._x11.XDisplayHeight.restype = ctypes.c_int
        self._x11.XFlush.argtypes = [ctypes.c_void_p]
        self._x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
        self._xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
        self._xtst.XTestFakeMotionEvent.restype = ctypes.c_int
        self._xtst.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
        self._xtst.XTestFakeButtonEvent.restype = ctypes.c_int

        display = display_name.encode() if display_name else None
        previous_xauthority = os.environ.get("XAUTHORITY")
        if xauthority_path:
            os.environ["XAUTHORITY"] = xauthority_path
        try:
            self._display = self._x11.XOpenDisplay(display)
        finally:
            if previous_xauthority is None:
                os.environ.pop("XAUTHORITY", None)
            else:
                os.environ["XAUTHORITY"] = previous_xauthority
        if not self._display:
            raise ProcessExecutionError("X display is unavailable", code="mouse_unavailable")
        self._screen = self._x11.XDefaultScreen(self._display)
        self.width = self._x11.XDisplayWidth(self._display, self._screen)
        self.height = self._x11.XDisplayHeight(self._display, self._screen)
        if self.width <= 0 or self.height <= 0:
            self.close()
            raise ProcessExecutionError("X display dimensions are invalid", code="mouse_unavailable")

    def move(self, x: int, y: int) -> None:
        if not self._xtst.XTestFakeMotionEvent(self._display, -1, x, y, 0):
            raise ProcessExecutionError("XTest pointer move failed", code="mouse_failed")
        self._x11.XFlush(self._display)

    def click(self) -> None:
        if not self._xtst.XTestFakeButtonEvent(self._display, 1, 1, 0):
            raise ProcessExecutionError("XTest button press failed", code="mouse_failed")
        if not self._xtst.XTestFakeButtonEvent(self._display, 1, 0, 0):
            raise ProcessExecutionError("XTest button release failed", code="mouse_failed")
        self._x11.XFlush(self._display)

    def close(self) -> None:
        if getattr(self, "_display", None):
            self._x11.XCloseDisplay(self._display)
            self._display = None


@dataclass(frozen=True)
class MouseConfig:
    display_name: str
    xauthority_path: str = ""
    click_cooldown_seconds: float = 0.5


class MouseAdapter:
    def __init__(
        self,
        config: MouseConfig,
        *,
        backend: MouseBackend | None = None,
        backend_factory: Callable[[str, str], MouseBackend] = XTestBackend,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.config = config
        self.backend = backend or backend_factory(config.display_name, config.xauthority_path)
        self.clock = clock
        self._last_click_at: float | None = None

    def move(self, x: float, y: float) -> dict[str, object]:
        if not math.isfinite(x) or not math.isfinite(y):
            raise ProcessExecutionError("pointer coordinates are invalid", code="invalid_arguments")
        normalized_x = min(1.0, max(0.0, x))
        normalized_y = min(1.0, max(0.0, y))
        screen_x = round(normalized_x * max(0, self.backend.width - 1))
        screen_y = round(normalized_y * max(0, self.backend.height - 1))
        self.backend.move(screen_x, screen_y)
        return {
            "x": normalized_x,
            "y": normalized_y,
            "screen_width": self.backend.width,
            "screen_height": self.backend.height,
        }

    def click(self) -> dict[str, str]:
        now = self.clock()
        if self._last_click_at is not None and now - self._last_click_at < self.config.click_cooldown_seconds:
            raise ProcessExecutionError("mouse click is rate limited", code="click_rate_limited")
        self.backend.click()
        self._last_click_at = now
        return {"button": "left"}

    def close(self) -> None:
        self.backend.close()
