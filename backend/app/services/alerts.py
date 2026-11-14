"""Alertas automáticas desde la evaluación (BE-14).

Reglas (docs/alerts-and-escalation.md, "Alertas automáticas"):
- Tras cada assessment se abre o se actualiza **una alerta por member y sistema**
  (`dedupe_key = "<member_id>:<system_id>"`; el índice único parcial
  `ux_alert_open_dedupe` garantiza que no haya dos abiertas).
- `warning` → alerta en `self` (autocuidado). Si el warning persiste más de
  `environment.liveness.warning_escalate_after_s`, sube un nivel.
- `critical` → sube hasta el **primer nivel externo** (`external_from_level`, p. ej.
  `ground`): los niveles de a bordo se avisan al instante y el externo recibe la
  alerta por el enlace simulado (BE-13) con su ETA y, si toca, en modo autónomo (BE-31).
- Si empeora (warning → critical) se actualiza la misma alerta (`updated`), no se crea otra.
- Si vuelve a `normal` se registra una vez `updated` con `recovered: true` (se propone
  resolver); no se cierra sola sin dejar rastro.
- `unknown` (sin datos) no crea alertas: el `no_contact` es cosa de BE-16.
Cada paso queda en `alert_event` (timeline).
"""

import uuid
from collections.abc import Iterable, Sequence
from datetime import timedelta

from sqlmodel import Session, col, select

from app import clock, models
from app.schemas import Alert as AlertOut
from app.schemas import AlertEvent as AlertEventOut
from app.schemas import Assessment, Environment
from app.schemas.common import AlertStatus, EventType, LinkDirection, Status
from app.services import catalog, comm_link, environments, events
from app.services.assessment import escalation_for_level

OPEN = (AlertStatus.open, AlertStatus.escalated, AlertStatus.acknowledged)
NAMESPACE = uuid.UUID("0f3c9a2e-6b1d-4f7a-9c8e-2d5b7a1e4c90")
_SEVERITY = {Status.warning: "warning", Status.critical: "critical"}


def dedupe_key(member_id: int, system_id: str) -> str:
    return f"{member_id}:{system_id}"


def open_alert(session: Session, key: str) -> models.Alert | None:
    return session.exec(
        select(models.Alert).where(
            models.Alert.dedupe_key == key, col(models.Alert.status).in_([s.value for s in OPEN])
        )
    ).first()


def _event(
    session: Session, alert: models.Alert, type_: str, actor: str = "system", **payload
) -> None:
    session.add(
        models.AlertEvent(alert_id=alert.id, type=type_, actor=actor, payload=payload)
    )


def target_level(status: Status, env: Environment) -> int:
    """Nivel al que debe llegar una alerta automática según el estado del sistema."""
    if status == Status.critical:
        return min(env.external_from_level, len(env.escalation_ladder) - 1)
    return 0


def _apply_level(
    session: Session, alert: models.Alert, level: int, status: Status, env: Environment
) -> None:
    """Pone la alerta en `level` y, si es un nivel externo, la envía por el enlace."""
    esc = escalation_for_level(level, status, env)
    now = clock.now()
    alert.level = esc.level
    alert.target_role = esc.target_role
    alert.delivery_mode = esc.mode
    alert.delay_s = esc.delay_s
    alert.updated_at = now
    if esc.level > 0:
        alert.status = AlertStatus.escalated
    session.add(alert)
    if esc.level >= env.external_from_level and alert.eta is None:
        message = comm_link.send(
            session,
            alert.env_id,
            LinkDirection.up,
            "alert",
            ref_id=alert.id,
            payload={
                "member_id": alert.member_id,
                "system_id": alert.system_id,
                "severity": alert.severity,
                "target_role": alert.target_role,
                "message": alert.message,
            },
        )
        alert.eta = message.eta
        session.add(alert)
        _event(
            session, alert, "queued",
            target_role=alert.target_role, eta=message.eta.isoformat(), link=message.state,
        )
        if message.state == "delivered":
            mark_delivered(session, alert, message)


def _escalate(
    session: Session,
    alert: models.Alert,
    to_level: int,
    status: Status,
    env: Environment,
    actor: str = "system",
    **payload,
) -> None:
    """Sube nivel a nivel hasta `to_level` (cada paso queda en la timeline)."""
    while alert.level < to_level:
        level = alert.level + 1
        _event(
            session, alert, "escalated", actor,
            level=level, target_role=env.escalation_ladder[level], **payload,
        )
        _apply_level(session, alert, level, status, env)
        events.emit_alert(
            session, alert, EventType.alert_escalated,
            f"Alerta escalada a {env.escalation_ladder[level]}", actor=actor,
        )


