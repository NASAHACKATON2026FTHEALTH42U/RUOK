"""BE-06: POST de mediciones por lotes (idempotente por UUID) y GET con filtros."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, delete, select

from app import clock, models
from app.db import engine
from app.services.members import ensure_demo_members

URL = "/api/v1/members/{}/measurements"
T0 = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)


def iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def m(indicator_id="heart_rate", value=72, taken_at=T0, **kw) -> dict:
    return {"id": str(uuid.uuid4()), "indicator_id": indicator_id, "value": value,
            "taken_at": iso(taken_at), **kw}


def rows() -> list[models.Measurement]:
    with Session(engine) as s:
        return list(s.exec(select(models.Measurement)).all())


@pytest.fixture(autouse=True)
def clean(client):
    """Cada test empieza sin mediciones (la BD de los tests es compartida)."""
    with Session(engine) as s:
        s.exec(delete(models.Measurement))
        s.commit()
    yield


def post(client, items, member_id=1):
    return client.post(URL.format(member_id), json={"measurements": items})


# ── POST ─────────────────────────────────────────────────────────────


def test_demo_members_exist_in_db():
    with Session(engine) as s:
        assert {mb.id for mb in s.exec(select(models.Member)).all()} >= {1, 2, 3}
        assert ensure_demo_members(s) == 0  # ya había members: no inserta nada


def test_post_batch_saves_with_catalog_unit_and_server_time(client):
    clock.advance(3600)
    batch = [m("heart_rate", 72), m("bp_systolic", 125), m("spo2", 97)]
    r = post(client, batch)
    assert r.status_code == 200
    body = r.json()
    assert (body["accepted"], body["duplicates"]) == (3, 0)
    assert body["assessment"]["member_id"] == 1

    saved = {row.indicator_id: row for row in rows()}
    assert {k: v.unit for k, v in saved.items()} == {
        "heart_rate": "lpm", "bp_systolic": "mmHg", "spo2": "%",
    }
    for row in saved.values():
        assert row.member_id == 1 and row.source == "manual"
        assert row.received_at - datetime.now(UTC) > timedelta(minutes=59)  # reloj de demo


def test_same_batch_twice_is_not_duplicated(client):
    """Criterio de aceptación 1."""
    batch = [m("heart_rate", 70), m("mood", 4, source="checkin")]
    assert post(client, batch).json()["accepted"] == 2
    r = post(client, batch)
    assert r.status_code == 200
    assert (r.json()["accepted"], r.json()["duplicates"]) == (0, 2)
    assert len(rows()) == 2


def test_same_id_different_content_is_409(client):
    """Criterio de aceptación 2: y el lote entero no se guarda."""
    first = m("heart_rate", 70)
    post(client, [first])
    other = m("bp_systolic", 120)
    r = post(client, [other, {**first, "value": 99}])
    assert r.status_code == 409
    assert first["id"] in r.json()["detail"]
    assert [row.id for row in rows()] == [first["id"]]


def test_same_instant_in_other_timezone_is_a_duplicate(client):
    first = m("heart_rate", 70)
    post(client, [first])
    same = {**first, "taken_at": "2026-11-14T12:00:00+02:00"}
    assert post(client, [same]).json()["duplicates"] == 1


def test_repeated_id_inside_batch(client):
    one = m("heart_rate", 70)
    r = post(client, [one, one])
    assert (r.json()["accepted"], r.json()["duplicates"]) == (1, 1)
    r = post(client, [(two := m("heart_rate", 70)), {**two, "value": 80}])
    assert r.status_code == 409


@pytest.mark.parametrize(
    ("item", "fragment"),
    [
        (m("fall_risk", 1), "fall_risk"),
        (m("spo2", 120), "fuera del rango"),
        (m("heart_rate", 5), "fuera del rango"),
        ({**m(), "taken_at": "2026-11-14T10:00:00"}, "zona horaria"),
    ],
)
def test_invalid_measurement_is_422_and_nothing_saved(client, item, fragment):
    r = post(client, [m("heart_rate", 70), item])
    assert r.status_code == 422
    assert fragment in r.json()["detail"]
    assert rows() == []


def test_unknown_member_is_404(client):
    assert post(client, [m()], member_id=999).status_code == 404


def test_empty_batch_is_rejected(client):
    assert client.post(URL.format(1), json={"measurements": []}).status_code == 422


# ── GET ──────────────────────────────────────────────────────────────


def test_get_is_sorted_by_taken_at(client):
    times = [T0 + timedelta(hours=h) for h in (3, 1, 2)]
    post(client, [m("heart_rate", 60 + i, t) for i, t in enumerate(times)])
    r = client.get(URL.format(1))
    assert r.status_code == 200
    assert [x["taken_at"] for x in r.json()] == [iso(t) for t in sorted(times)]


def test_get_filters(client):
    post(client, [
        m("heart_rate", 70, T0),
        m("heart_rate", 71, T0 + timedelta(days=1)),
        m("heart_rate", 72, T0 + timedelta(days=2)),
        m("spo2", 97, T0 + timedelta(days=1)),
    ])
    post(client, [m("heart_rate", 80, T0)], member_id=2)

    def values(**params):
        r = client.get(URL.format(1), params=params)
        assert r.status_code == 200
        return [(x["indicator_id"], x["value"]) for x in r.json()]

    assert len(values()) == 4  # el member 2 no aparece
    assert values(indicator_id="spo2") == [("spo2", 97)]
    day1 = iso(T0 + timedelta(days=1))
    assert values(indicator_id="heart_rate", **{"from": day1}) == [
        ("heart_rate", 71), ("heart_rate", 72),
    ]
    assert values(indicator_id="heart_rate", to=day1) == [("heart_rate", 70), ("heart_rate", 71)]
    assert values(indicator_id="heart_rate", **{"from": day1, "to": day1}) == [("heart_rate", 71)]


def test_get_from_after_to_is_422(client):
    r = client.get(URL.format(1), params={"from": iso(T0), "to": iso(T0 - timedelta(days=1))})
    assert r.status_code == 422


def test_get_returns_contract_shape(client):
    item = m("mood", 4, source="checkin", note="bien")
    post(client, [item])
    (got,) = client.get(URL.format(1)).json()
    assert got["id"] == item["id"]
    assert got["unit"] == "1-5" and got["note"] == "bien" and got["source"] == "checkin"
    assert got["member_id"] == 1 and "received_at" in got


def test_concurrent_resend_counts_as_duplicate(client, monkeypatch):
    """Si otro envío guarda el mismo id entre la lectura y el commit, se reintenta."""
    from app.schemas import MeasurementIn
    from app.services import measurements

    item = m("heart_rate", 70)
    post(client, [item])

    real_get = Session.get
    calls = {"n": 0}

    def stale_get(self, model, key, *a, **kw):
        calls["n"] += 1
        if calls["n"] == 1:  # primera lectura: "todavía no existe"
            return None
        return real_get(self, model, key, *a, **kw)

    monkeypatch.setattr(Session, "get", stale_get)
    with Session(engine) as s:
        result = measurements.save_batch(s, 1, [MeasurementIn.model_validate(item)])
    assert result == (0, 1)
    assert len(rows()) == 1
