from sqlalchemy import text

from app.db import engine, get_session


def test_sqlite_wal_and_foreign_keys():
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA journal_mode")).scalar() == "wal"
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_get_session_yields_working_session():
    session = next(get_session())
    assert session.exec(text("SELECT 1")).scalar() == 1
    session.close()
