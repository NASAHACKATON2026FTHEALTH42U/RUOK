"""Rutina diaria (BE-18), gamificación cooperativa (BE-19), kudos y misiones (BE-23)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
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
from app.schemas import (
    CrewMission,
    GameState,
    Kudos,
    KudosIn,
    Leaderboard,
    MissionJoinIn,
    ProtocolCompleteIn,
    Slug,
    Task,
    TaskCompleteIn,
)
from app.services import crew, environments, gamification, members, protocols, routine

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


@router.post(
    "/members/{member_id}/interventions/{intervention_id}/complete",
    response_model=GameState,
    summary="Protocolo de respuesta completado (idempotente por UUID)",
    description="El member ha hecho todos los pasos de un protocolo. Suma los puntos de "
    "`protocol` una vez por alerta y protocolo (sin alerta, una vez al día) como tarea "
    "completada del día (`task.completed`), deja un mensaje en la línea de tiempo de la alerta "
    "y una notificación del sistema (`notification.sent`). El mismo `id` para otra cosa → 409.",
    responses=ERRORS_409,
    dependencies=[Depends(allow_member("game:write"))],
)
def complete_protocol(
    member_id: int, intervention_id: str, body: ProtocolCompleteIn, session: SessionDep
) -> GameState:
    member = _member(session, member_id)
    try:
        protocols.complete(session, member, intervention_id, body)
    except protocols.ProtocolNotFound as exc:
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


def _env(env_id: str) -> None:
    if environments.get_environment(env_id) is None:
        raise HTTPException(404, f"Entorno desconocido: {env_id}")


@router.post(
    "/members/{member_id}/kudos",
    response_model=Kudos,
    summary="Dar un kudos a un compañero (idempotente por UUID)",
    description="Suma `kudos.points` a los `crew_points`. A uno mismo o a otro entorno → 422. "
    "Mismo `id` con otro contenido, o pasar el límite diario → 409.",
    responses={**ERRORS_409, 422: {"description": "Destinatario no válido"}},
    dependencies=[Depends(allow_member("game:write"))],
)
def give_kudos(member_id: int, body: KudosIn, session: SessionDep) -> Kudos:
    try:
        return crew.give_kudos(
            session, _member(session, member_id), body.id, body.to_member_id, body.message
        )
    except crew.InvalidKudos as exc:
        raise HTTPException(422, str(exc)) from exc
    except crew.Conflict as exc:
        raise HTTPException(409, str(exc)) from exc


@router.get(
    "/environments/{env_id}/kudos",
    response_model=list[Kudos],
    summary="Kudos recientes del entorno",
    dependencies=[Depends(allow_env("game:read"))],
)
def list_kudos(
    env_id: Slug, session: SessionDep, limit: int = Query(50, ge=1, le=200)
) -> list[Kudos]:
    _env(env_id)
    return crew.list_kudos(session, env_id, limit)


@router.get(
    "/environments/{env_id}/missions",
    response_model=list[CrewMission],
    summary="Misiones de tripulación del día",
    description="Catálogo de `crew_game.json` para el entorno, con quién se ha apuntado y si "
    "está completada. `date` por defecto: hoy.",
    dependencies=[Depends(allow_env("game:read"))],
)
def list_missions(env_id: Slug, session: SessionDep, date: date | None = None) -> list[CrewMission]:  # noqa: A002
    _env(env_id)
    return crew.list_missions(session, env_id, date)


@router.post(
    "/members/{member_id}/missions/{mission_id}/join",
    response_model=CrewMission,
    summary="Apuntarse a una misión de hoy (idempotente)",
    description="Al llegar a `min_participants` la misión se completa y suma sus puntos a "
    "`crew_points`. Apuntarse dos veces no duplica.",
    responses=ERRORS_409,
    dependencies=[Depends(allow_member("game:write"))],
)
def join_mission(
    member_id: int, mission_id: Slug, body: MissionJoinIn, session: SessionDep
) -> CrewMission:
    try:
        return crew.join_mission(session, _member(session, member_id), mission_id, body.id)
    except crew.UnknownMission as exc:
        raise HTTPException(404, str(exc)) from exc
    except crew.Conflict as exc:
        raise HTTPException(409, str(exc)) from exc
