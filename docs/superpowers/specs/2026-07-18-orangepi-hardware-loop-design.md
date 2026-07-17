# OrangePi Hardware Command Loop Design

## 1. Purpose

This design extends the existing authenticated OrangePi WebSocket agent from
`ping` and `get_status` into a small, safe hardware command loop. The server can
request a camera snapshot, show teaching media, play audio, and control the
display. The device returns a structured result that is persisted by the
existing command API.

The work follows the product architecture in `docs/product-technical-design.md`:

- The web application and Core API remain the main product and business source
  of truth.
- The OrangePi remains a voice, vision, display, and hardware endpoint.
- The device executes only versioned, allow-listed teaching actions.
- The device never executes model-generated Shell or arbitrary commands.

## 2. Current State

The repository and deployed board already provide:

- authenticated device WebSocket connection;
- heartbeat, status reporting, reconnect, and systemd supervision;
- server-side device, status, command, and learning-data persistence;
- `ping` and `get_status` command round trips;
- a working USB V4L2 camera at `/dev/video0`;
- working `ffmpeg`, `mpv`, and X11 display `:0`;
- working playback and capture ALSA devices;
- a working `/dev/vipcore` NPU runtime.

The current Windows Core API and `orangepi4pro-dev-01` connection have been
verified with a completed server-to-device `ping` command.

## 3. Scope

### 3.1 Goals

Add these device commands:

| Command | Purpose |
|---|---|
| `capture_snapshot` | Warm up the camera, save one JPEG in the managed media directory, and return metadata. |
| `show_artifact` | Show a managed local image/video or an allowed HTTP(S) resource full screen. |
| `stop_artifact` | Stop only the artifact player owned by the device agent. |
| `play_audio` | Play a managed local audio file or an allowed HTTP(S) resource. |
| `stop_audio` | Stop only the audio player owned by the device agent. |
| `set_display_mode` | Wake the screen, enter persistent presentation mode, or turn the display off. |

Also:

- advertise detected camera, display, audio, NPU, and tool capabilities in the
  `hello` message;
- include hardware availability and owned-player state in status reports;
- validate command arguments on both server and device;
- enforce command-specific timeouts and structured errors;
- make repeated command IDs idempotent for the lifetime of the agent process;
- update protocol documentation, deployment configuration, and tests;
- deploy to the real board and verify every command through the server API.

### 3.2 Non-goals

This increment does not implement:

- gesture recognition, hand tracking, or pointer events;
- ASR, TTS generation, wake-word detection, or microphone streaming;
- a robot Kiosk web application or browser installation;
- media upload to object storage;
- arbitrary local paths, arbitrary executables, or remote Shell;
- automatic PowerPoint rendering on the board;
- custom NPU model conversion or YOLO dependency repair.

PPT, DOCX, storybook, and video assets are generated or uploaded elsewhere.
The board consumes finished images, videos, HTML pages, and audio resources.

## 4. Architecture

```text
FastAPI command API
  -> validated allow-listed command
  -> authenticated device WebSocket
  -> DeviceCommandDispatcher
       -> CameraAdapter
       -> ArtifactPlayer
       -> AudioPlayer
       -> DisplayAdapter
       -> CapabilityDetector
  -> structured command_result
  -> persisted CommandRecord
```

`device/agent.py` remains responsible only for connection lifecycle, message
dispatch, status scheduling, and result delivery. Hardware behavior moves into
focused modules under `device/hardware/`.

```text
device/
  agent.py
  commands.py              command names, device-side validation, error model
  hardware/
    capabilities.py        tool and device-node discovery
    camera.py              V4L2/ffmpeg snapshot adapter
    media.py               owned mpv artifact/audio processes
    display.py             X11 display and DPMS control
    process.py             safe argv execution, timeout, process cleanup
```

No adapter accepts a Shell command string. External programs are launched with
an argument list and `shell=False`.

## 5. Configuration

The existing environment file gains:

```text
MEDIA_ROOT=/home/orangepi/.local/share/mambo/media
CAMERA_DEVICE=/dev/video0
CAMERA_WIDTH=1920
CAMERA_HEIGHT=1080
CAMERA_FPS=30
CAMERA_WARMUP_FRAMES=120
DISPLAY_NAME=:0
XAUTHORITY_PATH=/home/orangepi/.Xauthority
MEDIA_ALLOWED_HOSTS=192.168.1.18
COMMAND_TIMEOUT_SECONDS=30
```

Rules:

- `MEDIA_ROOT` is created by the agent and contains `snapshots/` and optional
  provisioned teaching media.