def mark_delivered(session: Session, alert: models.Alert, message: models.LinkMessage) -> None:
    if alert.delivered_at is not None:
        return
    alert.delivered_at = message.delivered_at
    session.add(alert)
    _event(session, alert, "delivered", target_role=alert.target_role)


def on_link_delivered(session: Session, messages: Iterable[models.LinkMessage]) -> None:
    """Lo llama comm_link al entregar: marca las alertas que han llegado a tierra."""
    for message in messages:
        if message.kind == "alert" and message.ref_id:
            alert = session.get(models.Alert, message.ref_id)
            # Sin `eta` todavía: se está enviando ahora mismo y `_apply_level` lo marcará
            # después del evento `queued` (así la timeline queda en orden).
            if alert is not None and alert.eta is not None:
                mark_delivered(session, alert, message)


def _message(system_id: str, status: Status, protocol_message: str) -> str:
    if protocol_message:
        return protocol_message
    names = {s.id: s.name for s in catalog.list_systems()}
    estado = "en estado crítico" if status == Status.critical else "en aviso"
    return f"{names.get(system_id, system_id)} {estado}"


def evaluate(
    session: Session, member: models.Member, assessment: Assessment
) -> list[models.Alert]:
    """Abre, actualiza o escala las alertas del member según su assessment.

    Devuelve las alertas creadas o modificadas.
    """
    env = environments.get_environment(member.env_id)
    now = clock.now()
    changed: list[models.Alert] = []
    for system in assessment.systems:
        status = Status(system.status)
        key = dedupe_key(member.id, system.system_id)
        alert = open_alert(session, key)

        if status not in _SEVERITY:  # normal o unknown
            if status == Status.normal and alert is not None:
                recovered = session.exec(
                    select(models.AlertEvent).where(
                        models.AlertEvent.alert_id == alert.id,
                        models.AlertEvent.type == "updated",
                    )
                ).all()
                if not any(e.payload.get("recovered") for e in recovered):
                    _event(session, alert, "updated", recovered=True, status=status)
                    alert.updated_at = now
                    session.add(alert)
                    changed.append(alert)
            continue

        indicator_ids = [i.indicator_id for i in system.indicators if i.status != Status.normal]
        message = _message(system.system_id, status, system.escalation.message)
        if alert is None:
            alert = models.Alert(
                # Determinista (clave + instante): única porque solo hay una alerta abierta por
                # clave, y reproducible (mocks del front, tests).
                id=str(uuid.uuid5(NAMESPACE, f"auto:{key}:{now.isoformat()}")),
                member_id=member.id,
                env_id=member.env_id,
                origin="auto",
                category="indicator",
                severity=_SEVERITY[status],
                system_id=system.system_id,
                indicator_ids=indicator_ids,
                message=message,
                level=0,
                target_role=env.escalation_ladder[0],
                delivery_mode="realtime",
                status=AlertStatus.open,
                dedupe_key=key,
            )
            session.add(alert)
            session.flush()  # la alerta existe antes de sus eventos (FK)
            _apply_level(session, alert, 0, status, env)
            _event(session, alert, "created", severity=alert.severity, system_id=alert.system_id)
            events.emit_alert(
                session, alert, EventType.alert_created,
                f"Alerta automática ({alert.severity}): {alert.system_id or alert.category}",
            )
            _escalate(session, alert, target_level(status, env), status, env)
            changed.append(alert)
            continue

        worse = alert.severity == "warning" and status == Status.critical
        if worse or set(indicator_ids) != set(alert.indicator_ids):
            alert.severity = _SEVERITY[status] if worse else alert.severity
            alert.indicator_ids = indicator_ids
            alert.message = message
            alert.updated_at = now
            session.add(alert)
            _event(session, alert, "updated", severity=alert.severity, indicator_ids=indicator_ids)
            changed.append(alert)

        to_level = target_level(status, env)
        if status == Status.warning and alert.level < len(env.escalation_ladder) - 1:
            # Un warning que persiste sube un nivel por cada periodo (BE-33).
            since = _last_escalation(session, alert) or alert.created_at
            if now - since >= timedelta(seconds=env.liveness.warning_escalate_after_s):
                to_level = max(to_level, alert.level + 1)
        if to_level > alert.level:
            _escalate(session, alert, to_level, status, env)
            if alert not in changed:
                changed.append(alert)

    session.commit()
    return changed


