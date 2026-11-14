"""BE-32: el reloj de la demo sobrevive a un reinicio del servidor."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session

from app import clock
from app.db import engine
from app.services import app_state

API = "/api/v1"


@pytest.fixture
def api(client):
    client.post(f"{API}/demo/reset")
    yield client
    client.post(f"{API}/demo/reset")


def restart() -> None:
    """Simula un reinicio: el proceso nuevo empieza con el reloj real y lo restaura de la BD."""
    clock.reset()
    with Session(engine) as session:
        app_state.restore_clock(session)


def test_fast_forward_survives_restart(api):
    assert api.post(f"{API}/demo/fast-forward", json={"seconds": 840}).status_code == 200
    api.post(f"{API}/demo/fast-forward", json={"seconds": 60})
    restart()
    assert clock.get_offset() == 900


def test_reset_also_persists_real_clock(api):
    api.post(f"{API}/demo/fast-forward", json={"seconds": 3600})
    assert api.post(f"{API}/demo/reset").status_code == 200
    assert clock.get_offset() == 0
    restart()
    assert clock.get_offset() == 0


def test_server_time_header_uses_restored_clock(api):
    api.post(f"{API}/demo/fast-forward", json={"seconds": 7200})
    restart()
    r = api.get(f"{API}/health")
    server = datetime.fromisoformat(r.headers["x-server-time"])
    assert server - datetime.now(UTC) > timedelta(minutes=119)
