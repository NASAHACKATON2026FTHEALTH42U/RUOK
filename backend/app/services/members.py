"""Members en la base de datos (BE-05).

Real: los datos del member, su privacidad, la fecha de su última medición y
el `overall_status` del resumen (BE-11) y el `liveness` (BE-12).
STUB hasta su issue (ver docs/backend.md, sección "Members"):
- `open_alerts` → BE-14 (alertas).

Los members los crea el seed (app/seed.py, BE-07).
"""

from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, col, select

from app import models, stubs
from app.schemas import Member, MemberSummary
from app.services.liveness import member_liveness


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


def to_schema(row: models.Member) -> Member:
    return Member(
        id=row.id,
        env_id=row.env_id,
        name=row.name,
        position=row.position,
        share_behavioral_details=row.share_behavioral_details,
        last_seen_at=row.last_seen_at,
        liveness=member_liveness(row),
    )


def to_summary(session: Session, row: models.Member) -> MemberSummary:
    # Import local: member_assessment importa este módulo (evita el ciclo).
    from app.services.member_assessment import assess_member

    member = to_schema(row)
    stub = stubs.member_summary(member)  # STUB → BE-14 (alertas)
    return MemberSummary(
        **member.model_dump(),
        overall_status=assess_member(session, row).overall_status,
        open_alerts=stub.open_alerts,
        last_measurement_at=last_measurement_at(session, row.id),
    )