def _last_escalation(session: Session, alert: models.Alert):
    event = session.exec(
        select(models.AlertEvent)
        .where(models.AlertEvent.alert_id == alert.id, models.AlertEvent.type == "escalated")
        .order_by(col(models.AlertEvent.at).desc())
    ).first()
    return event.at if event else None


def evaluate_member(session: Session, member: models.Member) -> list[models.Alert]:
    """Evalúa al member con sus datos de la BD y actualiza sus alertas."""
    from app.services.member_assessment import assess_member  # evita el ciclo de imports

    return evaluate(session, member, assess_member(session, member))


def reevaluate_open(session: Session) -> None:
    """Vuelve a evaluar a los members con alertas abiertas (p. ej. tras un fast-forward,
    para escalar los warnings que han persistido)."""
    member_ids = set(
        session.exec(
            select(models.Alert.member_id).where(
                col(models.Alert.status).in_([s.value for s in OPEN])
            )
        ).all()
    )
    for member_id in sorted(member_ids):
        member = session.get(models.Member, member_id)
        if member is not None:
            evaluate_member(session, member)


def count_open(session: Session, member_id: int) -> int:
    return len(
        session.exec(
            select(models.Alert.id).where(
                models.Alert.member_id == member_id,
                col(models.Alert.status).in_([s.value for s in OPEN]),
            )
        ).all()
    )


def list_for_member(
    session: Session, member_id: int, status: AlertStatus | str | None = None
) -> Sequence[models.Alert]:
    query = select(models.Alert).where(models.Alert.member_id == member_id)
    if status is not None:
        query = query.where(models.Alert.status == AlertStatus(status))
    return session.exec(query.order_by(col(models.Alert.created_at).desc())).all()


def to_schema(session: Session, alert: models.Alert) -> AlertOut:
    events = session.exec(
        select(models.AlertEvent)
        .where(models.AlertEvent.alert_id == alert.id)
        .order_by(col(models.AlertEvent.at), col(models.AlertEvent.id))
    ).all()
    return AlertOut(
        id=alert.id,
        member_id=alert.member_id,
        env_id=alert.env_id,
        origin=alert.origin,
        authenticated=alert.authenticated,
        created_by_user_id=alert.created_by_user_id,
        category=alert.category,
        severity=alert.severity,
        system_id=alert.system_id,
        indicator_ids=alert.indicator_ids,
        message=alert.message,
        level=alert.level,
        target_role=alert.target_role,
        delivery_mode=alert.delivery_mode,
        delay_s=alert.delay_s,
        eta=alert.eta,
        delivered_at=alert.delivered_at,
        status=alert.status,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
        events=[
            AlertEventOut(type=e.type, actor=e.actor, at=e.at, payload=e.payload) for e in events
        ],
    )


# --------------------------------------------------------------------------
# BE-15: alertas manuales (Pedir ayuda / SOS) y acciones sobre las alertas
# --------------------------------------------------------------------------


class AlertNotFound(LookupError):
    """La alerta no existe (→ 404)."""


class AlertConflict(Exception):
    """Mismo id con otro contenido, o acción no válida en ese estado (→ 409)."""


class InvalidAlert(ValueError):
    """Destino que no está en la escalera del entorno, o ya en el último nivel (→ 422)."""


def _status_for(severity: str) -> Status:
    """`emergency` se escala como `critical` (modo autónomo si el retardo es >= 60 s)."""
    return Status.warning if severity == "warning" else Status.critical


def _level_of(env: Environment, role: str) -> int:
    if role not in env.escalation_ladder:
        raise InvalidAlert(
            f"'{role}' no está en la escalera de {env.id}: {', '.join(env.escalation_ladder)}"
        )
    return env.escalation_ladder.index(role)


def get_alert(session: Session, alert_id: str) -> models.Alert:
    alert = session.get(models.Alert, str(alert_id))
    if alert is None:
        raise AlertNotFound(f"Alerta desconocida: {alert_id}")
    return alert


def _same_request(alert: models.Alert, member_id: int, body) -> bool:
    return (
        alert.member_id == member_id
        and alert.origin == "manual"
        and alert.category == body.category
        and alert.severity == body.severity
        and alert.message == (body.message or "")
        and alert.system_id == body.system_id
    )


