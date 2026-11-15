"""Notificaciones personalizadas a un member y evento `user.created` (Registro)."""

import uuid

from sqlmodel import Session, select

from app import models, seed
from app.db import engine
from app.services import events

API = "/api/v1"


def _body(text="Recuerda hidratarte", **extra):
    return {"id": str(uuid.uuid4()), "text": text, **extra}


def test_admin_sends_notification_and_it_is_idempotent(client):
    body = _body(title="Aviso de control", level="warning")
    r = client.post(f"{API}/members/{seed.VEGA}/notifications", json=body)
    assert r.status_code == 200, r.text
    event = r.json()
    assert event["type"] == "notification.sent"
    assert event["member_id"] == seed.VEGA
    assert event["payload"]["text"] == "Recuerda hidratarte"
    assert event["payload"]["level"] == "warning"
    # Mismo id y contenido → la misma; otro contenido → 409.
    again = client.post(f"{API}/members/{seed.VEGA}/notifications", json=body)
    assert again.status_code == 200 and again.json()["id"] == event["id"]
    other = client.post(
        f"{API}/members/{seed.VEGA}/notifications", json={**body, "text": "Otra cosa"}
    )
    assert other.status_code == 409


def test_notification_reaches_only_that_member(client):
    r = client.post(f"{API}/members/{seed.VEGA}/notifications", json=_body())
    assert r.status_code == 200, r.text
    with Session(engine) as session:
        row = session.get(models.EventLog, r.json()["id"])
        vega = session.exec(
            select(models.UserAccount).where(models.UserAccount.member_id == seed.VEGA)
        ).first()
        other = session.exec(
            select(models.UserAccount).where(
                models.UserAccount.role == "member", models.UserAccount.member_id != seed.VEGA
            )
        ).first()
        assert events.visible_to(row, events.Viewer.of(vega))
        assert not events.visible_to(row, events.Viewer.of(other))


def test_notification_permissions(client, medic_auth, vega_auth):
    # Un member no envía notificaciones.
    r = client.post(f"{API}/members/{seed.VEGA}/notifications", json=_body(), headers=vega_auth)
    assert r.status_code == 403
    # El medic de Marte, a los suyos sí; a otro entorno no.
    r = client.post(f"{API}/members/{seed.VEGA}/notifications", json=_body(), headers=medic_auth)
    assert r.status_code == 200, r.text
    with Session(engine) as session:
        outsider = session.exec(
            select(models.Member).where(models.Member.env_id == "hospital")
        ).first()
    r = client.post(
        f"{API}/members/{outsider.id}/notifications", json=_body(), headers=medic_auth
    )
    assert r.status_code == 403
    assert client.post(f"{API}/members/9999/notifications", json=_body()).status_code == 404


def test_creating_a_user_logs_user_created(client):
    r = client.post(
        f"{API}/users",
        json={
            "username": f"test-{uuid.uuid4().hex[:6]}",
            "display_name": "Dra. Prueba",
            "role": "medic",
            "env_id": "hospital",
            "password": "una-clave-larga",
        },
    )
    assert r.status_code == 201, r.text
    with Session(engine) as session:
        row = session.exec(
            select(models.EventLog)
            .where(models.EventLog.type == "user.created")
            .order_by(models.EventLog.id.desc())
        ).first()
        assert row is not None and row.env_id == "hospital"
        assert row.payload["display_name"] == "Dra. Prueba"


def test_events_newest_first_and_several_types(client):
    for text in ("primera", "segunda"):
        r = client.post(f"{API}/members/{seed.VEGA}/notifications", json=_body(text))
        assert r.status_code == 200, r.text
    r = client.get(
        f"{API}/events",
        params=[("type", "notification.sent"), ("type", "user.created"), ("order", "desc")],
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    assert rows and {e["type"] for e in rows} <= {"notification.sent", "user.created"}
    assert [e["id"] for e in rows] == sorted((e["id"] for e in rows), reverse=True)
    assert rows[0]["payload"]["text"] == "segunda"
