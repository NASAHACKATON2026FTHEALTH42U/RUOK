"""Tiempo real, dispositivos, centro de control, enlace, sistema y demo.

Reales: enlace (BE-13), demo (BE-07), fast-forward (app/clock.py) y eventos/SSE (BE-28).
STUB(FS-02) → BE-29 (dispositivos) y BE-30 (control y network-info);
en /control/overview el `link` ya es real.
"""

import asyncio
import json
import os
import time
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app import clock, models, seed, stubs
from app.db import engine, get_session
from app.routers.deps import (
    ERRORS_404,
    ERRORS_AUTH,
    AdminDep,
    AuthDep,
    CurrentUser,
    check_env,
    stream_user,
)
from app.schemas import (
    ControlOverview,
    DemoClock,
    DemoLinkIn,
    Device,
    Event,
    EventType,
    FastForwardIn,
    LinkDirection,
    LinkMessage,
    LinkStatus,
    LivenessPauseIn,
    NetworkInfo,
    OkResponse,
    Slug,
)
from app.schemas.realtime import AlertCounts, ControlMetrics, EnvironmentOverview, EnvironmentRef
from app.services import alerts, app_state, comm_link, events, liveness_watch

SessionDep = Annotated[Session, Depends(get_session)]

router = APIRouter(dependencies=[AuthDep], responses=ERRORS_AUTH)
# Sin cabecera Authorization obligatoria: /system/network-info (público) y el SSE, cuyo
# token va en `?token=` porque EventSource no admite cabeceras.
public = APIRouter()


def _link_scope(env: Slug, user: CurrentUser) -> None:
    """El enlace de un entorno: lo ve quien es de ese entorno (o admin)."""
    check_env(user, env)


# ── Eventos ─────────────────────────────────────────────────


KEEPALIVE_S = 15.0  # comentario `: ping` para que proxies y navegadores no corten
RETRY_MS = 3000  # el navegador reconecta a los 3 s (con Last-Event-ID)


def _max_stream_s() -> float:
    """Vida máxima de una conexión SSE. Al cerrarse, el navegador reconecta solo con
    `Last-Event-ID` (no se pierde nada). Los tests la bajan con `RUOK_SSE_MAX_SECONDS`."""
    return float(os.environ.get("RUOK_SSE_MAX_SECONDS", "300"))


def _sse_message(ev: Event) -> str:
    data = json.dumps(ev.model_dump(mode="json"))
    return f"id: {ev.id}\nevent: {ev.type.value}\ndata: {data}\n\n"


def _fetch(
    since: int, viewer: events.Viewer, env_id: str | None, types: set[str] | None
) -> tuple[int, list[Event]]:
    """Eventos nuevos visibles para `viewer`. Devuelve también el último id leído."""
    with Session(engine) as session:
        rows = events.fetch_since(session, since, env_id=env_id, types=types)
        last = rows[-1].id if rows else since
        return last, [events.to_schema(r) for r in rows if events.visible_to(r, viewer)]


async def _stream(
    viewer: events.Viewer, since: int, env_id: str | None, types: set[str] | None
) -> AsyncIterator[str]:
    waiter = events.subscribe()
    deadline = time.monotonic() + _max_stream_s()
    try:
        yield f"retry: {RETRY_MS}\n\n"
        while True:
            waiter.clear()  # antes de leer: un commit durante la lectura vuelve a despertar
            since, batch = await asyncio.to_thread(_fetch, since, viewer, env_id, types)
            for ev in batch:
                yield _sse_message(ev)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return
            try:
                await asyncio.wait_for(waiter.wait(), timeout=min(KEEPALIVE_S, remaining))
            except TimeoutError:
                if deadline - time.monotonic() > 0:
                    yield ": ping\n\n"
    finally:
        events.unsubscribe(waiter)


