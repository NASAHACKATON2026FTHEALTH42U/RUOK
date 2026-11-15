"""Mensaje a casa (BE-22): mensajes personales por el enlace con la Tierra."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, LinkDirection


class HomeMessageIn(ApiModel):
    id: UUID = Field(description="UUID v4 generado en el cliente (idempotencia)")
    text: str = Field(min_length=1, max_length=500)


class HomeMessage(ApiModel):
    id: UUID
    member_id: int
    direction: LinkDirection = Field(description="up = del member a casa; down = respuesta")
    text: str
    sender: str | None = Field(default=None, description="Quién responde (solo `down`)")
    in_reply_to: UUID | None = None
    sent_at: datetime
    eta: datetime
    delivered_at: datetime | None = None
    state: Literal["queued", "in_transit", "delivered"]


class StatusSummary(ApiModel):
    """Resumen en texto del estado de hoy o de la semana, para contárselo a casa."""

    member_id: int
    period: Literal["day", "week"]
    text: str = Field(description="Resumen en lenguaje llano, con los datos reales (sin LLM)")
    generated_at: datetime
