"""BE-22: mensaje a casa por el enlace, con respuestas simuladas desde la Tierra."""

import uuid

from tests.conftest import API

MARS_DELAY = 840
RESPONSE_S = 20  # home_message_replies.json (tiempo de «escribir» la respuesta)


def _send(client, member=1, text="Hola, os echo de menos", mid=None, headers=None):
    body = {"id": str(mid or uuid.uuid4()), "text": text}
    return client.post(f"{API}/members/{member}/home-messages", json=body, headers=headers)


def _thread(client, member=1, headers=None):
    r = client.get(f"{API}/members/{member}/home-messages", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _ff(client, seconds):
    assert client.post(f"{API}/demo/fast-forward", json={"seconds": seconds}).status_code == 200


def _mine(client, mid, headers):
    """El mensaje `mid` y su respuesta (la BD de los tests persiste entre tests)."""
    thread = _thread(client, headers=headers)
    up = next(m for m in thread if m["id"] == str(mid))
    down = [m for m in thread if m["in_reply_to"] == str(mid)]
    return up, down


def test_mars_message_is_delivered_after_eta(client, vega_auth):
    client.post(f"{API}/demo/link", json={"env": "mars", "state": "delayed"})
    mid = uuid.uuid4()
    sent = _send(client, mid=mid, headers=vega_auth)
    assert sent.status_code == 200, sent.text
    assert sent.json()["state"] == "in_transit" and sent.json()["direction"] == "up"
    _ff(client, MARS_DELAY - 60)
    assert _mine(client, mid, vega_auth)[0]["state"] == "in_transit"
    _ff(client, 60)
    assert _mine(client, mid, vega_auth)[0]["state"] == "delivered"


def test_reply_arrives_after_round_trip_and_response_time(client, vega_auth):
    client.post(f"{API}/demo/link", json={"env": "mars", "state": "delayed"})
    mid = uuid.uuid4()
    _send(client, mid=mid, headers=vega_auth)
    _ff(client, MARS_DELAY + RESPONSE_S + MARS_DELAY - 5)
    up, down = _mine(client, mid, vega_auth)
    assert up["state"] == "delivered" and down == []  # la respuesta aún va por el enlace
    _ff(client, 5)
    _, down = _mine(client, mid, vega_auth)
    assert len(down) == 1
    assert down[0]["state"] == "delivered" and down[0]["sender"] == "Casa" and down[0]["text"]
    assert down[0]["direction"] == "down"


def test_is_idempotent_and_detects_id_conflict(client, vega_auth):
    mid = uuid.uuid4()
    first = _send(client, mid=mid, text="uno", headers=vega_auth)
    again = _send(client, mid=mid, text="uno", headers=vega_auth)
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
    assert sum(1 for m in _thread(client, headers=vega_auth) if m["id"] == str(mid)) == 1
    assert _send(client, mid=mid, text="otro", headers=vega_auth).status_code == 409


def test_los_queues_message_until_link_returns(client, vega_auth):
    client.post(f"{API}/demo/link", json={"env": "mars", "state": "los"})
    mid = uuid.uuid4()
    assert _send(client, mid=mid, headers=vega_auth).json()["state"] == "queued"
    _ff(client, 3600)
    assert _mine(client, mid, vega_auth)[0]["state"] == "queued"
    client.post(f"{API}/demo/link", json={"env": "mars", "state": "delayed"})
    _ff(client, MARS_DELAY)
    assert _mine(client, mid, vega_auth)[0]["state"] == "delivered"


def test_validation(client, vega_auth):
    base = f"{API}/members/1/home-messages"
    assert (
        client.post(base, json={"id": "no-uuid", "text": "x"}, headers=vega_auth).status_code == 422
    )
    assert (
        client.post(base, json={"id": str(uuid.uuid4()), "text": ""}, headers=vega_auth).status_code
        == 422
    )
    assert _send(client, member=99999).status_code == 404


def test_only_the_member_can_use_it(client, vega_auth, medic_auth):
    for h in (medic_auth,):
        assert _send(client, headers=h).status_code == 403
        assert client.get(f"{API}/members/1/home-messages", headers=h).status_code == 403
    other = client.get(f"{API}/environments/mars/members").json()
    other_id = next(m["id"] for m in other if m["id"] != 1)
    assert _send(client, member=other_id, headers=vega_auth).status_code == 403


def test_home_messages_are_hidden_from_link_messages_except_admin(client, vega_auth, medic_auth):
    _send(client, text="privado", headers=vega_auth)
    admin = client.get(f"{API}/link/messages", params={"env": "mars"}).json()
    assert any(m["kind"] == "home_message" for m in admin)
    staff = client.get(f"{API}/link/messages", params={"env": "mars"}, headers=medic_auth).json()
    assert all(m["kind"] != "home_message" for m in staff)


def test_anonymous_gets_401(anon_client):
    assert anon_client.get(f"{API}/members/1/home-messages").status_code == 401
