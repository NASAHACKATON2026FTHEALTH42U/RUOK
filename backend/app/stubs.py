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
    BodySystem,
    DemoUser,
    Device,
    Environment,
    Escalation,
    Event,
    GameState,
    Indicator,
    IndicatorAssessment,
    Intervention,
    Leaderboard,
    LeaderboardEntry,
    LinkStatus,
    Measurement,
    Member,
    MemberSummary,
    Recommendation,
    SystemAssessment,
    Task,
    User,
)
from app.schemas.config import IndicatorInput, IndicatorRanges
from app.schemas.game import Badge
from app.services import environments

# Instante fijo de referencia para que los ejemplos sean deterministas.
T0 = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)

# Entornos reales (BE-03): los stubs restantes los usan para validar env_id.
ENVIRONMENTS: list[Environment] = environments.list_environments()
ENV_BY_ID = {e.id: e for e in ENVIRONMENTS}

INDICATORS: list[Indicator] = [
    Indicator(
        id="heart_rate",
        name="Frecuencia cardiaca",
        unit="lpm",
        system_id="cardiovascular",
        ranges=IndicatorRanges(
            normal=(50, 100), warning=(101, 120), critical_low=40, critical_high=130
        ),
        max_age_s=86400,
        input=IndicatorInput(type="number", min=20, max=250, step=1),
        measurement_instructions=["Siéntate 5 min en reposo", "Mide durante 60 s"],
        why_it_matters="La microgravedad redistribuye los fluidos y altera el ritmo cardiaco.",
        hazards=["gravity"],
    ),
    Indicator(
        id="bp_systolic",
        name="Tensión sistólica",
        unit="mmHg",
        system_id="cardiovascular",
        ranges=IndicatorRanges(
            normal=(90, 129), warning=(130, 159), critical_low=80, critical_high=160
        ),
        max_age_s=172800,
        input=IndicatorInput(type="number", min=50, max=250, step=1),
        measurement_instructions=["Siéntate 5 min en reposo", "Brazo a la altura del corazón"],
        why_it_matters="Los cambios de gravedad afectan a la regulación de la tensión.",
        hazards=["gravity"],
    ),
    Indicator(
        id="bp_diastolic",
        name="Tensión diastólica",
        unit="mmHg",
        system_id="cardiovascular",
        ranges=IndicatorRanges(
            normal=(60, 84), warning=(85, 99), critical_low=50, critical_high=100
        ),
        max_age_s=172800,
        input=IndicatorInput(type="number", min=30, max=150, step=1),
        measurement_instructions=["Se toma junto con la sistólica"],
        why_it_matters="Completa la lectura de la tensión arterial.",
        hazards=["gravity"],
    ),
    Indicator(
        id="spo2",
        name="Saturación de oxígeno",
        unit="%",
        system_id="cardiovascular",
        ranges=IndicatorRanges(normal=(95, 100), warning=(91, 94), critical_low=90),
        max_age_s=86400,
        higher_is_worse=False,
        input=IndicatorInput(type="number", min=50, max=100, step=1),
        measurement_instructions=["Pulsioxímetro en el dedo índice, 30 s"],
        why_it_matters="El aire de un hábitat cerrado puede fallar; la SpO₂ lo detecta pronto.",
        hazards=["hostile_environment"],
    ),
    Indicator(
        id="mood",
        name="Ánimo",
        unit="1-5",
        system_id="neuro_behavioral",
        ranges=IndicatorRanges(normal=(3, 5), warning=(2, 2.9), critical_low=1.5),
        max_age_s=129600,
        higher_is_worse=False,
        input=IndicatorInput(type="scale_1_5", min=1, max=5, step=1),
        measurement_instructions=["¿Cómo te sientes hoy? 1 = muy mal, 5 = muy bien"],
        why_it_matters="El aislamiento y el confinamiento afectan al ánimo y al rendimiento.",
        hazards=["isolation"],
    ),
    *[
        Indicator(
            id=id_,
            name=name,
            unit=unit,
            system_id=system,
            ranges=IndicatorRanges(**ranges),
            max_age_s=max_age,
            higher_is_worse=worse,
            input=IndicatorInput(**inp),
            measurement_instructions=[instr],
            why_it_matters=why,
            hazards=hazards,
        )
        for id_, name, unit, system, ranges, max_age, worse, inp, instr, why, hazards in [
            (
                "temperature",
                "Temperatura",
                "°C",
                "immune",
                {
                    "normal": (36.0, 37.4),
                    "warning": (37.5, 38.4),
                    "critical_low": 35.0,
                    "critical_high": 38.5,
                },
                86400,
                True,
                {"type": "number", "min": 33, "max": 43, "step": 0.1},
                "Termómetro bajo la lengua, 1 min",
                "La fiebre puede indicar una infección; el sistema inmune cambia en el espacio.",
                ["hostile_environment"],
            ),
            (
                "glucose",
                "Glucosa",
                "mg/dL",
                "metabolic",
                {
                    "normal": (70, 140),
                    "warning": (141, 180),
                    "critical_low": 60,
                    "critical_high": 250,
                },
                86400,
                True,
                {"type": "number", "min": 20, "max": 600, "step": 1},
                "Glucómetro: gota de sangre del dedo",
                "La nutrición en misión es limitada y la glucosa refleja el estado metabólico.",
                ["distance"],
            ),
            (
                "exercise_min",
                "Ejercicio diario",
                "min",
                "musculoskeletal",
                {"normal": (120, 300), "warning": (60, 119), "critical_low": 30},
                86400,
                False,
                {"type": "duration", "min": 0, "max": 600, "step": 5},
                "Minutos de ejercicio resistivo y aeróbico de hoy",
                "Sin gravedad se pierde hueso y músculo; el ejercicio es la contramedida.",
                ["gravity"],
            ),
            (
                "sleep_hours",
                "Horas de sueño",
                "h",
                "neuro_behavioral",
                {"normal": (7, 10), "warning": (5, 6.9), "critical_low": 4},
                129600,
                False,
                {"type": "duration", "min": 0, "max": 16, "step": 0.5},
                "Horas dormidas la última noche",
                "El ciclo luz/oscuridad alterado y el ruido afectan al sueño.",
                ["isolation"],
            ),
            (
                "vision_changes",
                "Cambios en la visión",
                "1-5",
                "eyes",
                {"normal": (1, 1.9), "warning": (2, 3.4), "critical_high": 3.5},
                604800,
                True,
                {"type": "scale_1_5", "min": 1, "max": 5, "step": 1},
                "1 = sin cambios, 5 = visión muy borrosa o distorsionada",
                "El SANS (síndrome neuro-ocular) aparece en misiones largas en microgravedad.",
                ["gravity"],
            ),
            (
                "radiation_dose",
                "Dosis acumulada",
                "mSv",
                "radiation",
                {"normal": (0, 250), "warning": (251, 500), "critical_high": 600},
                604800,
                True,
                {"type": "number", "min": 0, "max": 2000, "step": 1},
                "Lectura del dosímetro personal",
                "Fuera de la magnetosfera la radiación aumenta el riesgo de cáncer.",
                ["radiation"],
            ),
        ]
    ],
]

