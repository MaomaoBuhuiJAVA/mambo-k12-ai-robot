param(
    [string]$SshTarget = $(if ($env:ORANGEPI_SSH_TARGET) { $env:ORANGEPI_SSH_TARGET } else { "orangepi" }),
    [string]$RemoteDir = $(if ($env:ORANGEPI_NPU_DIR) { $env:ORANGEPI_NPU_DIR } else { "/opt/vpm_run" })
)

$ErrorActionPreference = "Stop"
$remoteCommand = "cd '$RemoteDir' && timeout 30s ./vpm_run -s sample.txt -l 1 -b 1"
$outputLines = @(& ssh -o BatchMode=yes -o ConnectTimeout=8 $SshTarget $remoteCommand 2>&1)
if ($LASTEXITCODE -ne 0) {
    throw "OrangePi NPU smoke failed with exit code $LASTEXITCODE`n$($outputLines -join [Environment]::NewLine)"
}

$output = $outputLines -join [Environment]::NewLine
$match = [regex]::Match($output, "profile inference time=(\d+)us")
[pscustomobject]@{
    target = $SshTarget
    sample = "$RemoteDir/sample.txt"
    status = "passed"
    inference_us = if ($match.Success) { [int]$match.Groups[1].Value } else { $null }
    output = $output
} | ConvertTo-Json -Depth 5
