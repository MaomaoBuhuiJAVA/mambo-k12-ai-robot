$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$envFile = Join-Path $root ".env"

if (-not (Test-Path $python)) {
    throw "Missing .venv. Create it and install server/requirements-dev.txt first."
}
if (-not (Test-Path $envFile)) {
    throw "Missing .env. Copy .env.example and set unique tokens first."
}

Set-Location $root
& $python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
& $python -m uvicorn server.app.main:app --host 0.0.0.0 --port 8000 --env-file .env
