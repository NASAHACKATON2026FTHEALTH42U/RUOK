"""Tiempo real, dispositivos, centro de control, enlace, sistema y demo.

Reales: enlace (BE-13), demo (BE-07) y fast-forward (app/clock.py).
STUB(FS-02) → BE-28 (eventos/SSE), BE-29 (dispositivos) y BE-30 (control y network-info);
en /control/overview el `link` ya es real.
"""

import json
from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app import clock, seed, stubs
from app.db import get_session
from app.routers.deps import ERRORS_404, ERRORS_AUTH, AuthDep
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
from app.services import comm_link

SessionDep = Annotated[Session, Depends(get_session)]

router = APIRouter(dependencies=[AuthDep], responses=ERRORS_AUTH)
public = APIRouter()


# ── Eventos ─────────────────────────────────────────────────


def _sse(events: list[Event]) -> Iterator[str]:
    for ev in events:
        data = json.dumps(ev.model_dump(mode="json"))
        yield f"id: {ev.id}\nevent: {ev.type.value}\ndata: {data}\n\n"


@router.get(
    "/events/stream",
    tags=["realtime"],
    response_class=StreamingResponse,
    summary="Stream SSE de eventos (filtrado por rol)",
    description="`text/event-stream`. Cada mensaje: `id` (= Event.id, usable como Last-Event-ID), "
    "`event` (= Event.type) y `data` (= Event en JSON). El token va en `?token=` porque "
    "EventSource no admite cabeceras. STUB(FS-02): emite los eventos de ejemplo y cierra → BE-28",
    responses={
        200: {
            "content": {"text/event-stream": {"schema": {"$ref": "#/components/schemas/Event"}}},
            "description": "Stream de eventos",
        }
    },
)
def events_stream(
    token: str | None = None, types: str | None = None, env_id: Slug | None = None
) -> StreamingResponse:
    wanted = set(types.split(",")) if types else None
    evs = [
        e
        for e in stubs.EVENTS
        if (wanted is None or e.type.value in wanted) and (env_id is None or e.env_id == env_id)
    ]
    return StreamingResponse(_sse(evs), media_type="text/event-stream")


@router.get(
    "/events",
    response_model=list[Event],
    tags=["realtime"],
    summary="Historial de eventos (admin; fallback de polling)",
    description="STUB(FS-02) → BE-28",
)
def list_events(
    since_id: int = 0,
    env_id: Slug | None = None,
    type: EventType | None = None,  # noqa: A002
    limit: int = 100,
) -> list[Event]:
    return [
        e
        for e in stubs.EVENTS
        if e.id > since_id
        and (env_id is None or e.env_id == env_id)
        and (type is None or e.type == type)
    ][:limit]


# ── Dispositivos y control ──────────────────────────────────


@router.get(
    "/devices",
    response_model=list[Device],
    tags=["realtime"],
    summary="Dispositivos registrados (admin)",
    description="STUB(FS-02) → BE-29",
)
def list_devices(env_id: Slug | None = None) -> list[Device]:
    return [stubs.DEVICE]


@router.get(
    "/control/overview",
    response_model=ControlOverview,
    tags=["control"],
    summary="Vista global del centro de control (admin, sin retardo)",
    description="STUB(FS-02) → BE-30",
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
)
def demo_reset(session: Annotated[Session, Depends(get_session)]) -> OkResponse:
    members, measurements = seed.reset(session)
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
    description="Avanza el reloj de la demo (app/clock.py) y entrega los mensajes del enlace "
    "cuya ETA ya ha pasado.",
)
def demo_fast_forward(body: FastForwardIn, session: SessionDep) -> DemoClock:
    clock.advance(body.seconds)
    comm_link.deliver_due(session)
    return DemoClock(server_time=clock.now(), offset_s=clock.get_offset())
