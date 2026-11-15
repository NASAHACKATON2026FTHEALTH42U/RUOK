"""Alertas, escalado y consola ground (docs/alerts-and-escalation.md)."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.common import (
    Actor,
    AlertCategory,
    AlertEventType,
    AlertOrigin,
    AlertSeverity,
    AlertStatus,
    ApiModel,
    EscalationMode,
    NotificationLevel,
    Slug,
)
from app.schemas.link import LinkStatus
from app.schemas.members import MemberSummary


class AlertIn(ApiModel):
    """Petición manual de ayuda (SOS). Con category=emergency se acepta sin token."""

    id: UUID = Field(description="UUID v4 generado en el cliente (idempotencia)")
    category: AlertCategory
    severity: AlertSeverity
    message: str | None = None
    system_id: Slug | None = None
    target_role: str | None = Field(
        default=None, description="Permite saltar niveles (p. ej. ground)"
    )


class AlertEvent(ApiModel):
    type: AlertEventType
    actor: Actor
    at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class Alert(ApiModel):
    id: UUID
    member_id: int
    env_id: Slug
    origin: AlertOrigin
    authenticated: bool = Field(description="false = SOS de emergencia enviado sin sesión")
    created_by_user_id: int | None = None
    category: AlertCategory
    severity: AlertSeverity
    system_id: Slug | None = None
    indicator_ids: list[Slug] = Field(default_factory=list)
    message: str
    level: int = Field(ge=0, description="Posición en environment.escalation_ladder")
    target_role: str
    delivery_mode: EscalationMode
    delay_s: int
    eta: datetime | None = None
    delivered_at: datetime | None = None
    status: AlertStatus
    created_at: datetime
    updated_at: datetime
    events: list[AlertEvent] = Field(default_factory=list)


class EscalateIn(ApiModel):
    target_role: str | None = Field(default=None, description="Por defecto, el siguiente nivel")
    message: str | None = None


class AckIn(ApiModel):
    actor: Actor


class ResolveIn(ApiModel):
    actor: Actor
    note: str | None = None


class AlertMessageIn(ApiModel):
    actor: Actor
    text: str = Field(min_length=1)


class NotificationIn(ApiModel):
    """Notificación personalizada a un member (operador o staff). Idempotente por `id`."""

    id: UUID
    title: str | None = Field(default=None, max_length=80)
    text: str = Field(min_length=1, max_length=500)
    level: NotificationLevel = NotificationLevel.info


class GroundView(ApiModel):
    """Consola /ground: SOLO lo entregado por el enlace, siempre 'as-of'."""

    env_id: Slug
    as_of: datetime = Field(
        description="Instante al que corresponde lo que se ve (ahora - retardo)"
    )
    link: LinkStatus
    members: list[MemberSummary]
    alerts: list[Alert]
