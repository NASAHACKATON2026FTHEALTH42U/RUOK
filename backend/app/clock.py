"""Reloj inyectable de la app.

Usa SIEMPRE `clock.now()` y nunca `datetime.now()` directamente: la demo
puede acelerar el tiempo (`/demo/fast-forward`) y todo el backend tiene que
ver la misma hora. Este es el único sitio donde se lee el reloj del sistema.

El offset vive en memoria. Su persistencia en `app_state` (`clock_offset_s`)
llega con BE-02.
"""

from datetime import UTC, datetime, timedelta

_offset = timedelta(0)


def now() -> datetime:
    """Hora actual de la demo, en UTC y con zona horaria."""
    return datetime.now(UTC) + _offset


def advance(seconds: float) -> None:
    """Avanza el reloj de la demo (fast-forward)."""
    global _offset
    _offset += timedelta(seconds=seconds)


def set_offset(seconds: float) -> None:
    """Fija el desfase respecto al reloj real, en segundos."""
    global _offset
    _offset = timedelta(seconds=seconds)


def get_offset() -> float:
    """Desfase actual respecto al reloj real, en segundos."""
    return _offset.total_seconds()


def reset() -> None:
    """Vuelve al reloj real."""
    set_offset(0)
