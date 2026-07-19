from __future__ import annotations

import subprocess
from types import SimpleNamespace

from device.vision.npu_smoke import NpuSmokeConfig, run_npu_smoke


def test_npu_smoke_runs_the_vendor_sample_and_parses_latency() -> None:
    calls: list[tuple[list[str], dict[str, object]]] = []

    def fake_runner(command: list[str], **kwargs: object) -> SimpleNamespace:
        calls.append((command, kwargs))
        return SimpleNamespace(
            returncode=0,
            stdout="run network done...\nprofile inference time=2904us, cycle=2863791\n",
            stderr="",
        )

    result = run_npu_smoke(
        NpuSmokeConfig(executable="/opt/vpm_run/vpm_run", sample_file="/opt/vpm_run/sample.txt"),
        runner=fake_runner,
    )

    assert result.status == "passed"
    assert result.inference_us == 2904
    assert calls[0][0] == ["/opt/vpm_run/vpm_run", "-s", "/opt/vpm_run/sample.txt", "-l", "1", "-b", "1"]
    assert calls[0][1]["timeout"] == 30


def test_npu_smoke_reports_timeout_without_raising() -> None:
    def fake_runner(command: list[str], **kwargs: object) -> SimpleNamespace:
        raise subprocess.TimeoutExpired(command, 30)

    result = run_npu_smoke(NpuSmokeConfig(), runner=fake_runner)

    assert result.status == "timed_out"
    assert result.returncode is None
