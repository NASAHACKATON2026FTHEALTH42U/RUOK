from datetime import datetime


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert datetime.fromisoformat(body["server_time"]).tzinfo is not None


def test_server_time_header(client):
    r = client.get("/api/v1/health")
    assert "x-server-time" in r.headers
    datetime.fromisoformat(r.headers["x-server-time"])


def test_cors_preflight(client):
    r = client.options(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert r.status_code == 200
    assert "access-control-allow-origin" in r.headers


def test_openapi_docs(client):
    assert client.get("/docs").status_code == 200
    assert "/api/v1/health" in client.get("/openapi.json").json()["paths"]
