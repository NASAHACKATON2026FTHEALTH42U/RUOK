"""Base de datos SQLite del servidor de a bordo.

- Modo WAL: lecturas concurrentes con una escritura y más robustez ante caídas.
- `foreign_keys=ON`: SQLite no comprueba las FK si no se activa en cada conexión.
- Una sesión por petición con `Depends(get_session)`.

Ver docs/data-model.md.
"""

import os
from collections.abc import Iterator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

DEFAULT_DATABASE_URL = "sqlite:///./ruok.db"


def make_engine(url: str) -> Engine:
    """Crea un engine de SQLite con los PRAGMA del proyecto en cada conexión."""
    new_engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(new_engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return new_engine


engine = make_engine(os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))


def init_db(target: Engine | None = None) -> None:
    """Crea las tablas e índices de app/models.py que todavía no existan."""
    import app.models  # noqa: F401  (registra los modelos en SQLModel.metadata)

    SQLModel.metadata.create_all(target or engine)


def get_session() -> Iterator[Session]:
    """Dependencia de FastAPI: una sesión por petición."""
    with Session(engine) as session:
        yield session
