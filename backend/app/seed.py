"""Seed determinista y escenarios de demo (BE-07).

- `seed()`: 3–4 members por entorno y 30 días de mediciones sintéticas de los
  indicadores activos de cada entorno, dentro de su rango `normal` y con ruido.
- Determinista: los valores salen de un `random.Random` con semilla fija por
  member e indicador, y los ids de `uuid5`. Las fechas son relativas al
  momento del seed (`clock.now()`), para que los datos estén siempre recientes:
  dos seeds con el mismo reloj dan exactamente los mismos datos.
- `reset()`: vacía todas las tablas, vuelve al reloj real y siembra de nuevo.
- Escenarios (`SCENARIOS`): una capa encima de los datos actuales para el
  guion de docs/demo-script.md. Son idempotentes: aplicarlos dos veces no
  duplica nada (ids deterministas).

Los valores clínicos salen de app/data/indicators.json (provisionales hasta CNT-01).
"""

from __future__ import annotations

import random
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlmodel import Session, col, delete, select

from app import clock, models
from app.auth.security import SECRET_KEY as JWT_SECRET_KEY
from app.schemas import Indicator
from app.services import accounts, app_state, catalog, environments

SEED = 2026
DAYS = 30
SEED_VERSION = 1
NAMESPACE = uuid.UUID("5d0c7a52-8a43-4f0e-9a5e-2b6f1c3d4e5f")

# Indicadores que se miden una vez por semana (el resto, a diario).
WEEKLY = {"weight_kg", "radiation_dose", "vision_changes"}
# Indicadores que se registran en el check-in diario (source = "checkin").
CHECKIN = {"mood", "stress", "energy", "loneliness", "sleep_quality", "crew_relation"}


def _source(indicator_id: str) -> str:
    if indicator_id in CHECKIN:
        return "checkin"
    return "pvt" if indicator_id.startswith("pvt_") else "manual"


@dataclass(frozen=True)
class SeedMember:
    id: int
    env_id: str
    name: str
    position: str


# Los 3 primeros coinciden con app/stubs.py (front, mocks y usuarios de demo).
MEMBERS: list[SeedMember] = [
    SeedMember(1, "mars", "Cmdr. Vega", "commander"),
    SeedMember(2, "mars", "Ing. Okafor", "engineer"),
    SeedMember(3, "iss", "Dra. Lindqvist", "flight_engineer"),
    SeedMember(4, "mars", "Dra. Haddad", "medical_officer"),
    SeedMember(5, "mars", "Esp. Tanaka", "scientist"),
    SeedMember(6, "iss", "Cmdte. Moreau", "commander"),
    SeedMember(7, "iss", "Esp. Rao", "scientist"),
    SeedMember(8, "moon", "Cmdr. Ito", "commander"),
    SeedMember(9, "moon", "Ing. Silva", "engineer"),
    SeedMember(10, "moon", "Dra. Weber", "geologist"),
    SeedMember(11, "earth", "Ana Ruiz", "participant"),
    SeedMember(12, "earth", "Leo Park", "participant"),
    SeedMember(13, "earth", "Marta Gil", "participant"),
    SeedMember(14, "hospital", "Joan Puig", "patient"),
    SeedMember(15, "hospital", "Laura Sanz", "patient"),
    SeedMember(16, "hospital", "Pedro Díaz", "patient"),
    SeedMember(17, "geriatric", "Rosa Martí", "resident"),
    SeedMember(18, "geriatric", "Josep Vidal", "resident"),
    SeedMember(19, "geriatric", "Carmen López", "resident"),
    SeedMember(20, "geriatric", "Antonio Ferrer", "resident"),
]

VEGA = 1
FALL_RISK_RESIDENT = 17


def _uuid(*parts: object) -> str:
    return str(uuid.uuid5(NAMESPACE, ":".join(str(p) for p in parts)))


def _anchor() -> datetime:
    """Momento de referencia del seed: el reloj de la demo, al minuto."""
    return clock.now().replace(second=0, microsecond=0)


def _round_to_step(value: float, indicator: Indicator) -> float:
    step = indicator.input.step or 1
    value = round(round(value / step) * step, 6)
    lo, hi = indicator.input.min, indicator.input.max
    if lo is not None:
        value = max(value, lo)
    if hi is not None:
        value = min(value, hi)
    return value


