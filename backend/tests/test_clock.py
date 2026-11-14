from datetime import datetime, timedelta

from app import clock


def test_now_is_utc_aware():
    assert clock.now().utcoffset() == timedelta(0)


def test_advance_moves_clock():
    before = clock.now()
    clock.advance(3600)
    assert clock.get_offset() == 3600
    assert clock.now() - before >= timedelta(hours=1)


def test_reset():
    clock.set_offset(120)
    clock.reset()
    assert clock.get_offset() == 0


def test_header_reflects_offset(client):
    clock.advance(86400)
    r = client.get("/api/v1/health")
    header = datetime.fromisoformat(r.headers["x-server-time"])
    body = datetime.fromisoformat(r.json()["server_time"])
    assert header - body < timedelta(seconds=5)
    assert body - datetime.now(body.tzinfo) > timedelta(hours=23)