- Local media must resolve inside `MEDIA_ROOT`, including after symlink and
  `..` resolution.
- Remote media must use `http` or `https`, contain no embedded credentials, and
  match `MEDIA_ALLOWED_HOSTS`.
- Secrets remain in the existing environment file and are never included in
  capability or command results.

## 6. Command Contracts

All commands retain the existing envelope and `command_id`. Results add
`duration_ms` and use stable error codes.

### 6.1 `capture_snapshot`

Arguments:

```json
{}
```

The first version does not accept a device path, output path, or ffmpeg flags.
The configured camera is streamed until the warm-up frame count is reached, then
one JPEG is written atomically as:

```text
MEDIA_ROOT/snapshots/<command_id>.jpg
```

Successful result:

```json
{
  "command_id": "...",
  "ok": true,
  "duration_ms": 4300,
  "snapshot": {
    "path": "/home/orangepi/.local/share/mambo/media/snapshots/<id>.jpg",
    "content_type": "image/jpeg",
    "width": 1920,
    "height": 1080,
    "size_bytes": 123456,
    "captured_at": "2026-07-18T00:00:00Z"
  }
}
```

The temporary file is removed on failure. Existing files are not overwritten
unless they belong to the same replayed `command_id`.

### 6.2 `show_artifact`

Arguments:

```json
{
  "source": "https://allowed-host/path/image.jpg",
  "media_type": "image"
}
```

`media_type` is `image` or `video`. Images remain visible until replaced or
stopped. Videos play once by default. Playback is full screen and uses the
configured X11 session. Starting a new artifact stops only the previous artifact
player owned by the agent.

### 6.3 `stop_artifact`

Arguments are empty. The command is successful when no artifact is running, so
retries are safe.

### 6.4 `play_audio`

Arguments:

```json
{
  "source": "https://allowed-host/path/narration.mp3",
  "volume": 80
}
```

`volume` is optional and limited to `0..100`. Starting new audio replaces only
the audio player owned by the agent. It does not change the system mixer.

### 6.5 `stop_audio`

Arguments are empty. The command is successful when no owned audio is running.

### 6.6 `set_display_mode`

Arguments:

```json
{"mode": "presentation"}
```

Modes:

- `on`: force the display on;
- `presentation`: force the display on and disable X11 screen blanking/DPMS for
  the current desktop session;
- `off`: force the display off through DPMS.

This command does not modify boot configuration and does not require `sudo`.

## 7. Capability And Status Reporting

The `hello.payload` keeps `agent_version`, `platform`, and `capabilities`, and
adds a `hardware` object:

```json
{
  "camera": {"available": true, "device": "/dev/video0"},
  "display": {"available": true, "name": ":0"},
  "audio_playback": {"available": true},
  "audio_capture": {"available": true},
  "npu": {"available": true, "device": "/dev/vipcore"},
  "tools": {"ffmpeg": true, "mpv": true, "xset": true}
}
```

Status reports add only low-volume operational state:

```json
{
  "hardware": {"camera_available": true, "display_available": true},
  "players": {"artifact_active": false, "audio_active": false}
}
```

No continuous camera frames, microphone samples, local directory listings, or
environment variables are reported.

## 8. Execution, Idempotency, And Errors

The dispatcher keeps the most recent 128 results by `command_id`. A duplicate
within the same agent process returns the cached result without repeating the
hardware action.

Command-specific execution is bounded by `COMMAND_TIMEOUT_SECONDS`. Owned child
processes run in their own process group. Stop, replacement, timeout, and agent
shutdown first request graceful termination and then force termination after a
short grace period.

Stable device error codes:

| Code | Meaning |
|---|---|
| `unsupported_command` | Command is not in the device allow list. |
| `invalid_arguments` | Arguments fail type, enum, range, or extra-field checks. |
| `source_not_allowed` | URL host/scheme or local path is outside policy. |
| `tool_unavailable` | Required executable is missing. |
| `device_unavailable` | Camera, display, or audio device is unavailable. |
| `command_timeout` | The bounded operation exceeded its timeout. |
| `capture_failed` | ffmpeg exited unsuccessfully or produced no valid JPEG. |
| `playback_failed` | mpv failed to start or exited immediately with an error. |
| `display_failed` | X11/DPMS control failed. |
| `internal_error` | Unexpected failure with a sanitized message. |

Results never return tokens, complete environment variables, arbitrary command
output, or stack traces. Detailed diagnostics remain in the local systemd log.

## 9. Server Changes

The server command name literal is expanded to the new commands. Each command
has a Pydantic argument model with `extra="forbid"`. The API normalizes validated
arguments before persistence and delivery.

