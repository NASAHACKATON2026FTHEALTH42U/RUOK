"""Gamificación cooperativa (BE-19): puntos, racha, insignias y puntos de tripulación.

Todo se **calcula** a partir de `task_completion` (docs/data-model.md); solo se guardan las
insignias ganadas (`badge_award`, una por member e insignia), porque se conservan aunque
la racha se corte.

- **Puntos**: la suma de los puntos de las tareas completadas (los del perfil del entorno
  cuando se generó la tarea, BE-18).
- **Racha**: días seguidos, contando hacia atrás desde hoy (UTC, `clock.now()`), con al
  menos una tarea completada. Si hoy aún no hay ninguna, la racha sigue viva desde ayer:
  no se corta hasta que acaba el día.
- **Insignias**: catálogo en `app/data/badges.json`, con reglas `tasks_completed`
  (opcionalmente de un `task_type`), `points`, `streak` y `perfect_days` (días con todas
  sus tareas completadas). Se conceden al consultar o completar, con `earned_at = now()`.
- **Cooperativo**: `crew_points` suma a toda la tripulación del entorno; el leaderboard
  va en el orden de los members, no por puntos.

Antes de calcular se sincroniza el día de hoy (`routine.sync_day`), para que `/game` y
`/tasks` cuenten lo mismo aunque nadie haya abierto aún la lista de tareas.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from pydantic import TypeAdapter
from sqlalchemy import func
from sqlalchemy.dialects.sqlite import insert
from sqlmodel import Session, col, select

from app import clock, i18n, models
from app.schemas import Badge, BadgeDef, GameState, Leaderboard, LeaderboardEntry, TaskType
from app.services import crew, routine
from app.services import members as members_service

BADGES_FILE = Path(__file__).resolve().parent.parent / "data" / "badges.json"

_ADAPTER = TypeAdapter(list[BadgeDef])


# ── Catálogo de insignias ────────────────────────────────────────────


def load_badges(path: Path = BADGES_FILE) -> list[BadgeDef]:
    """Lee y valida badges.json. Sin caché (útil en tests)."""
    items = _ADAPTER.validate_json(path.read_bytes())
    ids = [b.id for b in items]
    duplicated = sorted({i for i in ids if ids.count(i) > 1})
    if duplicated:
        raise ValueError(f"Insignias duplicadas en {path.name}: {', '.join(duplicated)}")
    return items


def check_consistency(badges: list[BadgeDef], task_types: list[TaskType]) -> None:
    """Lanza ValueError si una insignia apunta a un tipo de tarea que no existe."""
    known = {t.id for t in task_types}
    errors = []
    for b in badges:
        if b.rule.task_type is not None:
            if b.rule.kind != "tasks_completed":
                errors.append(f"{b.id}: task_type solo vale con la regla tasks_completed")
            elif b.rule.task_type not in known:
                errors.append(f"{b.id}: el tipo de tarea '{b.rule.task_type}' no existe")
    if errors:
        raise ValueError("Insignias incoherentes:\n- " + "\n- ".join(errors))


@lru_cache(maxsize=1)
def _badges() -> dict[str, BadgeDef]:
    items = load_badges()
    check_consistency(items, routine.list_task_types())
    return {b.id: b for b in items}


def list_badges() -> list[BadgeDef]:
    """Las insignias del catálogo, en el orden del JSON (valida el fichero)."""
    return list(_badges().values())


def localized_badge(item: BadgeDef) -> BadgeDef:
    """Copia de la insignia en el idioma de la petición (FE-38)."""
    return i18n.localized("badges", item.id, item)


# ── Cálculo (puro) ───────────────────────────────────────────────────


@dataclass
class Stats:
    """Lo que hace falta para puntos, racha e insignias de un member."""

    points: int = 0
    completed: int = 0
    by_type: Counter[str] = field(default_factory=Counter)
    active_days: set[date] = field(default_factory=set)
    perfect_days: int = 0


def streak(active_days: set[date], today: date) -> int:
    """Días seguidos con alguna tarea completada, hasta hoy (o hasta ayer si hoy aún no)."""
    day = today if today in active_days else today - timedelta(days=1)
    n = 0
    while day in active_days:
        n += 1
        day -= timedelta(days=1)
    return n


def meets(badge: BadgeDef, stats: Stats, today: date) -> bool:
    rule = badge.rule
    if rule.kind == "tasks_completed":
        value = stats.by_type[rule.task_type] if rule.task_type else stats.completed
    elif rule.kind == "points":
        value = stats.points
    elif rule.kind == "streak":
        value = streak(stats.active_days, today)
    else:  # perfect_days
        value = stats.perfect_days
    return value >= rule.threshold


# ── BD ───────────────────────────────────────────────────────────────


def member_stats(session: Session, member_id: int) -> Stats:
    done = session.exec(
        select(models.Task.date, models.Task.task_type, models.Task.points)
        .join(models.TaskCompletion, col(models.TaskCompletion.task_id) == col(models.Task.id))
        .where(models.Task.member_id == member_id)
    ).all()
    stats = Stats()
    done_per_day: Counter[date] = Counter()
    for day, task_type, points in done:
        stats.points += points
        stats.completed += 1
        stats.by_type[task_type] += 1
        stats.active_days.add(day)
        done_per_day[day] += 1
    if done_per_day:
        totals = session.exec(
            select(models.Task.date, func.count())
            .where(models.Task.member_id == member_id)
            .where(col(models.Task.date).in_(list(done_per_day)))
            .group_by(col(models.Task.date))
        ).all()
        stats.perfect_days = sum(1 for day, total in totals if done_per_day[day] >= total)
    return stats


def _award(session: Session, member_id: int, stats: Stats, today: date) -> None:
    """Concede las insignias que se cumplen y aún no tiene (idempotente). Hace commit."""
    earned = [b.id for b in _badges().values() if meets(b, stats, today)]
    if earned:
        now = clock.now()
        rows = [{"member_id": member_id, "badge_id": b, "earned_at": now} for b in earned]
        session.exec(insert(models.BadgeAward).values(rows).on_conflict_do_nothing())  # type: ignore[call-overload]
    session.commit()


def badges_of(session: Session, member_id: int) -> list[Badge]:
    catalog = _badges()
    rows = session.exec(
        select(models.BadgeAward)
        .where(models.BadgeAward.member_id == member_id)
        .order_by(col(models.BadgeAward.earned_at), col(models.BadgeAward.id))
    ).all()
    return [
        Badge(
            id=r.badge_id,
            name=localized_badge(catalog[r.badge_id]).name,
            earned_at=r.earned_at,
        )
        for r in rows
        if r.badge_id in catalog  # una insignia retirada del catálogo deja de mostrarse
    ]


def crew_points(session: Session, env_id: str) -> int:
    rows = session.exec(
        select(models.Task.points)
        .join(models.TaskCompletion, col(models.TaskCompletion.task_id) == col(models.Task.id))
        .join(models.Member, col(models.Member.id) == col(models.Task.member_id))
        .where(models.Member.env_id == env_id)
    ).all()
    return sum(rows) + crew.crew_extra_points(session, env_id)


def game_state(session: Session, member: models.Member) -> GameState:
    """Puntos, racha e insignias del member y puntos de su tripulación."""
    routine.sync_day(session, member)
    today = routine.today()
    stats = member_stats(session, member.id)
    _award(session, member.id, stats, today)
    return GameState(
        points=stats.points,
        streak_days=streak(stats.active_days, today),
        badges=badges_of(session, member.id),
        crew_points=crew_points(session, member.env_id),
    )


def leaderboard(session: Session, env_id: str) -> Leaderboard:
    """Puntos de la tripulación. Cooperativo: en el orden de los members, no por puntos."""
    today = routine.today()
    entries = []
    for m in members_service.list_by_env(session, env_id):
        routine.sync_day(session, m)
        stats = member_stats(session, m.id)
        entries.append(
            LeaderboardEntry(
                member_id=m.id,
                name=m.name,
                points=stats.points,
                streak_days=streak(stats.active_days, today),
            )
        )
    return Leaderboard(
        env_id=env_id,
        crew_points=sum(e.points for e in entries) + crew.crew_extra_points(session, env_id),
        members=entries,
    )
