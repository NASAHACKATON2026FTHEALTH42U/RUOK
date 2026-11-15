"""Rutina diaria y gamificación cooperativa."""

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, Slug


class Task(ApiModel):
    id: str = Field(
        description="Determinista: t_{date}_{member}_{task_type}, con _{n} si times_per_day > 1"
    )
    task_type: Slug
    title: str
    points: int
    due: str = Field(examples=["morning", "afternoon", "evening", "any"])
    completed: bool
    indicator_id: Slug | None = Field(
        default=None, description="Se autocompleta al medir este indicador"
    )


class TaskCompleteIn(ApiModel):
    id: UUID = Field(description="UUID del completado, generado en el cliente")
    completed_at: datetime


class ProtocolCompleteIn(ApiModel):
    """El member ha hecho todos los pasos de un protocolo de respuesta (una intervención)."""

    id: UUID = Field(description="UUID del completado, generado en el cliente")
    completed_at: datetime
    alert_id: str | None = Field(
        default=None, description="Alerta a la que responde (los puntos cuentan una vez por alerta)"
    )


class Badge(ApiModel):
    id: Slug
    name: str
    earned_at: datetime


class GameState(ApiModel):
    points: int
    streak_days: int
    badges: list[Badge] = Field(default_factory=list)
    crew_points: int


class LeaderboardEntry(ApiModel):
    member_id: int
    name: str
    points: int
    streak_days: int


class Leaderboard(ApiModel):
    """Cooperativo: lo importante es crew_points, no el ranking."""

    env_id: Slug
    crew_points: int
    members: list[LeaderboardEntry]


class KudosIn(ApiModel):
    id: UUID = Field(description="UUID v4 generado en el cliente (idempotencia)")
    to_member_id: int
    message: str = Field(min_length=1, max_length=200)


class Kudos(ApiModel):
    id: UUID
    env_id: Slug
    from_member_id: int
    to_member_id: int
    message: str
    created_at: datetime


class MissionJoinIn(ApiModel):
    id: UUID = Field(description="UUID v4 generado en el cliente (idempotencia)")


class CrewMission(ApiModel):
    """Misión grupal del día: se completa al llegar a `min_participants`."""

    id: Slug
    title: str
    points: int
    min_participants: int
    date: date
    participants: list[int] = Field(default_factory=list, description="member_id apuntados")
    completed: bool
