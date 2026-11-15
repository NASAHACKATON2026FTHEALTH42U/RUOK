"""Catálogo de indicadores, sistemas del cuerpo (BE-04), intervenciones (BE-21) y
protocolos (CNT-02).

Carga y valida app/data/indicators.json y app/data/systems.json con los schemas
del contrato (app/schemas/config.py), que rechazan campos desconocidos. Además
comprueba que los dos ficheros y environments.json son coherentes entre sí.
Se lee una sola vez y queda en memoria; la app lo valida al arrancar.

Los rangos son provisionales hasta CNT-01: ver la tabla de docs/sources.md.

Idioma (FE-38): las funciones `localized_*` dan la copia en el idioma de la petición, con las
capas de app/data/i18n/en/. Solo para lo que sale por la API: el motor de evaluación y los
umbrales usan siempre los objetos originales (en caché, sin modificar).
"""

import re
from collections.abc import Iterable
from functools import lru_cache
from pathlib import Path

from pydantic import TypeAdapter

from app import i18n
from app.schemas import (
    Assessment,
    BodySystem,
    Environment,
    Indicator,
    Intervention,
    Protocol,
)
from app.services import environments

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
INDICATORS_FILE = DATA_DIR / "indicators.json"
SYSTEMS_FILE = DATA_DIR / "systems.json"
INTERVENTIONS_FILE = DATA_DIR / "interventions.json"
PROTOCOLS_FILE = DATA_DIR / "protocols.json"
SOURCES_FILE = DATA_DIR.parents[2] / "docs" / "sources.md"

_INDICATORS = TypeAdapter(list[Indicator])
_SYSTEMS = TypeAdapter(list[BodySystem])
_INTERVENTIONS = TypeAdapter(list[Intervention])
_PROTOCOLS = TypeAdapter(list[Protocol])


def _check_unique(ids: list[str], filename: str) -> None:
    duplicated = sorted({i for i in ids if ids.count(i) > 1})
    if duplicated:
        raise ValueError(f"Ids duplicados en {filename}: {', '.join(duplicated)}")


def load_indicators(path: Path = INDICATORS_FILE) -> list[Indicator]:
    """Lee y valida indicators.json. Sin caché (útil en tests)."""
    items = _INDICATORS.validate_json(path.read_bytes())
    _check_unique([i.id for i in items], path.name)
    return items


def load_systems(path: Path = SYSTEMS_FILE) -> list[BodySystem]:
    """Lee y valida systems.json. Sin caché (útil en tests)."""
    items = _SYSTEMS.validate_json(path.read_bytes())
    _check_unique([s.id for s in items], path.name)
    return items


def check_consistency(
    indicators: list[Indicator],
    systems: list[BodySystem],
    envs: Iterable[Environment] = (),
) -> None:
    """Lanza ValueError si indicadores, sistemas y entornos no encajan."""
    ind_by_id = {i.id: i for i in indicators}
    sys_ids = {s.id for s in systems}
    errors: list[str] = []

    for ind in indicators:
        if ind.system_id not in sys_ids:
            errors.append(f"{ind.id}: system_id '{ind.system_id}' no existe en systems.json")

    listed: set[str] = set()
    for system in systems:
        for ind_id in system.indicators:
            ind = ind_by_id.get(ind_id)
            if ind is None:
                errors.append(f"{system.id}: el indicador '{ind_id}' no existe")
            elif ind.system_id != system.id:
                errors.append(f"{system.id}: '{ind_id}' pertenece a '{ind.system_id}'")
            listed.add(ind_id)

    for ind_id in sorted(set(ind_by_id) - listed):
        errors.append(f"{ind_id}: no aparece en la lista de ningún sistema")

    for env in envs:
        for ind_id in env.indicators:
            if ind_id not in ind_by_id:
                errors.append(f"entorno {env.id}: el indicador '{ind_id}' no existe")
        # BE-34: un override con una errata se ignoraría en silencio (el motor no lo aplicaría).
        for ind_id in env.threshold_overrides:
            if ind_id not in ind_by_id:
                errors.append(
                    f"entorno {env.id}: threshold_overrides de '{ind_id}', que no existe"
                )
            elif ind_id not in env.indicators:
                errors.append(
                    f"entorno {env.id}: threshold_overrides de '{ind_id}', "
                    "que no está en sus indicators"
                )
        # BE-34: el front muestra el nombre de cada nivel con el vocabulario del entorno.
        for role in env.escalation_ladder:
            if role != "self" and not env.vocabulary.get(role):
                errors.append(
                    f"entorno {env.id}: el rol '{role}' de escalation_ladder no tiene "
                    "texto en vocabulary"
                )

    if errors:
        raise ValueError("Catálogo incoherente:\n- " + "\n- ".join(errors))


