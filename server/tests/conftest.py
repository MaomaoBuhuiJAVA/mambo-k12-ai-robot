from __future__ import annotations

import os
import tempfile
from pathlib import Path
from uuid import uuid4

import pytest


TEST_DATABASE_PATH = Path(tempfile.gettempdir()) / f"mambo-api-{uuid4()}.db"

os.environ["DEVICE_AUTH_TOKEN"] = "test-device-token-123456"
os.environ["ADMIN_API_TOKEN"] = "test-admin-token-123456"
os.environ["DATABASE_URL"] = (
    f"sqlite+aiosqlite:///{TEST_DATABASE_PATH.as_posix()}"
)
os.environ["AUTO_CREATE_SCHEMA"] = "true"


@pytest.fixture(scope="session", autouse=True)
def remove_test_database() -> None:
    yield
    TEST_DATABASE_PATH.unlink(missing_ok=True)
