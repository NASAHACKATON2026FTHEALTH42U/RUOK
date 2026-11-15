"""Resúmenes en texto del estado de un member (hoy o la semana) para contárselo a casa.

Deterministas, a partir de los datos reales (evaluación y mediciones): nada inventado y ningún
LLM. Solo palabras de estado y nombres de sistema: ni cifras clínicas ni detalles conductuales.
"""

from __future__ import annotations

from datetime import timedelta

from sqlmodel import Session, col, select

from app import clock, models
from app.schemas import StatusSummary
from app.services import catalog, member_assessment

WORD = {
    "normal": "bien",
    "warning": "con algo que vigilar",
    "critical": "con algo importante que atender",
    "unknown": "sin datos recientes",
}


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " y " + items[-1]


def summary(session: Session, member: models.Member, period: str) -> StatusSummary:
    now = clock.now()
    names = {s.id: s.name for s in catalog.load_systems()}
    a = member_assessment.assess_member(session, member)
    attention = [
        names.get(s.system_id, s.system_id)
        for s in a.systems
        if s.status in ("warning", "critical")
    ]
    unknown = [names.get(s.system_id, s.system_id) for s in a.systems if s.status == "unknown"]
    parts = [f"En general estoy {WORD.get(a.overall_status, 'sin datos recientes')}."]
    if attention:
        parts.append(f"Tengo que vigilar: {_join(attention).lower()}.")
    elif a.overall_status == "normal":
        parts.append("Todos los sistemas que mido están en su rango.")
    if period == "week":
        since = now - timedelta(days=7)
        rows = session.exec(
            select(models.Measurement.taken_at).where(
                models.Measurement.member_id == member.id,
                col(models.Measurement.taken_at) >= since,
                col(models.Measurement.taken_at) <= now,
            )
        ).all()
        days = len({r.date() for r in rows})
        intro = (
            f"Esta semana me he medido {len(rows)} {'vez' if len(rows) == 1 else 'veces'} "
            f"en {days} de los últimos 7 días."
            if rows
            else "Esta semana no he registrado mediciones."
        )
        parts.insert(0, intro)
    else:
        parts.insert(0, "Así estoy hoy:")
    if unknown and period == "day":
        parts.append(f"Me falta medir: {_join(unknown).lower()}.")
    return StatusSummary(member_id=member.id, period=period, text=" ".join(parts), generated_at=now)
