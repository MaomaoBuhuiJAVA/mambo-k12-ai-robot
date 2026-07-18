from __future__ import annotations

import pytest

from device.hardware.mouse import MouseAdapter, MouseConfig
from device.hardware.process import ProcessExecutionError


class FakeBackend:
    width = 800
    height = 480

    def __init__(self) -> None:
        self.moves: list[tuple[int, int]] = []
        self.clicks = 0

    def move(self, x: int, y: int) -> None:
        self.moves.append((x, y))

    def click(self) -> None:
        self.clicks += 1

    def close(self) -> None:
        return None


def test_mouse_adapter_converts_normalized_coordinates_and_clamps_edges() -> None:
    backend = FakeBackend()
    adapter = MouseAdapter(MouseConfig(display_name=":0"), backend=backend)

    assert adapter.move(0.25, 0.5) == {"x": 0.25, "y": 0.5, "screen_width": 800, "screen_height": 480}
    assert adapter.move(2, -1)["x"] == 1.0
    assert backend.moves == [(200, 240), (799, 0)]


def test_mouse_adapter_rejects_non_finite_coordinates() -> None:
    adapter = MouseAdapter(MouseConfig(display_name=":0"), backend=FakeBackend())

    with pytest.raises(ProcessExecutionError) as exc_info:
        adapter.move(float("nan"), 0.2)

    assert exc_info.value.code == "invalid_arguments"


def test_mouse_adapter_rate_limits_clicks() -> None:
    backend = FakeBackend()
    now = [10.0]
    adapter = MouseAdapter(
        MouseConfig(display_name=":0", click_cooldown_seconds=0.5),
        backend=backend,
        clock=lambda: now[0],
    )

    assert adapter.click() == {"button": "left"}
    with pytest.raises(ProcessExecutionError) as exc_info:
        adapter.click()
    assert exc_info.value.code == "click_rate_limited"
    now[0] += 0.5
    assert adapter.click() == {"button": "left"}
    assert backend.clicks == 2