def _series(member_id: int, indicator: Indicator, anchor: datetime) -> list[models.Measurement]:
    """~30 días de un indicador para un member, dentro de su rango `normal`."""
    rng = random.Random(f"{SEED}:{member_id}:{indicator.id}")
    lo, hi = indicator.ranges.normal
    width = hi - lo
    margin = width * 0.15
    center = (lo + hi) / 2 + rng.uniform(-0.15, 0.15) * width  # cada persona es distinta
    noise = width * 0.08

    weekly = indicator.id in WEEKLY
    days = range(0, DAYS, 7) if weekly else range(DAYS)
    hour_offset = rng.uniform(0.5, 6)  # a qué hora suele medirse (horas antes del ancla)
    cumulative = indicator.id == "radiation_dose"
    dose = rng.uniform(lo + margin, lo + width * 0.4)

    rows = []
    for i, day in enumerate(sorted(days, reverse=True)):  # de más antiguo a más reciente
        taken_at = anchor - timedelta(days=day, hours=hour_offset + rng.uniform(-0.5, 0.5))
        if cumulative:
            dose += rng.uniform(2.5, 5)  # la dosis acumulada solo crece
            raw = dose
        else:
            raw = rng.gauss(center, noise)
        value = _round_to_step(min(max(raw, lo + margin), hi - margin), indicator)
        rows.append(
            models.Measurement(
                id=_uuid("seed", member_id, indicator.id, i),
                member_id=member_id,
                indicator_id=indicator.id,
                value=value,
                unit=indicator.unit,
                taken_at=taken_at,
                received_at=taken_at + timedelta(seconds=rng.randint(2, 90)),
                source=_source(indicator.id),
            )
        )
    return rows


def seed(session: Session) -> tuple[int, int]:
    """Inserta los members, sus cuentas (BE-25) y sus mediciones. Devuelve (members, mediciones)."""
    anchor = _anchor()
    members = [
        models.Member(
            id=m.id,
            env_id=m.env_id,
            name=m.name,
            position=m.position,
            last_seen_at=anchor,
            last_activity="normal",
            created_at=anchor - timedelta(days=DAYS),
        )
        for m in MEMBERS
    ]
    session.add_all(members)
    # Los modelos no declaran relationship(): sin este flush, SQLAlchemy podría
    # insertar las mediciones (y las cuentas) antes que los members y fallaría la FK.
    session.flush()
    accounts.seed_users(session, members)  # BE-25: solo con DEMO_MODE=true hay demo

    total = 0
    for m in MEMBERS:
        env = environments.get_environment(m.env_id)
        for indicator_id in env.indicators:
            rows = _series(m.id, catalog.get_indicator(indicator_id), anchor)
            session.add_all(rows)
            total += len(rows)
    session.add(models.AppState(key="seed_version", value=SEED_VERSION))
    session.commit()
    return len(MEMBERS), total


# Orden de borrado: primero las tablas que apuntan a otras (FK).
_TABLES = [
    models.AlertEvent,
    models.LinkMessage,
    models.RuokCheck,
    models.Alert,
    models.TaskCompletion,
    models.Task,
    models.BadgeAward,
    models.Kudos,
    models.Measurement,
    models.EventLog,
    models.Device,
    models.UserAccount,
    models.Member,
    models.LinkState,
    models.AppState,
]


def reset(session: Session) -> tuple[int, int]:
    """Vacía la BD, vuelve al reloj real y siembra. Devuelve (members, mediciones).

    Conserva la clave JWT (``app_state.jwt_secret``): un reset durante la demo no cierra
    la sesión de los dispositivos. Los usuarios se siembran con los mismos ids.
    """
    jwt_secret = app_state.get_value(session, JWT_SECRET_KEY)
    for table in _TABLES:
        session.exec(delete(table))
    session.commit()
    if jwt_secret:
        app_state.set_value(session, JWT_SECRET_KEY, jwt_secret)
    clock.reset()
    return seed(session)


def ensure_seeded(session: Session) -> bool:
    """Siembra si la BD no tiene members (primer arranque). True si ha sembrado."""
    if session.exec(select(models.Member).limit(1)).first() is not None:
        return False
    seed(session)
    return True


# ── Escenarios ───────────────────────────────────────────────────────


