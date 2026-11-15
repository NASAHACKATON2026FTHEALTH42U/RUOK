"""Vigilancia del liveness: check-in "R U OK?" y alerta `no_contact` (BE-16).

Reglas (docs/offline-and-liveness.md, "Check-in R U OK?"):
1. El member pasa a `stale` → se abre un check-in (`ruok_check`) y su dispositivo,
   si sigue vivo, recibe `checkin_required` en el heartbeat ("R U OK?" a pantalla completa).
2. Si no responde en `ruok_timeout_s`, o pasa a `lost` → alerta `no_contact` `critical`:
   la tripulación la recibe al instante y tierra por el enlace, con su ETA (BE-14/BE-31/BE-13).
3. Solo se vigila a quien **ya ha enviado algún heartbeat** (`member.device_id`): un
   member que aún no ha conectado su dispositivo no dispara alertas (como en BE-12).

La revisión la hace una tarea periódica (`watch_loop`, en el arranque de la app), el
fast-forward de la demo y los escenarios. Usa siempre el reloj de la demo.
"""

import asyncio
import logging
import os
import uuid
from datetime import timedelta

from sqlmodel import Session, col, select

from app import clock, i18n, models
from app.schemas import AlertIn, RuokResult
from app.schemas.common import AlertStatus, EventType, Liveness, Status
from app.services import alerts, control, environments, events
from app.services.liveness import member_liveness

log = logging.getLogger(__name__)
WATCH_INTERVAL_S = 10
NAMESPACE = uuid.UUID("7b2f5c1e-3d4a-4e8b-9f6c-1a2b3c4d5e6f")


def no_contact_key(member_id: int) -> str:
    return f"{member_id}:no_contact"


def pending_check(session: Session, member_id: int) -> models.RuokCheck | None:
    """El check-in "R U OK?" sin responder más antiguo del member."""
    return session.exec(
        select(models.RuokCheck)
        .where(
            models.RuokCheck.member_id == member_id,
            col(models.RuokCheck.responded_at).is_(None),
        )
        .order_by(col(models.RuokCheck.requested_at))
    ).first()


def check_member(session: Session, member: models.Member) -> models.Alert | None:
    """Revisa el liveness de un member. Devuelve la alerta `no_contact` si la crea."""
    if not member.device_id:
        return None  # nunca ha conectado un dispositivo
    if control.is_liveness_paused(session, member.env_id):
        return None  # pausado desde /control durante la presentación (BE-30)
    env = environments.get_environment(member.env_id)
    now = clock.now()
    live = member_liveness(member, now)
    if live == Liveness.active:
        return None

    check = pending_check(session, member.id)
    if check is None:
        check = models.RuokCheck(member_id=member.id, requested_at=now)
        session.add(check)
        session.commit()
        session.refresh(check)

    timed_out = now - check.requested_at >= timedelta(seconds=env.liveness.ruok_timeout_s)
    if live != Liveness.lost and not timed_out:
        return None
    if alerts.open_alert(session, no_contact_key(member.id)) is not None:
        return None  # ya hay una abierta: sin duplicados

    since = member.last_seen_at.strftime("%H:%M") if member.last_seen_at else "?"
    alert = models.Alert(
        id=str(uuid.uuid5(NAMESPACE, f"no_contact:{member.id}:{now.isoformat()}")),
        member_id=member.id,
        env_id=member.env_id,
        origin="auto",
        category="no_contact",
        severity="critical",
        # En español en la BD; `alerts.localized_message` lo traduce al leerlo (FE-38).
        message=alerts.NO_CONTACT_MESSAGE.format(name=member.name, since=since),
        level=0,
        target_role=env.escalation_ladder[0],
        delivery_mode="realtime",
        status=AlertStatus.open,
        dedupe_key=no_contact_key(member.id),
    )
    session.add(alert)
    session.flush()
    alerts._apply_level(session, alert, 0, Status.critical, env)
    alerts._event(
        session, alert, "created",
        category="no_contact", liveness=live.value, timed_out=timed_out,
    )
    events.emit_alert(
        session, alert, EventType.alert_created, i18n.tr("Sin contacto con el member")
    )
    to_level = alerts.target_level(Status.critical, env)  # crew al instante, ground por el enlace
    alerts._escalate(session, alert, to_level, Status.critical, env)
    check.alert_id = alert.id
    session.add(check)
    session.commit()
    return alert


def check_all(session: Session) -> list[models.Alert]:
    """Revisa a todos los members vigilados (con dispositivo)."""
    members = session.exec(
        select(models.Member).where(col(models.Member.device_id).is_not(None))
    ).all()
    return [a for m in members if (a := check_member(session, m)) is not None]


def answer_ruok(
    session: Session, member: models.Member, ok: bool, note: str | None = None
) -> RuokResult:
    """Respuesta al "R U OK?". Cuenta como señal de vida.

    - `ok=false` ("Necesito ayuda") → alerta `critical` (a bordo al instante, tierra por
      el enlace) y se devuelve su id.
    - `ok=true` con una `no_contact` abierta → se resuelve.
    """
    now = clock.now()
    for check in session.exec(
        select(models.RuokCheck).where(
            models.RuokCheck.member_id == member.id, col(models.RuokCheck.responded_at).is_(None)
        )
    ).all():
        check.responded_at = now
        check.ok = ok
        check.note = note
        session.add(check)
    member.last_seen_at = now
    session.add(member)
    session.commit()

    alert_id = None
    open_no_contact = alerts.open_alert(session, no_contact_key(member.id))
    if ok:
        if open_no_contact is not None:
            alerts.resolve(session, open_no_contact, "member", alerts.RUOK_OK_NOTE)
    else:
        body = AlertIn(
            id=uuid.uuid5(NAMESPACE, f"ruok:{member.id}:{now.isoformat()}"),
            category="symptom",
            severity="critical",
            message=alerts.RUOK_HELP_MESSAGE + (f": {note}" if note else ""),
        )
        alert, _ = alerts.create_manual(session, member, body)
        alert_id = alert.id
    session.refresh(member)
    return RuokResult(liveness=member_liveness(member), alert_id=alert_id)


async def watch_loop(engine, interval_s: float = WATCH_INTERVAL_S) -> None:
    """Tarea periódica: revisa el liveness cada `interval_s` segundos."""

    def run_once() -> None:
        with Session(engine) as session:
            check_all(session)

    while True:
        await asyncio.sleep(interval_s)
        try:
            await asyncio.to_thread(run_once)
        except Exception:  # la vigilancia no debe tumbar el servidor
            log.exception("Error revisando el liveness")


def watch_enabled() -> bool:
    """Se puede desactivar con RUOK_LIVENESS_WATCH=0 (p. ej. en los tests)."""
    return os.environ.get("RUOK_LIVENESS_WATCH", "1") != "0"
