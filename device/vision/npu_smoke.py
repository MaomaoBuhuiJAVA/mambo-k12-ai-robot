from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Sequence


@dataclass(frozen=True)
class NpuSmokeConfig:
    executable: str = "/opt/vpm_run/vpm_run"
    sample_file: str = "/opt/vpm_run/sample.txt"
    working_dir: str = "/opt/vpm_run"
    timeout_seconds: int = 30


@dataclass(frozen=True)
class NpuSmokeResult:
    status: str
    command: tuple[str, ...]
    returncode: int | None
    elapsed_ms: int
    inference_us: int | None
    output: str


Runner = Callable[..., subprocess.CompletedProcess[str]]


def _inference_time_us(output: str) -> int | None:
    match = re.search(r"profile inference time=(\d+)us", output)
    return int(match.group(1)) if match else None


def run_npu_smoke(
    config: NpuSmokeConfig = NpuSmokeConfig(),
    *,
    runner: Runner = subprocess.run,
) -> NpuSmokeResult:
    command = (config.executable, "-s", config.sample_file, "-l", "1", "-b", "1")
    started = time.perf_counter()
    try:
        completed = runner(
            list(command),
            cwd=config.working_dir,
            capture_output=True,
            text=True,
            timeout=config.timeout_seconds,
            check=False,
        )
        output = ((completed.stdout or "") + (completed.stderr or "")).strip()
        status = "passed" if completed.returncode == 0 else "failed"
        return NpuSmokeResult(
            status=status,
            command=command,
            returncode=completed.returncode,
            elapsed_ms=round((time.perf_counter() - started) * 1000),
            inference_us=_inference_time_us(output),
            output=output[-4000:],
        )
    except subprocess.TimeoutExpired as error:
        output = " ".join(
            value.decode(errors="replace") if isinstance(value, bytes) else str(value)
            for value in (error.stdout, error.stderr)
            if value
        )
        return NpuSmokeResult(
            status="timed_out",
            command=command,
            returncode=None,
            elapsed_ms=round((time.perf_counter() - started) * 1000),
            inference_us=None,
            output=output[-4000:],
        )
    except OSError as error:
        return NpuSmokeResult(
            status="unavailable",
            command=command,
            returncode=None,
            elapsed_ms=round((time.perf_counter() - started) * 1000),
            inference_us=None,
            output=str(error),
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the vendor VIPLite NPU smoke sample")
    parser.add_argument("--executable", default=NpuSmokeConfig.executable)
    parser.add_argument("--sample-file", default=NpuSmokeConfig.sample_file)
    parser.add_argument("--working-dir", default=NpuSmokeConfig.working_dir)
    parser.add_argument("--timeout", type=int, default=NpuSmokeConfig.timeout_seconds)
    args = parser.parse_args(argv)
    result = run_npu_smoke(
        NpuSmokeConfig(
            executable=args.executable,
            sample_file=args.sample_file,
            working_dir=args.working_dir,
            timeout_seconds=max(1, args.timeout),
        )
    )
    print(json.dumps(asdict(result), ensure_ascii=False))
    return 0 if result.status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
