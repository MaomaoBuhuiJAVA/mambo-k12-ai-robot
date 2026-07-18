from __future__ import annotations

import os
import sys
from pathlib import Path
from argparse import ArgumentParser

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from device.hardware.mouse import MouseAdapter, MouseConfig


def main() -> int:
    parser = ArgumentParser(description="Verify XTest pointer control on the OrangePi display")
    parser.add_argument("--click", action="store_true", help="perform one left click after moving to the center")
    args = parser.parse_args()
    adapter = MouseAdapter(
        MouseConfig(
            display_name=os.getenv("DISPLAY", ":0"),
            xauthority_path=os.getenv("XAUTHORITY", ""),
        )
    )
    try:
        result = adapter.move(0.5, 0.5)
        if args.click:
            adapter.click()
    finally:
        adapter.close()
    print(
        "xtest=passed screen=%sx%s click=%s"
        % (result["screen_width"], result["screen_height"], str(args.click).lower())
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
