"""Members en la base de datos (BE-05).

Real: los datos del member, su privacidad y la fecha de su última medición.
STUB hasta su issue (ver docs/backend.md, sección "Members"):
- `liveness` → BE-12 (heartbeat);
- `overall_status` → BE-11 (evaluación);
- `open_alerts` → BE-14 (alertas).

STUB → BE-07 (seed): mientras no exista el seed, la app inserta al arrancar los
members de ejemplo de `app/stubs.py` (`ensure_demo_members`).
"""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, col, select

from app import models, stubs
from app.schemas import Member, MemberSummary
from app.schemas.common import Liveness

_STUB_BY_ID = {m.id: m for m in stubs.MEMBERS}


def ensure_demo_members(session: Session) -> int:
    """Si la tabla `member` está vacía, inserta los members de los stubs.

    Devuelve cuántos ha insertado (0 si ya había members).
    """
    if session.exec(select(models.Member).limit(1)).first() is not None:
        return 0
    for m in stubs.MEMBERS:
        session.add(
            models.Member(
                id=m.id,
                env_id=m.env_id,
                name=m.name,
                position=m.position,
                share_behavioral_details=m.share_behavioral_details,
                last_seen_at=m.last_seen_at,
            )
        )
    session.commit()
    return len(stubs.MEMBERS)


def get_member(session: Session, member_id: int) -> models.Member | None:
    return session.get(models.Member, member_id)


def list_by_env(session: Session, env_id: str) -> list[models.Member]:
    query = select(models.Member).where(models.Member.env_id == env_id)
    return list(session.exec(query.order_by(col(models.Member.id))).all())


def set_privacy(session: Session, member: models.Member, share: bool) -> models.Member:
    """Guarda si el member comparte sus detalles conductuales."""
    member.share_behavioral_details = share
    session.add(member)
    session.commit()
    session.refresh(member)
    # TODO(BE-28): events.emit("member.privacy_changed") si se añade al contrato.
    return member


def last_measurement_at(session: Session, member_id: int) -> datetime | None:
    """`taken_at` de la medición más reciente del member (None si no tiene)."""
    query = select(func.max(models.Measurement.taken_at)).where(
        models.Measurement.member_id == member_id
    )
    # func.max conserva el tipo de la columna (UTCDateTime): devuelve la fecha en UTC.
    return session.exec(query).one()


def stub_liveness(member_id: int) -> Liveness:
    """STUB → BE-12. El de los stubs; sin dato, `stale` (sin datos nunca es verde)."""
    stub = _STUB_BY_ID.get(member_id)
    return stub.liveness if stub is not None else Liveness.stale


def to_schema(row: models.Member) -> Member:
    return Member(
        id=row.id,
        env_id=row.env_id,
        name=row.name,
        position=row.position,
        share_behavioral_details=row.share_behavioral_details,
        last_seen_at=row.last_seen_at,
        liveness=stub_liveness(row.id),
    )


def to_summary(session: Session, row: models.Member) -> MemberSummary:
    member = to_schema(row)
    stub = stubs.member_summary(member)  # STUB → BE-11 (estado) y BE-14 (alertas)
    return MemberSummary(
        **member.model_dump(),
        overall_status=stub.overall_status,
        open_alerts=stub.open_alerts,
        last_measurement_at=last_measurement_at(session, row.id),
    )