The command state model adds `timed_out` to match the product design. Hardware
operations normally report device-side timeouts as failed results with
`command_timeout`. A server-side stale-command reconciliation path marks a
still-`sent` command as `timed_out` after its deadline, covering disconnects and
lost results. Late results are logged and do not overwrite the terminal state.

Database changes use a new Alembic migration. Existing command rows remain
valid.

## 10. Data Flows

### 10.1 Snapshot And Display

```text
Admin/test client -> POST capture_snapshot
Core API -> command WebSocket message
Agent -> validate -> CameraAdapter -> JPEG
Agent -> command_result(snapshot metadata)
Core API -> persist completed result
Admin/test client -> POST show_artifact(local snapshot path)
Agent -> validate managed path -> ArtifactPlayer
Agent -> command_result(player state)
```

### 10.2 Remote Teaching Media

```text
Core API -> show_artifact/play_audio with allowed signed URL
Agent -> validate scheme and host
mpv -> fetch and play resource
Agent -> return startup result
```

The command result confirms that playback started, not that a student consumed
the entire resource. Completion events belong to the later Kiosk/session design.

## 11. Testing

### 11.1 Automated Tests

- command schema accepts every valid command and rejects unknown fields,
  invalid enums, volume ranges, and unsupported names;
- source policy accepts managed files and configured hosts, and rejects path
  traversal, symlink escape, credentials, and unapproved hosts;
- fake process runner verifies exact argv without launching hardware tools;
- camera adapter verifies warm-up selection, atomic output, timeout, and cleanup;
- media adapters verify replacement, no-op stop, and owned-process cleanup;
- display adapter verifies all three modes and sanitized failures;
- dispatcher verifies duplicate command IDs replay cached results;
- gateway test verifies delivery and persistence for each command family;
- stale-command test verifies `sent -> timed_out` and ignores late overwrite;
- existing learning and device tests remain green.

### 11.2 Real Board Acceptance

From the Windows Core API, without SSH-side manual execution:

1. `get_status` reports the real board and detected hardware.
2. `set_display_mode(presentation)` wakes the screen and disables blanking.
3. `capture_snapshot` produces a non-empty 1920x1080 JPEG after warm-up.
4. `show_artifact` displays that snapshot full screen.
5. `stop_artifact` returns the desktop and is safe to repeat.
6. `play_audio` starts a known local or server-hosted audio sample.
7. `stop_audio` stops it and is safe to repeat.
8. Invalid paths, hosts, arguments, and command names are rejected.
9. Disconnecting and restoring the server causes the agent to reconnect within
   the existing 30-second backoff ceiling.
10. systemd reports the agent active after deployment and restart.

Each acceptance action is verified through the persisted command record and
board logs. Camera and display results are also visually inspected.

## 12. Deployment

Deployment updates only repository-owned files and the device environment
configuration. The existing private token is preserved and never printed.

Expected sequence:

1. run the full local test suite;
2. synchronize the changed device files to `/opt/mambo-k12-ai-robot`;
3. update non-secret environment keys in `/etc/mambo/device-agent.env` while
   preserving existing secret values;
4. restart `mambo-device-agent.service`;
5. inspect service status and recent logs;
6. execute the real board acceptance sequence through the Core API.

Any operation requiring `sudo` is requested explicitly before execution. The
deployment never performs `reboot`, `shutdown`, recursive deletion, or arbitrary
remote Shell execution.

## 13. Future Gesture, Voice, And Kiosk Integration

The later robot web application is a dedicated 800x480 Kiosk interface, not a
scaled copy of the desktop learning workspace.

Future gesture recognition runs as a local input provider and emits normalized
events such as:

```text
pointer_move(x, y, confidence)
click_progress(progress)
click_confirmed(x, y)
tracking_lost
```

An open hand moves the cursor. A fist starts dwell confirmation, shows a circular
progress indicator, and emits one click only after the threshold is reached.
Opening the hand or losing tracking cancels progress. Voice handles semantic
commands and questions; gestures handle local navigation and confirmation.

These events target the Kiosk page and do not become privileged device commands.
This keeps noisy vision input separated from server-authorized camera, display,
and audio actions.

## 14. Acceptance Definition

The increment is complete only when:

- all automated tests pass;
- the new protocol and environment options are documented;
- the deployed board advertises truthful capabilities;
- every allow-listed hardware command completes through the server API;
- command results and failures are persisted with no secret leakage;
- unauthorized sources and malformed arguments are rejected;
- the service reconnects and remains supervised by systemd;
- no `sudo`, reboot, shutdown, or destructive operation occurs without explicit
  user authorization.
