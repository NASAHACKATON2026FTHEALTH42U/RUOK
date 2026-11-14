import asyncio
import contextlib
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app import clock
from app.db import engine, init_db
from app.routers import alerts, auth, catalog, game, health, members, realtime
from app.routers.deps import device_id_header
from app.seed import ensure_seeded
from app.services import catalog as catalog_service
from app.services import environments, events, liveness_watch
from app.services.app_state import restore_clock


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    with Session(engine) as session:
        restore_clock(session)
        ensure_seeded(session)  # BD vacía → seed de demo (BE-07)
        events.purge_old(session)  # bitácora: solo los últimos 7 días (BE-28)
    environments.list_environments()  # valida app/data/environments.json al arrancar
    catalog_service.list_indicators()  # valida indicators.json y systems.json (y su coherencia)
    watcher = None
    if liveness_watch.watch_enabled():  # R U OK? y no_contact (BE-16)
        watcher = asyncio.create_task(liveness_watch.watch_loop(engine))
    yield
    if watcher is not None:
        watcher.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await watcher


app = FastAPI(
    title="RUOK API",
    version="0.1.0",
    description="Servidor de a bordo de R U OK?. Contrato: docs/api-contract.md. "
    "Los endpoints marcados STUB(FS-02) devuelven datos de ejemplo hasta su issue.",
    lifespan=lifespan,
)

# CORS abierto en desarrollo. Se puede restringir con CORS_ORIGINS="http://a,http://b".
_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Server-Time"],
)


@app.middleware("http")
async def add_server_time_header(request: Request, call_next):
    """Todas las respuestas llevan la hora del reloj de la demo."""
    response = await call_next(request)
    response.headers["X-Server-Time"] = clock.now().isoformat()
    return response


# X-Device-Id se declara en todas las rutas (docs/control-center-and-devices.md §4).
api = APIRouter(prefix="/api/v1", dependencies=[Depends(device_id_header)])
api.include_router(health.router)
api.include_router(auth.router)
api.include_router(catalog.router)
api.include_router(members.router)
api.include_router(alerts.router)
api.include_router(game.router)
api.include_router(realtime.router)
api.include_router(realtime.public)
app.include_router(api)