@public.get(
    "/events/stream",
    tags=["realtime"],
    response_class=StreamingResponse,
    summary="Stream SSE de eventos (filtrado por rol)",
    description="`text/event-stream`. Cada mensaje: `id` (= Event.id, usable como Last-Event-ID), "
    "`event` (= Event.type) y `data` (= Event en JSON). El token va en `?token=` porque "
    "EventSource no admite cabeceras (sin token válido → 401). Filtrado por el rol del token: "
    "admin todo; medic/commander su entorno; member lo suyo; responder/psych solo lo entregado "
    "por el enlace. Con `Last-Event-ID` se reanuda sin perder eventos; sin él, solo llegan los "
    "nuevos. La conexión se cierra cada pocos minutos y el navegador reconecta solo.",
    responses={
        **ERRORS_AUTH,
        200: {
            "content": {"text/event-stream": {"schema": {"$ref": "#/components/schemas/Event"}}},
            "description": "Stream de eventos",
        },
    },
)
async def events_stream(
    user: Annotated[models.UserAccount, Depends(stream_user)],
    types: str | None = None,
    env_id: Slug | None = None,
    last_event_id: Annotated[int | None, Header(alias="Last-Event-ID")] = None,
) -> StreamingResponse:
    viewer = events.Viewer.of(user)
    wanted = {t for t in types.split(",") if t} if types else None
    if last_event_id is None:
        with Session(engine) as session:
            since = events.last_id(session)  # primera conexión: solo lo nuevo
    else:
        since = last_event_id
    return StreamingResponse(
        _stream(viewer, since, env_id, wanted),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get(
    "/events",
    response_model=list[Event],
    tags=["realtime"],
    summary="Historial de eventos (admin; fallback de polling)",
    description="Eventos de `event_log` con `id > since_id`, en orden. `limit` máximo 500.",
    dependencies=[AdminDep],
)
def list_events(
    session: SessionDep,
    since_id: int = 0,
    env_id: Slug | None = None,
    type: EventType | None = None,  # noqa: A002
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[Event]:
    rows = events.fetch_since(
        session, since_id, env_id=env_id, types={type.value} if type else None, limit=limit
    )
    return [events.to_schema(r) for r in rows]


# ── Dispositivos y control ──────────────────────────────────


@router.get(
    "/devices",
    response_model=list[Device],
    tags=["realtime"],
    summary="Dispositivos registrados (admin)",
    description="STUB(FS-02) → BE-29",
    dependencies=[AdminDep],
)
def list_devices(env_id: Slug | None = None) -> list[Device]:
    return [stubs.DEVICE]


@router.get(
    "/control/overview",
    response_model=ControlOverview,
    tags=["control"],
    summary="Vista global del centro de control (admin, sin retardo)",
    description="STUB(FS-02) → BE-30",
    dependencies=[AdminDep],
)
def control_overview(session: SessionDep) -> ControlOverview:
    envs = [
        EnvironmentOverview(
            environment=EnvironmentRef(id=e.id, name=e.name, kind=e.kind),
            link=comm_link.status(session, e.id),  # real (BE-13)
            members=[stubs.member_summary(m) for m in stubs.MEMBERS if m.env_id == e.id],
            open_alerts=AlertCounts(warning=1) if e.id == "mars" else AlertCounts(),
        )
        for e in stubs.ENVIRONMENTS
    ]
    return ControlOverview(
        generated_at=clock.now(),
        environments=envs,
        metrics=ControlMetrics(
            measurements_last_hour=12, open_alerts=1, active_devices=1, avg_alert_response_s=95.0
        ),
    )


@router.post(
    "/control/liveness/pause",
    response_model=OkResponse,
    tags=["control"],
    summary="Pausar las alertas de liveness de un entorno (presentación)",
    description="STUB(FS-02) → BE-30",
    dependencies=[AdminDep],
)
def pause_liveness(body: LivenessPauseIn) -> OkResponse:
    return OkResponse(detail=f"liveness {'pausado' if body.paused else 'activo'} en {body.env_id}")


@public.get(
    "/system/network-info",
    response_model=NetworkInfo,
    tags=["system"],
    summary="URLs del servidor en la red local (para el QR)",
    description="Público. STUB(FS-02) → BE-30",
)
def network_info() -> NetworkInfo:
    return NetworkInfo(lan_urls=["http://192.168.8.10:8000"], hostname="ruok-onboard")


# ── Enlace con tierra ───────────────────────────────────────


@router.get(
    "/link",
    response_model=LinkStatus,
    responses=ERRORS_404,
    tags=["link"],
    summary="Estado del enlace con tierra",
    description="Estado (online | delayed | los), retardo de ida y mensajes pendientes. "
    "Entrega antes los mensajes cuya ETA ya ha pasado (reloj de la demo).",
    dependencies=[Depends(_link_scope)],
)
def get_link(env: Slug, session: SessionDep) -> LinkStatus:
    try:
        return comm_link.status(session, env)
    except comm_link.UnknownEnvironment as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get(
    "/link/messages",
    response_model=list[LinkMessage],
    responses=ERRORS_404,
    tags=["link"],
    summary="Mensajes del enlace (pendientes o entregados)",
    description="Por orden de envío; `direction` = up (a tierra) | down (a bordo).",
    dependencies=[Depends(_link_scope)],
)
def list_link_messages(
    env: Slug, session: SessionDep, direction: LinkDirection | None = None
) -> list[LinkMessage]:
    try:
        rows = comm_link.list_messages(session, env, direction)
    except comm_link.UnknownEnvironment as exc:
        raise HTTPException(404, str(exc)) from exc
    return [comm_link.to_schema(r) for r in rows]


# ── Demo (admin) ────────────────────────────────────────────


@router.post(
    "/demo/reset",
    response_model=OkResponse,
    tags=["demo"],
    summary="Reiniciar la BD con el seed determinista",
    description="Vacía la BD, vuelve al reloj real y siembra 30 días de datos sintéticos "
    "(mismos datos en cada reset).",
    dependencies=[AdminDep],
)
def demo_reset(session: Annotated[Session, Depends(get_session)]) -> OkResponse:
    members, measurements = seed.reset(session)
    app_state.save_clock(session)  # el reloj vuelve al real también tras un reinicio (BE-32)
    return OkResponse(
        detail=f"seed v{seed.SEED_VERSION}: {members} members y {measurements} mediciones"
    )


@router.post(
    "/demo/scenarios/{name}",
    response_model=OkResponse,
    responses=ERRORS_404,
    tags=["demo"],
    summary="Cargar un escenario de demo",
    description="mars_sleep_bp | eva_no_contact | geriatric_fall_risk. Se aplica encima de "
    "los datos actuales sin borrar nada; aplicarlo dos veces no duplica mediciones.",
    dependencies=[AdminDep],
)
def demo_scenario(name: str, session: Annotated[Session, Depends(get_session)]) -> OkResponse:
    if name not in seed.SCENARIOS:
        raise HTTPException(404, f"Escenario desconocido: {name}")
    return OkResponse(detail=f"{name}: {seed.apply_scenario(session, name)}")


@router.post(
    "/demo/link",
    response_model=LinkStatus,
    responses=ERRORS_404,
    tags=["demo"],
    summary="Forzar el estado del enlace",
    description="Al pasar a `los` todo lo que se envía queda en cola; al salir de `los` "
    "la cola se envía con el retardo del entorno.",
    dependencies=[AdminDep],
)
def demo_link(body: DemoLinkIn, session: SessionDep) -> LinkStatus:
    try:
        comm_link.set_state(session, body.env, body.state)
        return comm_link.status(session, body.env)
    except comm_link.UnknownEnvironment as exc:
        raise HTTPException(404, str(exc)) from exc


@router.post(
    "/demo/fast-forward",
    response_model=DemoClock,
    tags=["demo"],
    summary="Avanzar el reloj de la demo",
    description="Avanza el reloj de la demo (app/clock.py), entrega los mensajes del enlace "
    "cuya ETA ya ha pasado y reevalúa las alertas abiertas.",
    dependencies=[AdminDep],
)
def demo_fast_forward(body: FastForwardIn, session: SessionDep) -> DemoClock:
    clock.advance(body.seconds)
    app_state.save_clock(session)  # el offset sobrevive a un reinicio del servidor (BE-32)
    comm_link.deliver_due(session)
    alerts.reevaluate_open(session)  # escala los warnings que han persistido (BE-14)
    liveness_watch.check_all(session)  # R U OK? y no_contact con el reloj adelantado (BE-16)
    return DemoClock(server_time=clock.now(), offset_s=clock.get_offset())
