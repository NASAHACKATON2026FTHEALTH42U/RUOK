"""Tiempo real, dispositivos, centro de control, enlace, sistema y demo.

STUB(FS-02) → BE-28 (eventos/SSE), BE-29 (dispositivos), BE-30 (control y network-info),
BE-13 (enlace) y BE-07 (demo). `/demo/fast-forward` ya es real: usa app/clock.py.
"""

import json
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app import clock, stubs
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
def control_overview() -> ControlOverview:
    envs = [
        EnvironmentOverview(
            environment=EnvironmentRef(id=e.id, name=e.name, kind=e.kind),
            link=stubs.link_status(e.id),
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
    description="STUB(FS-02) → BE-13",
)
def get_link(env: Slug) -> LinkStatus:
    if env not in stubs.ENV_BY_ID:
        raise HTTPException(404, f"Entorno desconocido: {env}")
    return stubs.link_status(env)


@router.get(
    "/link/messages",
    response_model=list[LinkMessage],
    tags=["link"],
    summary="Mensajes del enlace (pendientes o entregados)",
    description="STUB(FS-02) → BE-13/BE-22",
)
def list_link_messages(env: Slug, direction: LinkDirection | None = None) -> list[LinkMessage]:
    return []


# ── Demo (admin) ────────────────────────────────────────────


@router.post(
    "/demo/reset",
    response_model=OkResponse,
    tags=["demo"],
    summary="Reiniciar la BD con el seed determinista",
    description="STUB(FS-02) → BE-07",
)
def demo_reset() -> OkResponse:
    clock.reset()
    return OkResponse(detail="reset (stub): reloj a tiempo real")


@router.post(
    "/demo/scenarios/{name}",
    response_model=OkResponse,
    responses=ERRORS_404,
    tags=["demo"],
    summary="Cargar un escenario de demo",
    description="mars_sleep_bp | eva_no_contact | geriatric_fall_risk. STUB(FS-02) → BE-07",
)
def demo_scenario(name: str) -> OkResponse:
    if name not in {"mars_sleep_bp", "eva_no_contact", "geriatric_fall_risk"}:
        raise HTTPException(404, f"Escenario desconocido: {name}")
    return OkResponse(detail=f"escenario {name} (stub)")


@router.post(
    "/demo/link",
    response_model=LinkStatus,
    tags=["demo"],
    summary="Forzar el estado del enlace",
    description="STUB(FS-02) → BE-13",
)
def demo_link(body: DemoLinkIn) -> LinkStatus:
    return stubs.link_status(body.env).model_copy(
        update={"state": body.state, "since": clock.now()}
    )


@router.post(
    "/demo/fast-forward",
    response_model=DemoClock,
    tags=["demo"],
    summary="Avanzar el reloj de la demo",
    description="Real: usa app/clock.py",
)
def demo_fast_forward(body: FastForwardIn) -> DemoClock:
    clock.advance(body.seconds)
    return DemoClock(server_time=clock.now(), offset_s=clock.get_offset())