def create_manual(
    session: Session,
    member: models.Member,
    body,
    *,
    authenticated: bool = True,
    created_by_user_id: int | None = None,
) -> tuple[models.Alert, bool]:
    """Pedir ayuda / SOS (`AlertIn`). Idempotente por el UUID del cliente.

    Devuelve (alerta, creada). Destino: el `target_role` pedido (se pueden saltar
    niveles); si no, `emergency`/`critical` suben hasta el primer nivel externo
    (la tripulación lo recibe al instante y tierra por el enlace) y `warning` va a
    la tripulación (nivel 1).
    """
    existing = session.get(models.Alert, str(body.id))
    if existing is not None:
        if not _same_request(existing, member.id, body):
            raise AlertConflict(f"La alerta {body.id} ya existe con otro contenido")
        return existing, False

    env = environments.get_environment(member.env_id)
    status = _status_for(body.severity)
    if body.target_role:
        to_level = _level_of(env, body.target_role)
    elif status == Status.critical:
        to_level = target_level(Status.critical, env)
    else:
        to_level = min(1, len(env.escalation_ladder) - 1)

    alert = models.Alert(
        id=str(body.id),
        member_id=member.id,
        env_id=member.env_id,
        origin="manual",
        authenticated=authenticated,  # False: SOS de emergencia sin sesión (BE-27)
        created_by_user_id=created_by_user_id,
        category=body.category,
        severity=body.severity,
        system_id=body.system_id,
        message=body.message or "",
        level=0,
        target_role=env.escalation_ladder[0],
        delivery_mode="realtime",
        status=AlertStatus.open,
    )
    session.add(alert)
    session.flush()
    _apply_level(session, alert, 0, status, env)
    _event(session, alert, "created", "member", category=alert.category, severity=alert.severity)
    events.emit_alert(
        session, alert, EventType.alert_created,
        "SOS: petición de ayuda" if alert.category == "emergency" else "Petición de ayuda",
        authenticated=alert.authenticated,
    )
    _escalate(session, alert, to_level, status, env, "member")
    session.commit()
    return alert, True


def escalate(
    session: Session,
    alert: models.Alert,
    target_role: str | None = None,
    message: str | None = None,
    actor: str = "member",
) -> models.Alert:
    """Sube la alerta al siguiente nivel, o al `target_role` (saltando niveles)."""
    if alert.status == AlertStatus.resolved:
        raise AlertConflict("La alerta ya está resuelta")
    env = environments.get_environment(alert.env_id)
    to_level = _level_of(env, target_role) if target_role else alert.level + 1
    if to_level >= len(env.escalation_ladder):
        raise InvalidAlert("La alerta ya está en el último nivel de la escalera")
    if to_level <= alert.level:
        raise InvalidAlert(f"La alerta ya está en '{alert.target_role}' o por encima")
    extra = {"message": message} if message else {}
    _escalate(session, alert, to_level, _status_for(alert.severity), env, actor, **extra)
    session.commit()
    return alert


def acknowledge(session: Session, alert: models.Alert, actor: str) -> models.Alert:
    if alert.status == AlertStatus.resolved:
        raise AlertConflict("La alerta ya está resuelta")
    alert.status = AlertStatus.acknowledged
    alert.updated_at = clock.now()
    session.add(alert)
    _event(session, alert, "acknowledged", actor)
    events.emit_alert(
        session, alert, EventType.alert_acknowledged, "Alerta reconocida", actor=actor
    )
    session.commit()
    return alert


def resolve(
    session: Session, alert: models.Alert, actor: str, note: str | None = None
) -> models.Alert:
    if alert.status == AlertStatus.resolved:
        raise AlertConflict("La alerta ya está resuelta")
    alert.status = AlertStatus.resolved  # libera la dedupe_key para una alerta nueva
    alert.updated_at = clock.now()
    session.add(alert)
    _event(session, alert, "resolved", actor, **({"note": note} if note else {}))
    events.emit_alert(session, alert, EventType.alert_resolved, "Alerta resuelta", actor=actor)
    session.commit()
    return alert


def add_message(session: Session, alert: models.Alert, actor: str, text: str) -> models.Alert:
    """Mensaje en la alerta. Si la alerta está en un nivel externo, viaja por el enlace:
    el member hacia tierra (`up`) y el responder hacia a bordo (`down`), con su ETA."""
    env = environments.get_environment(alert.env_id)
    payload: dict = {"text": text}
    if alert.level >= env.external_from_level and actor in ("member", "responder"):
        direction = LinkDirection.up if actor == "member" else LinkDirection.down
        sent = comm_link.send(
            session, alert.env_id, direction, "alert_event", ref_id=alert.id,
            payload={"actor": actor, "text": text},
        )
        payload.update(via_link=direction.value, eta=sent.eta.isoformat(), link=sent.state)
    alert.updated_at = clock.now()
    session.add(alert)
    _event(session, alert, "message", actor, **payload)
    session.commit()
    return alert
