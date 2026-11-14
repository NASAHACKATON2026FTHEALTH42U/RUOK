"""Rutina diaria y gamificación cooperativa."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, Slug


class Task(ApiModel):
    id: str = Field(description="Determinista: t_{date}_{member}_{task_type}")
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
