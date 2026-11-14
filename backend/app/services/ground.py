"""Consola /ground (BE-17): lo que ve tierra, solo lo ENTREGADO por el enlace.

Ver docs/offline-and-liveness.md (§3, consola "as-of") y docs/alerts-and-escalation.md.
- `as_of`: el instante al que corresponde lo que se ve = ahora − retardo del enlace. En LOS,
  el último momento conocido (`link.since`).
- `alerts`: solo las que el enlace ya ha entregado a tierra (`delivered_at <= ahora`).
- `members`: su resumen, con `last_seen_at`. **En LOS el estado es desconocido**: el
  `overall_status` sale `unknown` (gris, nunca verde).
- **Privacidad conductual:** el detalle de las alertas psicológicas o del sistema
  neuro-conductual solo se ve si el member comparte sus detalles, si es una emergencia o si
  quien mira es `psych` / `admin` (el rol llega con BE-27). Si no, "Alerta conductual activa".
"""

from datetime import timedelta

from sqlmodel import Session, col, select

from app import clock, models
from app.schemas import Alert, GroundView
from app.schemas.common import LinkState, Status
from app.services import alerts, comm_link, members

BEHAVIORAL_SYSTEM = "neuro_behavioral"
HIDDEN_MESSAGE = "Alerta conductual activa"
DETAIL_ROLES = {"psych", "admin"}


def is_behavioral(alert: models.Alert) -> bool:
    return alert.category == "psychological" or alert.system_id == BEHAVIORAL_SYSTEM


def can_see_details(alert: models.Alert, member: models.Member, viewer_role: str | None) -> bool:
    return (
        not is_behavioral(alert)
        or alert.severity == "emergency"
        or member.share_behavioral_details
        or viewer_role in DETAIL_ROLES
    )


def _redact(alert: Alert) -> Alert:
    """Quita el detalle conductual: mensaje genérico, sin indicadores ni textos en la timeline."""
    events = [e.model_copy(update={"payload": {}}) for e in alert.events]
    return alert.model_copy(
        update={"message": HIDDEN_MESSAGE, "indicator_ids": [], "events": events}
    )


def ground_view(session: Session, env_id: str, viewer_role: str | None = None) -> GroundView:
    """Vista de la consola de tierra del entorno. UnknownEnvironment si no existe."""
    link = comm_link.status(session, env_id)  # entrega antes lo que ya ha llegado
    now = clock.now()
    los = link.state == LinkState.los
    as_of = link.since if los else now - timedelta(seconds=link.delay_s)

    rows = session.exec(
        select(models.Alert)
        .where(
            models.Alert.env_id == env_id,
            col(models.Alert.delivered_at).is_not(None),
            col(models.Alert.delivered_at) <= now,
        )
        .order_by(col(models.Alert.delivered_at).desc())
    ).all()
    by_member = {m.id: m for m in members.list_by_env(session, env_id)}
    visible: list[Alert] = []
    for row in rows:
        alert = alerts.to_schema(session, row)
        member = by_member.get(row.member_id)
        if member is not None and not can_see_details(row, member, viewer_role):
            alert = _redact(alert)
        visible.append(alert)

    summaries = []
    for member in by_member.values():
        summary = members.to_summary(session, member)
        if los:  # sin enlace no se sabe cómo están ahora: nunca en verde
            summary = summary.model_copy(update={"overall_status": Status.unknown})
        summaries.append(summary)

    return GroundView(env_id=env_id, as_of=as_of, link=link, members=summaries, alerts=visible)
