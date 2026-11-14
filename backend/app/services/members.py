"""Members en la base de datos.

STUB → BE-07 (seed): mientras no exista el seed, la app inserta al arrancar los
members de ejemplo de `app/stubs.py` para que las mediciones (FK a `member`) se
puedan guardar. Los endpoints de members siguen siendo stubs hasta BE-05.
"""

from sqlmodel import Session, select

from app import models, stubs


def ensure_demo_members(session: Session) -> int:
    """Si la tabla `member` está vacía, inserta los members de los stubs.

    Devuelve cuántos ha insertado (0 si ya había members).
    """
    if session.exec(select(models.Member).limit(1)).first() is not None:
        return 0
    for m in stubs.MEMBERS:
        session.add(
            models.Member(
                id=m.id,
                env_id=m.env_id,
                name=m.name,
                position=m.position,
                share_behavioral_details=m.share_behavioral_details,
                last_seen_at=m.last_seen_at,
            )
        )
    session.commit()
    return len(stubs.MEMBERS)
