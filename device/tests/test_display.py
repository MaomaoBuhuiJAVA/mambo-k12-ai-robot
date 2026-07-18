import asyncio

from device.hardware.display import DisplayAdapter
from device.hardware.process import ProcessResult


class FakeRunner:
    def __init__(self) -> None:
        self.calls: list[tuple[list[str], dict[str, str] | None]] = []

    async def run(
        self,
        argv: list[str],
        timeout_seconds: float,
        *,
        env: dict[str, str] | None = None,
    ) -> ProcessResult:
        self.calls.append((argv, env))
        return ProcessResult(returncode=0, stdout="", stderr="")


def test_display_adapter_controls_x11_modes() -> None:
    runner = FakeRunner()
    adapter = DisplayAdapter(
        display_name=":0",
        xauthority_path="/home/orangepi/.Xauthority",
        runner=runner,
    )

    assert asyncio.run(adapter.set_mode("on"))["mode"] == "on"
    assert asyncio.run(adapter.set_mode("presentation"))["mode"] == "presentation"
    assert asyncio.run(adapter.set_mode("off"))["mode"] == "off"

    assert runner.calls[0][0] == ["xset", "dpms", "force", "on"]
    assert runner.calls[1][0] == ["xset", "dpms", "force", "on"]
    assert runner.calls[2][0] == ["xset", "s", "off", "-dpms"]
    assert runner.calls[3][0] == ["xset", "dpms", "force", "off"]
    assert runner.calls[0][1] == {
        "DISPLAY": ":0",
        "XAUTHORITY": "/home/orangepi/.Xauthority",
    }
