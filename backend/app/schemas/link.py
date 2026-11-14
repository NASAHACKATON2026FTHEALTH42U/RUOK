"""Enlace simulado con la Tierra (docs/alerts-and-escalation.md#enlace-simulado)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import ApiModel, LinkDirection, LinkState, Slug


class LinkStatus(ApiModel):
    env_id: Slug
    state: LinkState
    delay_s: int
    queued: int = Field(description="Mensajes en cola esperando entrega")
    since: datetime


class LinkMessage(ApiModel):
    id: int
    env_id: Slug
    direction: LinkDirection
    kind: Literal["alert", "alert_event", "home_message"]
    ref_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    sent_at: datetime
    eta: datetime
    delivered_at: datetime | None = None
    state: Literal["queued", "in_transit", "delivered"]
