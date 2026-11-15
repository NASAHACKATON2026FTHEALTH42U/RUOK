"""Idioma de las respuestas (FE-38): español por defecto, inglés con `Accept-Language: en`.

La fuente de verdad sigue siendo el español de `app/data/*.json`. El inglés son **capas** en
`app/data/i18n/en/`:

- `<catálogo>.json` (p. ej. `systems.json`): `{"<id>": {campo: valor en inglés}}`. `localized()`
  devuelve una copia del objeto con esos campos sustituidos (los dict se mezclan campo a campo y
  los objetos anidados, recursivamente). Lo que falte se queda en español: nunca un hueco vacío.
- `messages.json`: `{"<texto en español>": "<texto en inglés>"}` para los textos que genera el
  servidor (`tr()`), con huecos `{nombre}`.

El idioma de cada petición lo fija el middleware de `app/main.py` (`set_lang`); fuera de una
petición (hilos de vigilancia, seed, tests) es español.
"""

from __future__ import annotations

import json
from contextvars import ContextVar
from functools import lru_cache
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel

LANGS = ("es", "en")
I18N_DIR = Path(__file__).resolve().parent / "data" / "i18n"

_lang: ContextVar[str] = ContextVar("ruok_lang", default="es")

T = TypeVar("T")


def lang() -> str:
    """Idioma de la petición en curso ('es' o 'en')."""
    return _lang.get()


def set_lang(value: str) -> None:
    _lang.set(value if value in LANGS else "es")


def parse_accept_language(header: str | None) -> str:
    """`en`, `en-GB`, `en-US,en;q=0.9`… → 'en'; cualquier otra cosa → 'es'."""
    if not header:
        return "es"
    first = header.split(",")[0].strip().lower()
    return "en" if first.startswith("en") else "es"


@lru_cache(maxsize=64)
def _layer(name: str, language: str = "en") -> dict[str, Any]:
    path = I18N_DIR / language / f"{name}.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _merge(current: Any, override: Any) -> Any:
    if isinstance(current, BaseModel) and isinstance(override, dict):
        update = {
            k: _merge(getattr(current, k, None), v)
            for k, v in override.items()
            if k in type(current).model_fields
        }
        return current.model_copy(update=update)
    if isinstance(current, dict) and isinstance(override, dict):
        return {**current, **{k: _merge(current.get(k), v) for k, v in override.items()}}
    if isinstance(current, list) and isinstance(override, list) and len(current) == len(override):
        # Listas de objetos (p. ej. pasos con campos): elemento a elemento.
        if any(isinstance(c, (BaseModel, dict)) for c in current):
            return [_merge(c, o) for c, o in zip(current, override, strict=True)]
    return override


def localized(catalog: str, item_id: str, obj: T) -> T:
    """Copia de `obj` con los textos de la capa `catalog` para `item_id` en el idioma activo."""
    if lang() == "es":
        return obj
    override = _layer(catalog, lang()).get(item_id)
    if not override:
        return obj
    return _merge(obj, override)


def tr(es: str, **values: Any) -> str:
    """Texto generado por el servidor, en el idioma activo; `{nombre}` se rellena con `values`."""
    text = es if lang() == "es" else _layer("messages", lang()).get(es, es)
    if values:
        for key, value in values.items():
            text = text.replace("{" + key + "}", str(value))
    return text
