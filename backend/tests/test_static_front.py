"""BE-24: FastAPI sirve el build del front con fallback SPA."""

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.static_front import mount_frontend


@pytest.fixture
def dist(tmp_path):
    d = tmp_path / "dist"
    (d / "assets").mkdir(parents=True)
    (d / "index.html").write_text("<html>RUOK</html>")
    (d / "assets" / "app.js").write_text("console.log('ruok')")
    (tmp_path / "secret.txt").write_text("fuera del build")
    return d


@pytest.fixture
def client(dist):
    app = FastAPI()
    api = APIRouter(prefix="/api/v1")

    @api.get("/health")
    def health():
        return {"status": "ok"}

    app.include_router(api)
    assert mount_frontend(app, dist) is True
    return TestClient(app)


def test_root_serves_index_without_cache(client):
    r = client.get("/")
    assert r.status_code == 200 and "RUOK" in r.text
    assert r.headers["cache-control"] == "no-cache"


def test_assets_are_served(client):
    r = client.get("/assets/app.js")
    assert r.status_code == 200 and "ruok" in r.text


@pytest.mark.parametrize("path", ["/dashboard", "/control", "/ground/mars", "/assets/nope.js"])
def test_spa_fallback(client, path):
    r = client.get(path)
    assert r.status_code == 200 and "RUOK" in r.text


def test_api_keeps_priority_and_json_404(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")
    assert client.get("/api").status_code == 404


def test_cannot_escape_the_build(client):
    r = client.get("/..%2Fsecret.txt")
    assert "fuera del build" not in r.text


def test_no_build_mounts_nothing(tmp_path):
    app = FastAPI()
    assert mount_frontend(app, tmp_path / "missing") is False
    assert TestClient(app).get("/").status_code == 404


def test_spa_route_is_not_in_openapi(client):
    assert all(not p.startswith("/{") for p in client.app.openapi()["paths"])
