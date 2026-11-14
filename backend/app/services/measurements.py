"""Mediciones (BE-06): lotes idempotentes por UUID y series temporales.

Principio "sin pérdida de datos" (docs/offline-and-liveness.md):
- Cada medición trae un UUID generado en el cliente. Reenviar el mismo id con el
  mismo contenido no la duplica: cuenta como `duplicate`.
- El mismo id con contenido distinto es un conflicto (409).
- El lote es atómico: si una medición es inválida o está en conflicto, no se
  guarda ninguna, y el cliente puede corregir y reenviar el lote entero.
- Solo se añade, nunca se edita (tabla `measurement` append-only).
"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app import clock, models
from app.schemas import Indicator, MeasurementIn
from app.schemas import Measurement as MeasurementOut
from app.schemas.common import EventType
from app.services import catalog, events

# Un lote con mediciones tomadas hace más de esto viene del outbox (estaba sin conexión).
SYNC_AGE = timedelta(minutes=10)


class InvalidMeasurement(Exception):
    """La medición no encaja con el catálogo (→ 422)."""


class MeasurementConflict(Exception):
    """Mismo id con contenido distinto (→ 409)."""


def validate(item: MeasurementIn) -> Indicator:
    """El indicador existe en el catálogo y el valor está dentro del rango del input."""
    indicator = catalog.get_indicator(item.indicator_id)
    if indicator is None:
        raise InvalidMeasurement(f"Indicador desconocido: {item.indicator_id}")
    if item.taken_at.tzinfo is None:
        raise InvalidMeasurement(f"{item.id}: taken_at necesita zona horaria (p. ej. ...Z)")
    lo, hi = indicator.input.min, indicator.input.max
    if (lo is not None and item.value < lo) or (hi is not None and item.value > hi):
        raise InvalidMeasurement(
            f"{item.indicator_id}: el valor {item.value:g} está fuera del rango "
            f"permitido [{lo:g}, {hi:g}] ({indicator.unit})"
        )
    return indicator


def as_utc(value: datetime) -> datetime:
    """A UTC con zona. Una fecha sin zona se interpreta como UTC (query strings)."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def same_content(row: models.Measurement, member_id: int, item: MeasurementIn) -> bool:
    """True si la medición guardada es la misma que la que llega (reintento)."""
    return (
        row.member_id == member_id
        and row.indicator_id == item.indicator_id
        and row.value == item.value
        and as_utc(row.taken_at) == as_utc(item.taken_at)
        and row.source == item.source
        and row.note == item.note
    )


def _emit_batch(session: Session, member_id: int, rows: list[models.Measurement]) -> None:
    """`measurement.created` por medición nueva, o un solo `sync.batch` si el lote llega
    del outbox de un dispositivo que ha estado sin conexión."""
    if not rows:
        return
    member = session.get(models.Member, member_id)
    env_id = member.env_id if member else None
    oldest = min(as_utc(r.taken_at) for r in rows)
    if len(rows) > 1 and clock.now() - oldest > SYNC_AGE:
        events.emit(
            session, EventType.sync_batch, env_id=env_id, member_id=member_id,
            summary=f"Sincronizadas {len(rows)} mediciones pendientes",
            payload={"count": len(rows), "oldest_taken_at": oldest.isoformat(),
                     "indicators": sorted({r.indicator_id for r in rows})},
        )
        return
    for r in rows:
        events.emit(
            session, EventType.measurement_created, env_id=env_id, member_id=member_id,
            ref_id=r.id, summary=f"{r.indicator_id} = {r.value:g}",
            payload={"indicator_id": r.indicator_id, "value": r.value,
                     "taken_at": as_utc(r.taken_at).isoformat()},
        )


def save_batch(
    session: Session, member_id: int, items: Sequence[MeasurementIn]
) -> tuple[int, int]:
    """Guarda un lote de forma idempotente y atómica. Devuelve (accepted, duplicates)."""
    try:
        return _save_batch(session, member_id, items)
    except IntegrityError:
        # Otro envío del mismo lote se ha guardado entre la lectura y el commit
        # (p. ej. dos pestañas sincronizando a la vez): se reintenta una vez y
        # ahora esas mediciones cuentan como duplicadas (o 409 si difieren).
        session.rollback()
        return _save_batch(session, member_id, items)


def _save_batch(
    session: Session, member_id: int, items: Sequence[MeasurementIn]
) -> tuple[int, int]:
    indicators = [validate(item) for item in items]  # todo el lote antes de escribir

    accepted, duplicates = 0, 0
    pending: dict[str, models.Measurement] = {}  # nuevas de este lote, por id
    for item, indicator in zip(items, indicators, strict=True):
        key = str(item.id)
        existing = pending.get(key) or session.get(models.Measurement, key)
        if existing is not None:
            if not same_content(existing, member_id, item):
                raise MeasurementConflict(f"La medición {key} ya existe con otro contenido")
            duplicates += 1
            continue
        row = models.Measurement(
            id=key,
            member_id=member_id,
            indicator_id=item.indicator_id,
            value=item.value,
            unit=indicator.unit,
            taken_at=item.taken_at,
            source=item.source,
            note=item.note,
        )  # received_at = clock.now() (valor por defecto del modelo)
        pending[key] = row
        accepted += 1

    session.add_all(pending.values())
    _emit_batch(session, member_id, list(pending.values()))
    session.commit()
    return accepted, duplicates


def list_series(
    session: Session,
    member_id: int,
    indicator_id: str | None = None,
    from_: datetime | None = None,
    to: datetime | None = None,
) -> list[models.Measurement]:
    """Mediciones de un member ordenadas por `taken_at`, con filtros opcionales."""
    query = select(models.Measurement).where(models.Measurement.member_id == member_id)
    if indicator_id is not None:
        query = query.where(models.Measurement.indicator_id == indicator_id)
    if from_ is not None:
        query = query.where(col(models.Measurement.taken_at) >= as_utc(from_))
    if to is not None:
        query = query.where(col(models.Measurement.taken_at) <= as_utc(to))
    query = query.order_by(col(models.Measurement.taken_at), col(models.Measurement.id))
    return list(session.exec(query).all())


def to_schema(row: models.Measurement) -> MeasurementOut:
    return MeasurementOut(
        id=row.id,
        member_id=row.member_id,
        indicator_id=row.indicator_id,
        value=row.value,
        unit=row.unit,
        taken_at=row.taken_at,
        received_at=row.received_at,
        source=row.source,
        note=row.note,
    )
