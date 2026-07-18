param(
    [string]$CoreApiBaseUrl = $(if ($env:CORE_API_BASE_URL) { $env:CORE_API_BASE_URL } else { "http://127.0.0.1:8000" }),
    [string]$DeviceId = $(if ($env:DEVICE_ID) { $env:DEVICE_ID } else { "orangepi4pro-dev-01" }),
    [string]$AudioSource = $(if ($env:DEVICE_TEST_AUDIO_SOURCE) { $env:DEVICE_TEST_AUDIO_SOURCE } else { "" })
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"
$tokenLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^ADMIN_API_TOKEN=' } | Select-Object -First 1
if (-not $tokenLine) {
    throw "ADMIN_API_TOKEN is missing from .env"
}
$adminToken = $tokenLine.Substring("ADMIN_API_TOKEN=".Length).Trim()
if (-not $adminToken) {
    throw "ADMIN_API_TOKEN is empty"
}

$headers = @{ Authorization = "Bearer $adminToken" }
$base = $CoreApiBaseUrl.TrimEnd('/')

function Invoke-DeviceCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][hashtable]$Arguments
    )

    $body = @{ name = $Name; arguments = $Arguments } | ConvertTo-Json -Depth 8 -Compress
    $issued = Invoke-RestMethod -Method Post -Uri "$base/api/v1/devices/$DeviceId/commands" `
        -Headers $headers -ContentType "application/json" -Body $body
    $deadline = (Get-Date).AddSeconds(35)
    do {
        Start-Sleep -Milliseconds 200
        $result = Invoke-RestMethod -Uri "$base/api/v1/commands/$($issued.command_id)" -Headers $headers
    } while ($result.state -eq "sent" -and (Get-Date) -lt $deadline)
    if ($result.state -eq "sent") {
        throw "$Name did not finish within 35 seconds"
    }
    [pscustomobject]@{
        command_id = $result.command_id
        name = $result.name
        state = $result.state
        ok = if ($null -ne $result.result) { $result.result.ok } else { $false }
        error = if ($null -ne $result.result) { $result.result.error } else { $null }
        result = $result.result
    }
}

$status = Invoke-DeviceCommand -Name "get_status" -Arguments @{}
$presentation = Invoke-DeviceCommand -Name "set_display_mode" -Arguments @{ mode = "presentation" }
$capture = Invoke-DeviceCommand -Name "capture_snapshot" -Arguments @{}
if (-not $capture.ok -or -not $capture.result.snapshot.path) {
    throw "capture_snapshot failed: $($capture.error)"
}
$snapshotPath = [string]$capture.result.snapshot.path
$shown = Invoke-DeviceCommand -Name "show_artifact" -Arguments @{
    source = $snapshotPath
    media_type = "image"
}
$stopped = Invoke-DeviceCommand -Name "stop_artifact" -Arguments @{}

$audio = $null
$audioStopped = $null
if ($AudioSource) {
    $audio = Invoke-DeviceCommand -Name "play_audio" -Arguments @{
        source = $AudioSource
        volume = 80
    }
    $audioStopped = Invoke-DeviceCommand -Name "stop_audio" -Arguments @{}
}

@{
    device_id = $DeviceId
    status = $status.state
    presentation = $presentation.state
    capture = [pscustomobject]@{
        state = $capture.state
        ok = $capture.ok
        path = $snapshotPath
        size_bytes = $capture.result.snapshot.size_bytes
        width = $capture.result.snapshot.width
        height = $capture.result.snapshot.height
    }
    show_artifact = $shown.state
    stop_artifact = $stopped.state
    play_audio = if ($audio) { $audio.state } else { "skipped: set DEVICE_TEST_AUDIO_SOURCE" }
    stop_audio = if ($audioStopped) { $audioStopped.state } else { "skipped" }
} | ConvertTo-Json -Depth 5
