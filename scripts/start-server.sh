#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -x .venv/bin/python ]]; then
  echo "Missing .venv. Create it and install server/requirements-dev.txt first." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example and set unique tokens first." >&2
  exit 1
fi

exec .venv/bin/python -m uvicorn server.app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --env-file .env

