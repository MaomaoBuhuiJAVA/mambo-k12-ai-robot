from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _normalized_script(path: str) -> str:
    return " ".join((ROOT / path).read_text(encoding="utf-8").split())


def test_powershell_start_script_loads_same_env_for_migrations_and_server() -> None:
    script = _normalized_script("scripts/start-server.ps1")

    dotenv_prefix = "& $python -m dotenv -f $envFile run -- $python -m"
    assert f"{dotenv_prefix} alembic upgrade head" in script
    assert f"{dotenv_prefix} uvicorn server.app.main:app" in script


def test_bash_start_script_loads_same_env_for_migrations_and_server() -> None:
    script = _normalized_script("scripts/start-server.sh")

    dotenv_prefix = ".venv/bin/python -m dotenv -f .env run -- .venv/bin/python -m"
    assert f"{dotenv_prefix} alembic upgrade head" in script
    assert f"exec {dotenv_prefix} uvicorn server.app.main:app" in script
