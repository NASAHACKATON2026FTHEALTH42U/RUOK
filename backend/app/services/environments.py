"""Perfiles de entorno (BE-03): carga y valida app/data/environments.json.

El JSON se valida con el schema `Environment` del contrato (app/schemas/config.py),
que rechaza campos desconocidos. Se lee una sola vez y queda en memoria.
La app lo carga al arrancar: si el JSON es inválido, el servidor no arranca.
`localized()` da la copia en el idioma de la petición (FE-38) para la API; la lógica interna
usa siempre el perfil original.
Ver docs/environments.md.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import TypeAdapter

from app import i18n
from app.schemas import Environment

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "environments.json"

_ADAPTER = TypeAdapter(list[Environment])


def load_environments(path: Path = DATA_FILE) -> list[Environment]:
    """Lee y valida un fichero de perfiles. Sin caché (útil en tests)."""
    envs = _ADAPTER.validate_json(path.read_bytes())
    ids = [e.id for e in envs]
    duplicated = sorted({i for i in ids if ids.count(i) > 1})
    if duplicated:
        raise ValueError(f"Entornos duplicados en {path.name}: {', '.join(duplicated)}")
    return envs


@lru_cache(maxsize=1)
def _by_id() -> dict[str, Environment]:
    return {e.id: e for e in load_environments()}


def list_environments() -> list[Environment]:
    """Los perfiles, en el orden del JSON."""
    return list(_by_id().values())


def get_environment(env_id: str) -> Environment | None:
    """Un perfil por id, o None si no existe."""
    return _by_id().get(env_id)


def localized(env: Environment) -> Environment:
    """Copia del perfil con nombre y vocabulario en el idioma de la petición (FE-38).

    Solo para lo que sale por la API: el objeto en caché no se modifica.
    """
    return i18n.localized("environments", env.id, env)
