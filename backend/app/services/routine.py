"""Rutina diaria (BE-18): tareas del día desde `environment.routine`.

- Los tipos de tarea (título, momento del día, indicador que la autocompleta) están en
  `app/data/task_types.json`; el entorno elige cuáles usa, cuántas veces y sus puntos.
- Las tareas de un día se generan bajo demanda (al pedirlas o al medir) con un id
  determinista: `t_{date}_{member}_{task_type}`, y `_{n}` (1..N) si `times_per_day > 1`.
  Generar dos veces no duplica (`INSERT ... ON CONFLICT DO NOTHING`).
- Completar es idempotente por el UUID del cliente: el mismo UUID otra vez no hace nada;
  el mismo UUID para otra tarea es un conflicto (409). Una tarea ya completada (con otro
  UUID o por una medición) se queda como está: no suma dos veces.
- Las tareas con `indicator_id` se autocompletan con las mediciones de ese indicador del
  mismo día (UTC): una medición completa como mucho una tarea, la primera pendiente.
- El "día" es la fecha UTC del reloj del servidor (`clock.now()`).
- Cada completado emite `task.completed` (BE-28). Puntos y rachas se calculan a partir de
  `task_completion` (BE-19).
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path

from pydantic import TypeAdapter
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app import clock, models
from app.schemas import GameState, TaskCompleteIn, TaskType
from app.schemas import Task as TaskOut
from app.schemas.common import EventType
from app.schemas.config import Environment
from app.services import catalog, environments, events

TASK_TYPES_FILE = Path(__file__).resolve().parent.parent / "data" / "task_types.json"

_ADAPTER = TypeAdapter(list[TaskType])
_TASK_ID = re.compile(r"^t_(\d{4}-\d{2}-\d{2})_(\d+)_")
# Id del completado automático: derivado de la medición, así repetirlo no duplica.
_AUTO_NS = uuid.UUID("5f0c9a52-8d3e-4b7a-9c61-2e4f7a1b3d90")


class TaskNotFound(Exception):
    """La tarea no existe para ese member (→ 404)."""


class CompletionConflict(Exception):
    """El UUID del completado ya se usó para otra tarea (→ 409)."""


# ── Catálogo de tipos de tarea ───────────────────────────────────────


def load_task_types(path: Path = TASK_TYPES_FILE) -> list[TaskType]:
    """Lee y valida task_types.json. Sin caché (útil en tests)."""
    items = _ADAPTER.validate_json(path.read_bytes())
    ids = [t.id for t in items]
    duplicated = sorted({i for i in ids if ids.count(i) > 1})
    if duplicated:
        raise ValueError(f"Tipos de tarea duplicados en {path.name}: {', '.join(duplicated)}")
    return items


def check_consistency(task_types: list[TaskType], envs: list[Environment]) -> None:
    """Lanza ValueError si la rutina de un entorno o un tipo de tarea no encajan."""
    by_id = {t.id: t for t in task_types}
    errors: list[str] = []
    for t in task_types:
        if t.indicator_id and catalog.get_indicator(t.indicator_id) is None:
            errors.append(f"tipo {t.id}: el indicador '{t.indicator_id}' no existe")
    for env in envs:
        for item in env.routine:
            tt = by_id.get(item.task_type)
            if tt is None:
                errors.append(f"entorno {env.id}: el tipo de tarea '{item.task_type}' no existe")
            elif tt.indicator_id and tt.indicator_id not in env.indicators:
                errors.append(
                    f"entorno {env.id}: '{item.task_type}' se autocompleta con "
                    f"'{tt.indicator_id}', que no está en sus indicadores"
                )
            if item.times_per_day < 1:
                errors.append(f"entorno {env.id}: '{item.task_type}' con times_per_day < 1")
    if errors:
        raise ValueError("Rutina incoherente:\n- " + "\n- ".join(errors))


@lru_cache(maxsize=1)
def _task_types() -> dict[str, TaskType]:
    items = load_task_types()
    check_consistency(items, environments.list_environments())
    return {t.id: t for t in items}


def list_task_types() -> list[TaskType]:
    """Los tipos de tarea (valida el fichero y la rutina de los entornos)."""
    return list(_task_types().values())


# ── Generación ───────────────────────────────────────────────────────


def today() -> date:
    return clock.now().astimezone(UTC).date()


def task_id(day: date, member_id: int, task_type: str, n: int | None = None) -> str:
    base = f"t_{day.isoformat()}_{member_id}_{task_type}"
    return base if n is None else f"{base}_{n}"


def plan_day(env: Environment, member_id: int, day: date) -> list[models.Task]:
    """Tareas del día según la rutina del entorno (puro, sin BD)."""
    types = _task_types()
    tasks: list[models.Task] = []
    for item in env.routine:
        tt = types[item.task_type]
        times = item.times_per_day
        for i in range(times):
            multi = times > 1
            tasks.append(
                models.Task(
                    id=task_id(day, member_id, tt.id, i + 1 if multi else None),
                    member_id=member_id,
                    date=day,
                    task_type=tt.id,
                    title=f"{tt.title} ({i + 1}/{times})" if multi else tt.title,
                    points=item.points,
                    due=tt.slots[i] if i < len(tt.slots) else tt.due,
                    indicator_id=tt.indicator_id,
                )
            )
    return tasks


def ensure_tasks(session: Session, member: models.Member, day: date) -> list[models.Task]:
    """Crea (si faltan) las tareas del día y las devuelve en el orden de la rutina. Sin commit.

    Las ya generadas se conservan tal cual (título y puntos del momento en que se crearon).
    """
    env = environments.get_environment(member.env_id)
    planned = plan_day(env, member.id, day) if env else []
    if planned:
        rows = [t.model_dump() for t in planned]
        session.exec(insert(models.Task).values(rows).on_conflict_do_nothing())  # type: ignore[call-overload]
    order = {t.id: i for i, t in enumerate(planned)}
    stored = session.exec(
        select(models.Task).where(models.Task.member_id == member.id, models.Task.date == day)
    ).all()
    return sorted(stored, key=lambda t: (order.get(t.id, len(order)), t.id))


def _completions(session: Session, task_ids: list[str]) -> dict[str, models.TaskCompletion]:
    if not task_ids:
        return {}
    rows = session.exec(
        select(models.TaskCompletion).where(col(models.TaskCompletion.task_id).in_(task_ids))
    ).all()
    return {c.task_id: c for c in rows}


# ── Completar ────────────────────────────────────────────────────────


def _add_completion(
    session: Session,
    member: models.Member,
    task: models.Task,
    completion_id: str,
    completed_at: datetime,
    *,
    auto: bool,
) -> models.TaskCompletion:
    row = models.TaskCompletion(
        id=completion_id, task_id=task.id, member_id=member.id, completed_at=completed_at
    )
    session.add(row)
    events.emit(
        session, EventType.task_completed, env_id=member.env_id, member_id=member.id,
        ref_id=task.id, summary=f"{member.name} completó «{task.title}» (+{task.points})",
        payload={"task_id": task.id, "task_type": task.task_type, "points": task.points,
                 "date": task.date.isoformat(), "auto": auto},
    )
    return row


def _autocomplete_day(session: Session, member: models.Member, day: date) -> list[models.Task]:
    """Completa las tareas de medición pendientes del día con las mediciones de ese día.

    Genera las tareas si faltan y las devuelve. Sin commit.
    """
    tasks = ensure_tasks(session, member, day)
    pending: dict[str, list[models.Task]] = {}
    done = _completions(session, [t.id for t in tasks])
    for t in tasks:
        if t.indicator_id and t.id not in done:
            pending.setdefault(t.indicator_id, []).append(t)
    if not pending:
        return tasks
    start = datetime.combine(day, time.min, tzinfo=UTC)
    measured = session.exec(
        select(models.Measurement)
        .where(
            models.Measurement.member_id == member.id,
            col(models.Measurement.indicator_id).in_(list(pending)),
            col(models.Measurement.taken_at) >= start,
            col(models.Measurement.taken_at) < start + timedelta(days=1),
        )
        .order_by(col(models.Measurement.taken_at), col(models.Measurement.id))
    ).all()
    for m in measured:
        queue = pending.get(m.indicator_id)
        if not queue:
            continue
        cid = str(uuid.uuid5(_AUTO_NS, m.id))
        if session.get(models.TaskCompletion, cid) is not None:
            continue  # esta medición ya completó otra tarea
        _add_completion(session, member, queue.pop(0), cid, m.taken_at, auto=True)
    return tasks


def on_measurements(session: Session, member_id: int, rows: list[models.Measurement]) -> None:
    """Autocompleta con las mediciones nuevas (en la transacción del lote, sin commit)."""
    member = session.get(models.Member, member_id)
    if member is None or not rows:
        return
    for day in sorted({r.taken_at.astimezone(UTC).date() for r in rows}):
        _autocomplete_day(session, member, day)


def list_tasks(session: Session, member: models.Member, day: date | None = None) -> list[TaskOut]:
    """Tareas del día (hoy por defecto), generándolas si hace falta. Hace commit."""
    day = day or today()
    try:
        tasks = _list(session, member, day)
    except IntegrityError:  # otra petición ha completado lo mismo a la vez
        session.rollback()
        tasks = _list(session, member, day)
    return tasks


def _list(session: Session, member: models.Member, day: date) -> list[TaskOut]:
    tasks = _autocomplete_day(session, member, day)
    done = _completions(session, [t.id for t in tasks])
    session.commit()
    return [to_schema(t, t.id in done) for t in tasks]


def _find_task(session: Session, member: models.Member, tid: str) -> models.Task:
    task = session.get(models.Task, tid)
    if task is None:
        # Puede llegar del outbox antes de que el servidor haya generado ese día.
        match = _TASK_ID.match(tid)
        if match and int(match.group(2)) == member.id:
            try:
                day = date.fromisoformat(match.group(1))
            except ValueError:
                day = None
            if day is not None:
                ensure_tasks(session, member, day)
                task = session.get(models.Task, tid)
    if task is None or task.member_id != member.id:
        raise TaskNotFound(f"Tarea desconocida: {tid}")
    return task


def complete(
    session: Session, member: models.Member, tid: str, body: TaskCompleteIn
) -> bool:
    """Completa una tarea de forma idempotente. Devuelve True si es un completado nuevo."""
    try:
        return _complete(session, member, tid, body)
    except IntegrityError:  # el mismo completado ha llegado a la vez por otra vía
        session.rollback()
        return _complete(session, member, tid, body)


def _complete(session: Session, member: models.Member, tid: str, body: TaskCompleteIn) -> bool:
    task = _find_task(session, member, tid)
    cid = str(body.id)
    previous = session.get(models.TaskCompletion, cid)
    if previous is not None:
        if previous.task_id != task.id:
            raise CompletionConflict(f"El completado {cid} ya se usó para otra tarea")
        session.commit()
        return False
    if _completions(session, [task.id]):
        session.commit()  # ya estaba completada: no suma dos veces
        return False
    completed_at = body.completed_at
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=UTC)
    _add_completion(session, member, task, cid, completed_at, auto=False)
    session.commit()
    return True


# ── Puntos (base para BE-19) ─────────────────────────────────────────


def _points(session: Session, member_ids: list[int]) -> int:
    if not member_ids:
        return 0
    rows = session.exec(
        select(models.Task.points)
        .join(models.TaskCompletion, col(models.TaskCompletion.task_id) == col(models.Task.id))
        .where(col(models.Task.member_id).in_(member_ids))
    ).all()
    return sum(rows)


def game_state(session: Session, member: models.Member) -> GameState:
    """Puntos del member y de su tripulación, sumados de las tareas completadas.

    STUB(BE-19): la racha y las insignias.
    """
    crew = session.exec(
        select(models.Member.id).where(models.Member.env_id == member.env_id)
    ).all()
    return GameState(
        points=_points(session, [member.id]),
        streak_days=0,
        badges=[],
        crew_points=_points(session, [i for i in crew if i is not None]),
    )


def to_schema(task: models.Task, completed: bool) -> TaskOut:
    return TaskOut(
        id=task.id,
        task_type=task.task_type,
        title=task.title,
        points=task.points,
        due=task.due,
        completed=completed,
        indicator_id=task.indicator_id,
    )
