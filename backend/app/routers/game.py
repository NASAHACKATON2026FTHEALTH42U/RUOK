"""Rutina diaria (BE-18) y gamificación cooperativa (BE-19)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import models
from app.routers.deps import (
    ERRORS_404,
    ERRORS_409,
    ERRORS_AUTH,
    AuthDep,
    SessionDep,
    allow_env,
    allow_member,
)
from app.schemas import GameState, Leaderboard, Slug, Task, TaskCompleteIn
from app.services import environments, gamification, members, routine

router = APIRouter(tags=["game"], dependencies=[AuthDep], responses={**ERRORS_AUTH, **ERRORS_404})


def _member(session: Session, member_id: int) -> models.Member:
    m = members.get_member(session, member_id)
    if m is None:
        raise HTTPException(404, f"Member desconocido: {member_id}")
    return m


@router.get(
    "/members/{member_id}/tasks",
    response_model=list[Task],
    summary="Tareas del día",
    description="Se generan desde `environment.routine` la primera vez que se piden (o al medir). "
    "`date` por defecto: hoy (UTC, reloj del servidor). Las tareas con `indicator_id` se "
    "autocompletan con las mediciones de ese indicador del mismo día.",
    dependencies=[Depends(allow_member("game:read"))],
)
def list_tasks(member_id: int, session: SessionDep, date: date | None = None) -> list[Task]:  # noqa: A002
    return routine.list_tasks(session, _member(session, member_id), date)


@router.post(
    "/members/{member_id}/tasks/{task_id}/complete",
    response_model=GameState,
    summary="Completar una tarea (idempotente por UUID)",
    description="Reenviar el mismo `id` no suma dos veces; una tarea ya completada (con otro "
    "UUID o por una medición) tampoco. El mismo `id` para otra tarea → 409. Emite "
    "`task.completed`. Devuelve el `GameState` actualizado (puntos, racha e insignias).",
    responses=ERRORS_409,
    dependencies=[Depends(allow_member("game:write"))],
)
def complete_task(
    member_id: int, task_id: str, body: TaskCompleteIn, session: SessionDep
) -> GameState:
    member = _member(session, member_id)
    try:
        routine.complete(session, member, task_id, body)
    except routine.TaskNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    except routine.CompletionConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    return gamification.game_state(session, member)


@router.get(
    "/members/{member_id}/game",
    response_model=GameState,
    summary="Puntos, racha e insignias",
    description="Calculado de las tareas completadas. Racha: días seguidos con alguna tarea "
    "completada (hoy, o hasta ayer si hoy aún no). Insignias de `badges.json`; una vez "
    "ganadas se conservan. `crew_points`: la suma de toda la tripulación.",
    dependencies=[Depends(allow_member("game:read"))],
)
def game_state(member_id: int, session: SessionDep) -> GameState:
    return gamification.game_state(session, _member(session, member_id))


@router.get(
    "/environments/{env_id}/leaderboard",
    response_model=Leaderboard,
    summary="Puntos de la tripulación (cooperativo)",
    description="`crew_points` y la aportación de cada member, en el orden de los members "
    "(no es un ranking).",
    dependencies=[Depends(allow_env("game:read"))],
)
def leaderboard(env_id: Slug, session: SessionDep) -> Leaderboard:
    if environments.get_environment(env_id) is None:
        raise HTTPException(404, f"Entorno desconocido: {env_id}")
    return gamification.leaderboard(session, env_id)