SYSTEMS: list[BodySystem] = [
    BodySystem(
        id=id_,
        name=name,
        svg_region=region,
        indicators=inds,
        function=function,
        space_effects=effects,
        hazards=hazards,
    )
    for id_, name, region, inds, function, effects, hazards in [
        (
            "cardiovascular",
            "Cardiovascular",
            "heart",
            ["heart_rate", "bp_systolic", "bp_diastolic", "spo2"],
            "Bombea la sangre y lleva oxígeno a todo el cuerpo.",
            "Redistribución de fluidos hacia la cabeza y desacondicionamiento cardiaco.",
            ["gravity", "radiation"],
        ),
        (
            "musculoskeletal",
            "Musculoesquelético",
            "bones",
            ["exercise_min"],
            "Huesos y músculos: sostén y movimiento.",
            "Sin gravedad se pierde un 1–1,5 % de densidad ósea al mes y masa muscular.",
            ["gravity"],
        ),
        (
            "immune",
            "Inmune",
            "immune",
            ["temperature"],
            "Defiende al cuerpo de infecciones.",
            "El estrés y el confinamiento alteran la respuesta inmune.",
            ["hostile_environment", "isolation"],
        ),
        (
            "metabolic",
            "Metabólico y nutrición",
            "metabolic",
            ["glucose"],
            "Convierte los alimentos en energía.",
            "Dieta limitada y cambios hormonales afectan al metabolismo.",
            ["distance"],
        ),
        (
            "neuro_behavioral",
            "Neuro-conductual",
            "brain",
            ["mood", "sleep_hours"],
            "Ánimo, sueño, cognición y relación con la tripulación.",
            "Aislamiento, confinamiento y alteración del sueño afectan al ánimo.",
            ["isolation"],
        ),
        (
            "eyes",
            "Ojos (SANS)",
            "eyes",
            ["vision_changes"],
            "Visión.",
            "La presión de los fluidos hacia la cabeza puede deformar el globo ocular (SANS).",
            ["gravity"],
        ),
        (
            "radiation",
            "Radiación (todo el cuerpo)",
            "halo",
            ["radiation_dose"],
            "Exposición acumulada a la radiación espacial.",
            "Fuera de la magnetosfera terrestre la dosis aumenta mucho.",
            ["radiation"],
        ),
    ]
]

INTERVENTIONS: list[Intervention] = [
    Intervention(
        id="int_box_breathing",
        title="Respiración en caja",
        category="stress",
        system_id="neuro_behavioral",
        duration_min=4,
        steps=["Inhala 4 s", "Mantén 4 s", "Exhala 4 s", "Mantén 4 s", "Repite 4 ciclos"],
    ),
]

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


def link_status(env_id: str = "mars") -> LinkStatus:
    env = ENV_BY_ID.get(env_id, ENV_BY_ID["mars"])
    return LinkStatus(
        env_id=env.id,
        state="delayed" if env.comm_delay_s >= 5 else "online",
        delay_s=env.comm_delay_s,
        queued=1 if env.id == "mars" else 0,
        since=T0,
    )


TASKS: list[Task] = [
    Task(
        id="t_2026-11-14_1_measure_bp",
        task_type="measure_bp",
        title="Mide tu tensión",
        points=10,
        due="morning",
        completed=True,
        indicator_id="bp_systolic",
    ),
    Task(
        id="t_2026-11-14_1_resistive_exercise",
        task_type="resistive_exercise",
        title="Ejercicio resistivo (ARED)",
        points=20,
        due="afternoon",
        completed=False,
    ),
    Task(
        id="t_2026-11-14_1_checkin",
        task_type="checkin",
        title="Check-in diario R U OK?",
        points=10,
        due="any",
        completed=False,
        indicator_id="mood",
    ),
]

GAME = GameState(
    points=340,
    streak_days=5,
    crew_points=1820,
    badges=[Badge(id="early_bird", name="Madrugador", earned_at=T0)],
)


def leaderboard(env_id: str = "mars") -> Leaderboard:
    return Leaderboard(
        env_id=env_id,
        crew_points=1820,
        members=[
            LeaderboardEntry(member_id=1, name="Cmdr. Vega", points=340, streak_days=5),
            LeaderboardEntry(member_id=2, name="Ing. Okafor", points=290, streak_days=3),
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
