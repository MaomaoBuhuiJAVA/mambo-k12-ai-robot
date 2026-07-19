from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import settings
from .database import create_schema, engine, session_factory
from .repositories import mark_all_devices_offline
from .routes.devices import router as device_router
from .routes.devices import websocket_router
from .routes.learning import router as learning_router
from .routes.voice import router as voice_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_schema:
        await create_schema()
    async with session_factory() as session:
        await mark_all_devices_offline(session)
    yield
    await engine.dispose()


app = FastAPI(
    title="Mambo K12 AI Robot API",
    version="0.2.0",
    lifespan=lifespan,
)
app.include_router(device_router)
app.include_router(learning_router)
app.include_router(voice_router)
app.include_router(websocket_router)


@app.get("/api/v1/health", tags=["system"])
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "mambo-k12-api",
        "database": "configured",
    }
