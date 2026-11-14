import os
import tempfile

# La BD de los tests va a un directorio temporal, nunca a ./ruok.db.
# Tiene que fijarse antes de importar app.db.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='ruok-test-')}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import clock  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_clock():
    clock.reset()
    yield
    clock.reset()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
