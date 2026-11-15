"""Resúmenes en texto del estado de un member (hoy o la semana) para contárselo a casa.

Deterministas, a partir de los datos reales (evaluación y mediciones): nada inventado y ningún
LLM. Solo palabras de estado y nombres de sistema: ni cifras clínicas ni detalles conductuales.
"""

from __future__ import annotations

import re
from datetime import timedelta

from sqlmodel import Session, col, select

from app import clock, i18n, models
from app.schemas import StatusSummary
from app.services import catalog, member_assessment

WORD = {
    "normal": "bien",
    "warning": "con algo que vigilar",
    "critical": "con algo importante que atender",
    "unknown": "sin datos recientes",
}

# Frase completa por estado (FE-38: se traduce entera con `i18n.tr`, en messages.json).
OVERALL = {status: f"En general estoy {word}." for status, word in WORD.items()}


def _lower_names(names: list[str]) -> str:
    """Nombres de sistema en minúscula para la frase, salvo las siglas («ojos (SANS)»)."""
    return _join([re.sub(r"\b(?![A-Z]{2,}\b)\w+", lambda m: m.group(0).lower(), n) for n in names])


def _join(items: list[str]) -> str:
    if len(items) == 1:
        return items[0]
    return i18n.tr("{first} y {last}", first=", ".join(items[:-1]), last=items[-1])


def summary(session: Session, member: models.Member, period: str) -> StatusSummary:
    now = clock.now()
    names = {s.id: catalog.localized_system(s).name for s in catalog.load_systems()}
    a = member_assessment.assess_member(session, member)
    attention = [
        names.get(s.system_id, s.system_id)
        for s in a.systems
        if s.status in ("warning", "critical")
    ]
    unknown = [names.get(s.system_id, s.system_id) for s in a.systems if s.status == "unknown"]
    parts = [i18n.tr(OVERALL.get(a.overall_status, OVERALL["unknown"]))]
    if attention:
        parts.append(i18n.tr("Tengo que vigilar: {systems}.", systems=_lower_names(attention)))
    elif a.overall_status == "normal":
        parts.append(i18n.tr("Todos los sistemas que mido están en su rango."))
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
        if not rows:
            intro = i18n.tr("Esta semana no he registrado mediciones.")
        elif len(rows) == 1:
            intro = i18n.tr(
                "Esta semana me he medido 1 vez en {days} de los últimos 7 días.", days=days
            )
        else:
            intro = i18n.tr(
                "Esta semana me he medido {n} veces en {days} de los últimos 7 días.",
                n=len(rows), days=days,
            )
        parts.insert(0, intro)
    else:
        parts.insert(0, i18n.tr("Así estoy hoy:"))
    if unknown and period == "day":
        parts.append(i18n.tr("Me falta medir: {systems}.", systems=_lower_names(unknown)))
    return StatusSummary(member_id=member.id, period=period, text=" ".join(parts), generated_at=now)
