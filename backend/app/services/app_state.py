"""Estado técnico de la app en la tabla `app_state` (clave-valor JSON)."""

from typing import Any

from sqlmodel import Session

from app import clock
from app.models import AppState

CLOCK_OFFSET_KEY = "clock_offset_s"


def get_value(session: Session, key: str, default: Any = None) -> Any:
    row = session.get(AppState, key)
    return default if row is None else row.value


def set_value(session: Session, key: str, value: Any) -> None:
    row = session.get(AppState, key)
    if row is None:
        session.add(AppState(key=key, value=value))
    else:
        row.value = value
        session.add(row)
    session.commit()


def restore_clock(session: Session) -> None:
    """Restaura el offset del reloj de demo guardado (si lo hay)."""
    offset = get_value(session, CLOCK_OFFSET_KEY)
    if offset is not None:
        clock.set_offset(float(offset))


def save_clock(session: Session) -> None:
    """Guarda el offset actual del reloj de demo (lo usará /demo/fast-forward)."""
    set_value(session, CLOCK_OFFSET_KEY, clock.get_offset())
