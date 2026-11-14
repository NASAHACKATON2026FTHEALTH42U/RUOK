"""Catálogo de indicadores, sistemas del cuerpo (BE-04) e intervenciones (BE-21).

Carga y valida app/data/indicators.json y app/data/systems.json con los schemas
del contrato (app/schemas/config.py), que rechazan campos desconocidos. Además
comprueba que los dos ficheros y environments.json son coherentes entre sí.
Se lee una sola vez y queda en memoria; la app lo valida al arrancar.

Los rangos son provisionales hasta CNT-01: ver la tabla de docs/sources.md.
"""

import re
from collections.abc import Iterable
from functools import lru_cache
from pathlib import Path

from pydantic import TypeAdapter

from app.schemas import BodySystem, Environment, Indicator, Intervention
from app.services import environments

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
INDICATORS_FILE = DATA_DIR / "indicators.json"
SYSTEMS_FILE = DATA_DIR / "systems.json"
INTERVENTIONS_FILE = DATA_DIR / "interventions.json"
SOURCES_FILE = DATA_DIR.parents[2] / "docs" / "sources.md"

_INDICATORS = TypeAdapter(list[Indicator])
_SYSTEMS = TypeAdapter(list[BodySystem])
_INTERVENTIONS = TypeAdapter(list[Intervention])


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
