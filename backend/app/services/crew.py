"""Kudos y misiones de tripulación (BE-23).

Configuración en ``app/data/crew_game.json`` (puntos del kudos, límite diario y catálogo de
misiones por entorno). Ambos **suman a los `crew_points`** (``crew_extra_points``), que
``services/gamification.py`` añade a los puntos de las tareas:

- Kudos: ``kudos.points`` por cada uno. Idempotente por UUID; no a uno mismo ni a otro entorno;
  como mucho ``max_per_day`` al día por member (UTC, reloj de la demo).
- Misiones: se completan al apuntarse ``min_participants`` members distintos el mismo día y
  entonces suman ``points`` una vez. Apuntarse dos veces no duplica.
"""

from __future__ import annotations

import json
import uuid
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, col, select

from app import clock, i18n, models
from app.schemas import CrewMission, Kudos
from app.services import environments, routine

CREW_GAME_FILE = Path(__file__).resolve().parent.parent / "data" / "crew_game.json"


class InvalidKudos(ValueError):
    """Kudos a uno mismo o a alguien de otro entorno (→ 422)."""


class Conflict(Exception):
    """UUID reutilizado con otro contenido, o límite diario superado (→ 409)."""


class UnknownMission(Exception):
    """La misión no existe o no está en el entorno (→ 404)."""


@lru_cache(maxsize=1)
def config() -> dict[str, Any]:
    cfg = json.loads(CREW_GAME_FILE.read_text(encoding="utf-8"))
    env_ids = {e.id for e in environments.list_environments()}
    for m in cfg["missions"]:
        unknown = set(m["envs"]) - env_ids
        if unknown:
            raise ValueError(f"crew_game.json: misión {m['id']} con entornos {sorted(unknown)}")
    return cfg


def _missions_of(env_id: str) -> list[dict[str, Any]]:
    return [m for m in config()["missions"] if env_id in m["envs"]]


# ── Kudos ────────────────────────────────────────────────────────────


def _kudos_schema(row: models.Kudos) -> Kudos:
    return Kudos(
        id=row.id,
        env_id=row.env_id,
        from_member_id=row.from_member_id,
        to_member_id=row.to_member_id,
        message=row.message,
        created_at=row.created_at,
    )


def give_kudos(
    session: Session, sender: models.Member, kudos_id: uuid.UUID, to_member_id: int, message: str
) -> Kudos:
    cfg = config()["kudos"]
    existing = session.get(models.Kudos, str(kudos_id))
    if existing is not None:
        same = (
            existing.from_member_id == sender.id
            and existing.to_member_id == to_member_id
            and existing.message == message
        )
        if not same:
            raise Conflict(i18n.tr("Ese id ya se usó con otro kudos"))
        return _kudos_schema(existing)

    receiver = session.get(models.Member, to_member_id)
    if receiver is None or receiver.env_id != sender.env_id:
        raise InvalidKudos(i18n.tr("El destinatario tiene que ser de tu mismo entorno"))
    if receiver.id == sender.id:
        raise InvalidKudos(i18n.tr("No puedes darte un kudos a ti mismo"))
    if len(message) > cfg["max_message_length"]:
        raise InvalidKudos(
            i18n.tr("Mensaje de más de {n} caracteres", n=cfg["max_message_length"])
        )

    day_start = clock.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = session.exec(
        select(func.count())
        .select_from(models.Kudos)
        .where(models.Kudos.from_member_id == sender.id, col(models.Kudos.created_at) >= day_start)
    ).one()
    if today_count >= cfg["max_per_day"]:
        raise Conflict(i18n.tr("Máximo {n} kudos al día", n=cfg["max_per_day"]))

    row = models.Kudos(
        id=str(kudos_id),
        env_id=sender.env_id,
        from_member_id=sender.id,
        to_member_id=receiver.id,
        message=message,
        created_at=clock.now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _kudos_schema(row)


def list_kudos(session: Session, env_id: str, limit: int = 50) -> list[Kudos]:
    rows = session.exec(
        select(models.Kudos)
        .where(models.Kudos.env_id == env_id)
        .order_by(col(models.Kudos.created_at).desc(), col(models.Kudos.id))
        .limit(limit)
    ).all()
    return [_kudos_schema(r) for r in rows]


# ── Misiones ─────────────────────────────────────────────────────────


def _mission(cfg: dict[str, Any], day: date, members: list[int]) -> CrewMission:
    return CrewMission(
        id=cfg["id"],
        title=i18n.localized("crew_game", cfg["id"], {"title": cfg["title"]})["title"],
        points=cfg["points"],
        min_participants=cfg["min_participants"],
        date=day,
        participants=sorted(members),
        completed=len(members) >= cfg["min_participants"],
    )


def list_missions(session: Session, env_id: str, day: date | None = None) -> list[CrewMission]:
    day = day or routine.today()
    rows = session.exec(
        select(models.MissionParticipation).where(
            models.MissionParticipation.env_id == env_id, models.MissionParticipation.date == day
        )
    ).all()
    by_mission: dict[str, list[int]] = {}
    for r in rows:
        by_mission.setdefault(r.mission_id, []).append(r.member_id)
    return [_mission(m, day, by_mission.get(m["id"], [])) for m in _missions_of(env_id)]


def join_mission(
    session: Session, member: models.Member, mission_id: str, join_id: uuid.UUID
) -> CrewMission:
    if mission_id not in {m["id"] for m in _missions_of(member.env_id)}:
        raise UnknownMission(i18n.tr("Misión desconocida en este entorno: {id}", id=mission_id))
    day = routine.today()
    taken = session.get(models.MissionParticipation, str(join_id))
    if taken is not None and (taken.member_id, taken.mission_id) != (member.id, mission_id):
        raise Conflict(i18n.tr("Ese id ya se usó para otra participación"))
    already = session.exec(
        select(models.MissionParticipation).where(
            models.MissionParticipation.date == day,
            models.MissionParticipation.mission_id == mission_id,
            models.MissionParticipation.member_id == member.id,
        )
    ).first()
    if already is None and taken is None:
        session.add(
            models.MissionParticipation(
                id=str(join_id),
                env_id=member.env_id,
                date=day,
                mission_id=mission_id,
                member_id=member.id,
                created_at=clock.now(),
            )
        )
        session.commit()
    return next(m for m in list_missions(session, member.env_id, day) if m.id == mission_id)


# ── Puntos de tripulación ────────────────────────────────────────────


def crew_extra_points(session: Session, env_id: str) -> int:
    """Puntos de kudos y de misiones completadas del entorno (se suman a los de las tareas)."""
    n_kudos = session.exec(
        select(func.count()).select_from(models.Kudos).where(models.Kudos.env_id == env_id)
    ).one()
    total = n_kudos * config()["kudos"]["points"]

    counts = session.exec(
        select(
            models.MissionParticipation.date,
            models.MissionParticipation.mission_id,
            func.count(),
        )
        .where(models.MissionParticipation.env_id == env_id)
        .group_by(
            col(models.MissionParticipation.date), col(models.MissionParticipation.mission_id)
        )
    ).all()
    catalog = {m["id"]: m for m in _missions_of(env_id)}
    for _day, mission_id, n in counts:
        m = catalog.get(mission_id)
        if m is not None and n >= m["min_participants"]:
            total += m["points"]
    return total
