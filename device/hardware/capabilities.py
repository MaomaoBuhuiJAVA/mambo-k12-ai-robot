from __future__ import annotations

import shutil
from pathlib import Path
from typing import Callable


def detect_capabilities(
    *,
    camera_device: str,
    display_name: str,
    xauthority_path: str,
    path_exists: Callable[[Path], bool] = Path.exists,
    tool_lookup: Callable[[str], str | None] = shutil.which,
) -> dict[str, object]:
    def exists_any(paths: tuple[str, ...]) -> bool:
        return any(path_exists(Path(path)) for path in paths)

    camera_available = bool(camera_device) and path_exists(Path(camera_device))
    display_available = bool(display_name) and (
        not xauthority_path or path_exists(Path(xauthority_path))
    )
    return {
        "camera": {
            "available": camera_available,
            "device": camera_device if camera_available else None,
        },
        "display": {
            "available": display_available,
            "name": display_name if display_available else None,
            "xauthority": xauthority_path if display_available else None,
        },
        "mouse": {
            "available": False,
            "backend": "xtest",
        },
        "audio_playback": {
            "available": exists_any(("/dev/snd/pcmC0D0p", "/proc/asound/cards"))
        },
        "audio_capture": {
            "available": exists_any(("/dev/snd/pcmC0D0c", "/proc/asound/cards"))
        },
        "npu": {
            "available": path_exists(Path("/dev/vipcore")),
            "device": "/dev/vipcore" if path_exists(Path("/dev/vipcore")) else None,
        },
        "tools": {
            name: tool_lookup(name) is not None for name in ("ffmpeg", "mpv", "xset")
        },
    }
