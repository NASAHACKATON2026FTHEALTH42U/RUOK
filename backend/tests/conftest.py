import os
import tempfile

# La BD de los tests va a un directorio temporal, nunca a ./ruok.db.
# Tiene que fijarse antes de importar app.db.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='ruok-test-')}/test.db"
# bcrypt con coste mínimo: los tests prueban la lógica, no la resistencia del hash.
os.environ.setdefault("RUOK_BCRYPT_ROUNDS", "4")
# Los tests adelantan el reloj días enteros: que el token del fixture `client` no caduque.
# Los tests de caducidad (test_auth_api.py) fijan su propio RUOK_JWT_TTL_HOURS.
os.environ.setdefault("RUOK_JWT_TTL_HOURS", str(24 * 365))
# El SSE cierra la conexión tras este tiempo (el navegador reconecta con Last-Event-ID):
# en los tests, enseguida, para que el TestClient pueda leer el stream entero.
os.environ.setdefault("RUOK_SSE_MAX_SECONDS", "0.3")
# Sin la tarea periódica de liveness (BE-16): los tests llaman a check_all() a mano.
os.environ["RUOK_LIVENESS_WATCH"] = "0"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import clock  # noqa: E402
from app.main import app  # noqa: E402


def _forget_saved_clock() -> None:
    """Borra el offset guardado en la BD de tests (BE-32 lo persiste en cada fast-forward):
    si no, el arranque de la app del test siguiente lo restauraría."""
    from sqlalchemy.exc import OperationalError
    from sqlmodel import Session

    from app.db import engine
    from app.models import AppState
    from app.services.app_state import CLOCK_OFFSET_KEY

    try:
        with Session(engine) as session:
            row = session.get(AppState, CLOCK_OFFSET_KEY)
            if row is not None:
                session.delete(row)
                session.commit()
    except OperationalError:  # la BD aún no tiene tablas (antes del primer arranque)
        pass


@pytest.fixture(autouse=True)
def _reset_clock():
    clock.reset()
    _forget_saved_clock()
    yield
    clock.reset()
    _forget_saved_clock()


API = "/api/v1"


def login_headers(c: TestClient, username: str, password: str) -> dict[str, str]:
    """Cabecera Authorization tras un login real (usuarios demo de BE-25)."""
    r = c.post(f"{API}/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def client():
    """Cliente con sesión de **admin** (BE-27): puede casi todo.

    Lo que es solo del propio member (privacidad, heartbeat) se llama con
    ``headers=vega_auth``. Para probar sin sesión, ``anon_client``.
    """
    with TestClient(app) as c:
        c.headers.update(login_headers(c, "admin", "ruok-admin"))
        yield c


@pytest.fixture
def anon_client():
    """Cliente sin sesión."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def vega_auth(client) -> dict[str, str]:
    """Cabecera de la sesión de vega (member 1, Marte)."""
    return login_headers(client, "vega", "ruok-mars")


@pytest.fixture
def medic_auth(client) -> dict[str, str]:
    """Cabecera de la sesión del medic de Marte (ve lo conductual solo si se comparte)."""
    return login_headers(client, "medic-mars", "ruok-mars")