@lru_cache(maxsize=1)
def _catalog() -> tuple[dict[str, Indicator], list[BodySystem]]:
    indicators = load_indicators()
    systems = load_systems()
    check_consistency(indicators, systems, environments.list_environments())
    return {i.id: i for i in indicators}, systems


def list_indicators() -> list[Indicator]:
    """Los indicadores, en el orden del JSON."""
    return list(_catalog()[0].values())


def get_indicator(indicator_id: str) -> Indicator | None:
    """Un indicador por id, o None si no existe."""
    return _catalog()[0].get(indicator_id)


def list_systems() -> list[BodySystem]:
    """Los sistemas del cuerpo, en el orden del JSON."""
    return list(_catalog()[1])


def localized_indicator(item: Indicator) -> Indicator:
    """Copia del indicador en el idioma de la petición (FE-38)."""
    return i18n.localized("indicators", item.id, item)


def localized_system(item: BodySystem) -> BodySystem:
    """Copia del sistema del cuerpo en el idioma de la petición (FE-38)."""
    return i18n.localized("systems", item.id, item)


def localized_unit(indicator_id: str, unit: str) -> str:
    """Unidad visible de una medición o evaluación en el idioma de la petición (FE-38).

    Las mediciones guardan la unidad del catálogo en español (``lpm``); solo se traduce si
    coincide con ella (una unidad distinta se deja como está).
    """
    if i18n.lang() == "es":
        return unit
    ind = get_indicator(indicator_id)
    if ind is None or unit != ind.unit:
        return unit
    return localized_indicator(ind).unit


# ── Intervenciones (BE-21) ─────────────────────────────────────────────


def load_interventions(path: Path = INTERVENTIONS_FILE) -> list[Intervention]:
    """Lee y valida interventions.json. Sin caché (útil en tests)."""
    items = _INTERVENTIONS.validate_json(path.read_bytes())
    _check_unique([i.id for i in items], path.name)
    return items


def check_interventions(
    interventions: list[Intervention],
    indicators: list[Indicator],
    systems: list[BodySystem],
    source_ids: set[str] | None = None,
) -> None:
    """Lanza ValueError si una intervención apunta a un sistema, indicador o fuente que no
    existe, o a un indicador de otro sistema. ``source_ids=None`` no comprueba fuentes."""
    ind_by_id = {i.id: i for i in indicators}
    sys_ids = {s.id for s in systems}
    errors: list[str] = []
    for item in interventions:
        if item.system_id is not None and item.system_id not in sys_ids:
            errors.append(f"{item.id}: system_id '{item.system_id}' no existe")
        for ind_id in item.indicator_ids:
            ind = ind_by_id.get(ind_id)
            if ind is None:
                errors.append(f"{item.id}: el indicador '{ind_id}' no existe")
            elif item.system_id is not None and ind.system_id != item.system_id:
                errors.append(f"{item.id}: '{ind_id}' es de '{ind.system_id}'")
        if source_ids is not None:
            for src in item.sources:
                if src not in source_ids:
                    errors.append(f"{item.id}: la fuente '{src}' no está en docs/sources.md")
    if errors:
        raise ValueError("interventions.json incoherente:\n- " + "\n- ".join(errors))


def source_ids(path: Path = SOURCES_FILE) -> set[str] | None:
    """IDs de las tablas de docs/sources.md (``| S3 |``). None si el doc no está (Docker)."""
    if not path.exists():
        return None
    return set(re.findall(r"^\|\s*(S\d+)\s*\|", path.read_text(encoding="utf-8"), re.M))


@lru_cache(maxsize=1)
def _interventions() -> tuple[Intervention, ...]:
    items = load_interventions()
    indicators, systems = list_indicators(), list_systems()
    check_interventions(items, indicators, systems, source_ids())
    return tuple(items)


def list_interventions(
    system_id: str | None = None, category: str | None = None
) -> list[Intervention]:
    """Las intervenciones, en el orden del JSON, filtradas por sistema y categoría."""
    return [
        i
        for i in _interventions()
        if (system_id is None or i.system_id == system_id)
        and (category is None or i.category == category)
    ]


def get_intervention(intervention_id: str) -> Intervention | None:
    return next((i for i in _interventions() if i.id == intervention_id), None)


