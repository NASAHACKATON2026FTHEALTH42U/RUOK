"""Rutina diaria y gamificación. STUB(FS-02) → BE-18 (tareas) y BE-19 (puntos y leaderboard)."""

from datetime import date

from fastapi import APIRouter, HTTPException

from app import stubs
from app.routers.deps import ERRORS_404, ERRORS_AUTH, AuthDep
from app.schemas import GameState, Leaderboard, Slug, Task, TaskCompleteIn

router = APIRouter(tags=["game"], dependencies=[AuthDep], responses={**ERRORS_AUTH, **ERRORS_404})


@router.get(
    "/members/{member_id}/tasks",
    response_model=list[Task],
    summary="Tareas del día",
    description="STUB(FS-02) → BE-18",
)
def list_tasks(member_id: int, date: date | None = None) -> list[Task]:  # noqa: A002
    return stubs.TASKS


@router.post(
    "/members/{member_id}/tasks/{task_id}/complete",
    response_model=GameState,
    summary="Completar una tarea (idempotente por UUID)",
    description="STUB(FS-02) → BE-18/BE-19",
)
def complete_task(member_id: int, task_id: str, body: TaskCompleteIn) -> GameState:
    task = next((t for t in stubs.TASKS if t.id == task_id), None)
    if task is None:
        raise HTTPException(404, f"Tarea desconocida: {task_id}")
    return stubs.GAME.model_copy(update={"points": stubs.GAME.points + task.points})


@router.get(
    "/members/{member_id}/game",
    response_model=GameState,
    summary="Puntos, racha e insignias",
    description="STUB(FS-02) → BE-19",
)
def game_state(member_id: int) -> GameState:
    return stubs.GAME


@router.get(
    "/environments/{env_id}/leaderboard",
    response_model=Leaderboard,
    summary="Puntos de la tripulación (cooperativo)",
    description="STUB(FS-02) → BE-19",
)
def leaderboard(env_id: Slug) -> Leaderboard:
    if env_id not in stubs.ENV_BY_ID:
        raise HTTPException(404, f"Entorno desconocido: {env_id}")
    return stubs.leaderboard(env_id)