def _add_points(
    session: Session, scenario: str, member_id: int, indicator_id: str, values: list[float]
) -> int:
    """Añade una medición diaria por valor (la última, la más reciente). Idempotente.

    En esos días se quitan solo los puntos **sintéticos del seed** de ese member e
    indicador, para que la serie no zigzaguee entre el seed y el escenario. Las
    mediciones reales (registradas en directo) no se tocan nunca.
    """
    indicator = catalog.get_indicator(indicator_id)
    now = clock.now()
    cutoff = now - timedelta(days=len(values) - 1, hours=12)
    seed_ids = [_uuid("seed", member_id, indicator_id, i) for i in range(DAYS)]
    session.exec(
        delete(models.Measurement).where(
            col(models.Measurement.id).in_(seed_ids),
            col(models.Measurement.taken_at) >= cutoff,
        )
    )
    added = 0
    for days_ago, value in zip(range(len(values) - 1, -1, -1), values, strict=True):
        row_id = _uuid("scenario", scenario, member_id, indicator_id, days_ago)
        if session.get(models.Measurement, row_id) is not None:
            continue
        taken_at = now - timedelta(days=days_ago, minutes=5)
        session.add(
            models.Measurement(
                id=row_id,
                member_id=member_id,
                indicator_id=indicator_id,
                value=_round_to_step(value, indicator),
                unit=indicator.unit,
                taken_at=taken_at,
                source="checkin" if indicator_id in CHECKIN else "manual",
            )
        )
        added += 1
    return added


def scenario_mars_sleep_bp(session: Session) -> str:
    """Vega duerme mal 5 días y le sube la tensión: cardio ámbar, neuro rojo (paso 3)."""
    added = _add_points(session, "mars_sleep_bp", VEGA, "sleep_hours", [5.5, 5, 4.5, 4, 3.5])
    added += _add_points(session, "mars_sleep_bp", VEGA, "bp_systolic", [128, 131, 133, 135, 137])
    return f"{added} mediciones nuevas para Cmdr. Vega"


def scenario_eva_no_contact(session: Session) -> str:
    """Vega sale de EVA y deja de dar señales hace 3 min: liveness `lost` (paso 6)."""
    member = session.get(models.Member, VEGA)
    member.last_activity = "eva"
    member.last_seen_at = clock.now() - timedelta(minutes=3)
    # Solo se vigila a quien ha conectado un dispositivo (BE-16): el móvil de la demo.
    member.device_id = member.device_id or _uuid("device", "movil-vega")
    session.add(member)
    return "Cmdr. Vega en EVA sin contacto desde hace 3 min"


def scenario_geriatric_fall_risk(session: Session) -> str:
    """Rosa bebe poco, duerme mal, pierde peso y tiene la tensión baja (paso 8)."""
    s, r = "geriatric_fall_risk", FALL_RISK_RESIDENT
    added = _add_points(session, s, r, "hydration_ml", [1300, 1100, 1000, 900])
    added += _add_points(session, s, r, "sleep_hours", [6, 5.5, 5, 4])
    added += _add_points(session, s, r, "bp_systolic", [96, 93, 90, 88])
    added += _add_points(session, s, r, "weight_kg", [62, 61, 59.5, 58])
    return f"{added} mediciones nuevas para Rosa Martí"


SCENARIOS: dict[str, Callable[[Session], str]] = {
    "mars_sleep_bp": scenario_mars_sleep_bp,
    "eva_no_contact": scenario_eva_no_contact,
    "geriatric_fall_risk": scenario_geriatric_fall_risk,
}


SCENARIO_MEMBER = {
    "mars_sleep_bp": VEGA,
    "eva_no_contact": VEGA,
    "geriatric_fall_risk": FALL_RISK_RESIDENT,
}


def apply_scenario(session: Session, name: str) -> str:
    """Aplica un escenario sobre los datos actuales. KeyError si no existe.

    Después evalúa al member afectado, como haría un POST de mediciones: así se
    abren o escalan sus alertas automáticas (BE-14).
    """
    from app.services import liveness_watch  # evita el ciclo de imports
    from app.services.alerts import evaluate_member

    detail = SCENARIOS[name](session)
    session.commit()
    app_state.set_value(session, "scenario", name)
    member = session.get(models.Member, SCENARIO_MEMBER[name])
    evaluate_member(session, member)
    liveness_watch.check_member(session, member)  # R U OK? / no_contact (BE-16)
    return detail