def localized_intervention(item: Intervention) -> Intervention:
    """Copia de la intervención en el idioma de la petición (FE-38)."""
    return i18n.localized("interventions", item.id, item)


# ── Protocolos (CNT-02) ────────────────────────────────────────────────


def load_protocols(path: Path = PROTOCOLS_FILE) -> list[Protocol]:
    """Lee y valida protocols.json. Sin caché (útil en tests)."""
    items = _PROTOCOLS.validate_json(path.read_bytes())
    _check_unique([p.id for p in items], path.name)
    return items


def check_protocols(
    protocols: list[Protocol],
    systems: list[BodySystem],
    source_ids: set[str] | None = None,
) -> None:
    """Lanza ValueError si un protocolo apunta a un sistema o fuente que no existe, si dos
    cubren el mismo sistema y estado (solo se usaría el primero) o la misma categoría de
    alerta, o si se repite el id de una recomendación. ``source_ids=None`` no comprueba
    fuentes."""
    sys_ids = {s.id for s in systems}
    errors: list[str] = []
    covered: dict[tuple[str, str], str] = {}
    rec_ids: list[str] = []
    for item in protocols:
        if item.system_id is not None and item.system_id not in sys_ids:
            errors.append(f"{item.id}: system_id '{item.system_id}' no existe")
        # Un protocolo de categoría cuenta como (categoría, "") para detectar repetidos.
        scope = item.system_id or f"alerta {item.alert_category}"
        for status in item.statuses or [""]:
            other = covered.setdefault((scope, status), item.id)
            if other != item.id:
                where = f"{scope}/{status}" if status else scope
                errors.append(f"{item.id}: {where} ya lo cubre '{other}'")
        rec_ids += [r.id for r in item.recommendations]
        if source_ids is not None:
            for src in item.sources:
                if src not in source_ids:
                    errors.append(f"{item.id}: la fuente '{src}' no está en docs/sources.md")
    for rec_id in sorted({r for r in rec_ids if rec_ids.count(r) > 1}):
        errors.append(f"recomendación repetida: '{rec_id}'")
    if errors:
        raise ValueError("protocols.json incoherente:\n- " + "\n- ".join(errors))


@lru_cache(maxsize=1)
def _protocols() -> tuple[Protocol, ...]:
    items = load_protocols()
    check_protocols(items, list_systems(), source_ids())
    return tuple(items)


def list_protocols() -> list[Protocol]:
    """Los protocolos, en el orden del JSON (valida el fichero)."""
    return list(_protocols())


def protocol_for_alert(category: str) -> Protocol | None:
    """El protocolo de una categoría de alerta (p. ej. ``no_contact``), o None."""
    return next((p for p in _protocols() if p.alert_category == category), None)


def localized_protocol(item: Protocol) -> Protocol:
    """Copia del protocolo en el idioma de la petición (FE-38). Para quien saque sus textos
    por la API (evaluación, alertas): la selección por sistema y estado usa el original."""
    return i18n.localized("protocols", item.id, item)


def localized_assessment(assessment: Assessment) -> Assessment:
    """Copia del assessment con sus textos en el idioma de la petición (FE-38).

    El motor evalúa con los catálogos en español; aquí se traducen, ya a la salida, las
    recomendaciones (de protocolo o de intervención), el mensaje del escalado y las unidades.
    No añade ni quita nada (la privacidad conductual ya se ha aplicado antes).
    """
    if i18n.lang() == "es":
        return assessment
    originals = {p.id: p for p in _protocols()}
    protocols = {pid: localized_protocol(p) for pid, p in originals.items()}
    rec_texts = {r.id: r.text for p in protocols.values() for r in p.recommendations}
    systems = []
    for system in assessment.systems:
        recs = []
        for rec in system.recommendations:
            text = rec_texts.get(rec.id)
            item = get_intervention(rec.intervention_id) if rec.intervention_id else None
            if text is None and item is not None and rec.id == f"rec_{item.id}":
                text = f"{localized_intervention(item).title} ({item.duration_min} min)"
            recs.append(rec.model_copy(update={"text": text}) if text else rec)
        escalation = system.escalation
        pid = escalation.protocol_id or ""
        if pid in originals and escalation.message == originals[pid].message:
            escalation = escalation.model_copy(update={"message": protocols[pid].message})
        indicators = [
            i.model_copy(update={"unit": localized_unit(i.indicator_id, i.unit)})
            for i in system.indicators
        ]
        systems.append(
            system.model_copy(
                update={"recommendations": recs, "escalation": escalation, "indicators": indicators}
            )
        )
    return assessment.model_copy(update={"systems": systems})
