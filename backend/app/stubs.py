"""Datos de ejemplo de FS-02 para los routers stub.

⚠️ STUB: cada router indica qué issue sustituye su respuesta por la lógica real.
Los datos se construyen con los schemas, así que un cambio de contrato que no
encaje con estos ejemplos rompe al importar (y en los tests).

Todo es coherente con docs/: Marte con 840 s de retardo, Cmdr. Vega (member 1), etc.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from app import clock
from app.schemas import (
    Alert,
    AlertEvent,
    Assessment,
    BehavioralSummary,
    DemoUser,
    Device,
    Environment,
    Escalation,
    Event,
    IndicatorAssessment,
    Measurement,
    Member,
    MemberSummary,
    Recommendation,
    SystemAssessment,
    User,
)
from app.services import environments

# Instante fijo de referencia para que los ejemplos sean deterministas.
T0 = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)

# Entornos reales (BE-03): los stubs restantes los usan para validar env_id.
ENVIRONMENTS: list[Environment] = environments.list_environments()
ENV_BY_ID = {e.id: e for e in ENVIRONMENTS}

# Indicadores y sistemas: reales desde BE-04 (app/data/indicators.json y systems.json).
# Intervenciones: reales desde BE-21 (app/data/interventions.json).

MEMBERS: list[Member] = [
    Member(
        id=1,
        env_id="mars",
        name="Cmdr. Vega",
        position="commander",
        liveness="active",
        last_seen_at=T0,
    ),
    Member(
        id=2,
        env_id="mars",
        name="Ing. Okafor",
        position="engineer",
        liveness="stale",
        last_seen_at=T0 - timedelta(minutes=12),
    ),
    Member(
        id=3,
        env_id="iss",
        name="Dra. Lindqvist",
        position="flight_engineer",
        liveness="active",
        last_seen_at=T0,
    ),
]


def member_summary(m: Member) -> MemberSummary:
    status = "warning" if m.id == 1 else ("unknown" if m.liveness != "active" else "normal")
    return MemberSummary(
        **m.model_dump(),
        overall_status=status,
        open_alerts=1 if m.id == 1 else 0,
        last_measurement_at=m.last_seen_at,
    )


USERS: list[User] = [
    User(
        id=7,
        username="vega",
        display_name="Cmdr. Vega",
        role="member",
        env_id="mars",
        member_id=1,
        role_label="astronauta",
    ),
    User(
        id=8,
        username="medic-mars",
        display_name="Dr. Haddad",
        role="medic",
        env_id="mars",
        role_label="oficial médico",
    ),
    User(
        id=9,
        username="surgeon-mars",
        display_name="Dra. Ruiz",
        role="responder",
        env_id="mars",
        role_label="flight surgeon",
    ),
    User(id=1, username="admin", display_name="Operador", role="admin", role_label="operador"),
]
DEMO_USERS = [
    DemoUser(**u.model_dump(include={"username", "display_name", "role", "env_id", "role_label"}))
    for u in USERS
]

ALERT_ID = UUID("6f1c2a9e-0b5d-4c1e-9f3a-2d8e7b6a5c41")


def assessment(member_id: int = 1, env_id: str = "mars") -> Assessment:
    env = ENV_BY_ID.get(env_id, ENV_BY_ID["mars"])
    autonomous = env.comm_delay_s >= 60
    return Assessment(
        member_id=member_id,
        env_id=env.id,
        generated_at=clock.now(),
        overall_status="critical",
        liveness="active",
        last_seen_at=T0,
        systems=[
            SystemAssessment(
                system_id="cardiovascular",
                status="warning",
                indicators=[
                    IndicatorAssessment(
                        indicator_id="bp_systolic",
                        last_value=142,
                        unit="mmHg",
                        taken_at=T0,
                        status="warning",
                        trend="rising",
                        baseline=118,
                        range={"normal": (90, 129), "warning": (130, 140)},
                    )
                ],
                recommendations=[
                    Recommendation(
                        id="rec_bp_repeat",
                        priority=1,
                        text="Repite la medición en reposo en 15 min",
                    )
                ],
                escalation=Escalation(
                    level=0,
                    target_role="self",
                    mode="autonomous"
                    if autonomous
                    else ("delayed" if env.comm_delay_s >= 5 else "realtime"),
                    delay_s=env.comm_delay_s,
                    protocol_id="proto_bp_high",
                    message="Sigue el protocolo de tensión alta; si persiste, se avisará a tierra.",
                ),
            ),
            SystemAssessment(
                system_id="neuro_behavioral",
                status="unknown",
                indicators=[
                    IndicatorAssessment(
                        indicator_id="mood",
                        unit="1-5",
                        status="unknown",
                        trend="insufficient_data",
                        range={"normal": (3, 5)},
                    )
                ],
                recommendations=[
                    Recommendation(id="rec_checkin", priority=2, text="Haz tu check-in diario")
                ],
                escalation=Escalation(
                    level=0,
                    target_role="self",
                    mode="realtime",
                    delay_s=0,
                    message="Sin datos recientes: haz el check-in.",
                ),
            ),
            *[
                _simple_system(*args, delay_s=env.comm_delay_s)
                for args in [
                    ("musculoskeletal", "normal", "exercise_min", 135, "min", "stable", (120, 300)),
                    ("immune", "normal", "temperature", 36.7, "°C", "stable", (36.0, 37.4)),
                    (
                        "metabolic",
                        "critical",
                        "glucose",
                        58,
                        "mg/dL",
                        "falling",
                        (70, 140),
                        "Toma 15 g de hidratos rápidos y repite en 15 min",
                    ),
                    ("eyes", "normal", "vision_changes", 1, "1-5", "stable", (1, 1.9)),
                    (
                        "radiation",
                        "warning",
                        "radiation_dose",
                        310,
                        "mSv",
                        "rising",
                        (0, 250),
                        "Reduce el tiempo fuera del refugio hasta nueva revisión",
                    ),
                ]
            ],
        ],
        behavioral=BehavioralSummary(status="unknown", details_visible=True),
    )


def _simple_system(
    system_id: str,
    status: str,
    indicator_id: str,
    value: float,
    unit: str,
    trend: str,
    normal: tuple[float, float],
    rec: str | None = None,
    delay_s: int = 0,
) -> SystemAssessment:
    """Sistema con un indicador, para completar el assessment de ejemplo."""
    level = 1 if status == "critical" else 0
    return SystemAssessment(
        system_id=system_id,
        status=status,
        indicators=[
            IndicatorAssessment(
                indicator_id=indicator_id,
                last_value=value,
                unit=unit,
                taken_at=T0,
                status=status,
                trend=trend,
                range={"normal": normal},
            )
        ],
        recommendations=[Recommendation(id=f"rec_{system_id}", priority=1, text=rec)]
        if rec
        else [],
        escalation=Escalation(
            level=level,
            target_role="crew" if level else "self",
            mode="realtime",
            delay_s=0 if level else delay_s,
            message="Avisa al oficial médico de a bordo." if level else "Sin acciones necesarias.",
        ),
    )


def measurement(member_id: int = 1) -> Measurement:
    return Measurement(
        id=UUID("0b7e5c1a-3f2d-4e8b-9a6c-1d2e3f4a5b6c"),
        member_id=member_id,
        indicator_id="bp_systolic",
        value=142,
        unit="mmHg",
        taken_at=T0,
        received_at=T0,
        source="manual",
    )


def alert(member_id: int = 1) -> Alert:
    return Alert(
        id=ALERT_ID,
        member_id=member_id,
        env_id="mars",
        origin="manual",
        authenticated=True,
        created_by_user_id=7,
        category="psychological",
        severity="warning",
        message="Necesito hablar",
        level=2,
        target_role="ground",
        delivery_mode="delayed",
        delay_s=840,
        eta=T0 + timedelta(seconds=840),
        status="escalated",
        created_at=T0,
        updated_at=T0,
        events=[
            AlertEvent(type="created", actor="member", at=T0),
            AlertEvent(type="queued", actor="system", at=T0, payload={"eta_s": 840}),
        ],
    )


DEVICE = Device(
    id=UUID("a3f9c2d1-7b6e-4f5a-8c9d-0e1f2a3b4c5d"),
    user_id=7,
    kind="mobile",
    label="movil-vega",
    ip="192.168.8.21",
    first_seen_at=T0,
    last_seen_at=T0,
    pending_outbox=0,
    last_sync_at=T0,
)

EVENTS: list[Event] = [
    Event(
        id=1,
        type="measurement.created",
        at=T0,
        env_id="mars",
        member_id=1,
        user_id=7,
        device_id=DEVICE.id,
        ref_id="0b7e5c1a-3f2d-4e8b-9a6c-1d2e3f4a5b6c",
        summary="Cmdr. Vega: tensión 142 mmHg",
    ),
    Event(
        id=2,
        type="alert.created",
        at=T0,
        env_id="mars",
        member_id=1,
        user_id=7,
        device_id=DEVICE.id,
        ref_id=str(ALERT_ID),
        summary="Petición de ayuda de Cmdr. Vega",
    ),
    Event(
        id=3,
        type="link.queued",
        at=T0,
        env_id="mars",
        ref_id=str(ALERT_ID),
        summary="Alerta en cola hacia tierra (ETA 14 min)",
    ),
]
