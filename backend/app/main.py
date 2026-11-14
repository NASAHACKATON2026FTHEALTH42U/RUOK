import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app import clock
from app.db import engine, init_db
from app.routers import health
from app.services.app_state import restore_clock


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_db()
    with Session(engine) as session:
        restore_clock(session)
    yield


app = FastAPI(title="RUOK API", version="0.1.0", lifespan=lifespan)

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


api = APIRouter(prefix="/api/v1")
api.include_router(health.router)
app.include_router(api)
