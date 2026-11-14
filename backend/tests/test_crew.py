"""BE-23: kudos y misiones de tripulación suman a crew_points."""

import uuid

import pytest

from tests.conftest import API, login_headers


def _members(client, env="mars"):
    return [m["id"] for m in client.get(f"{API}/environments/{env}/members").json()]


def _crew_points(client, env="mars"):
    return client.get(f"{API}/environments/{env}/leaderboard").json()["crew_points"]


def _kudos(client, sender, to, text="¡Gracias!", kid=None):
    return client.post(
        f"{API}/members/{sender}/kudos",
        json={"id": str(kid or uuid.uuid4()), "to_member_id": to, "message": text},
    )


@pytest.fixture(autouse=True)
def _reset(client):
    client.post(f"{API}/demo/reset")


def test_kudos_increments_crew_points_and_is_listed(client):
    a, b = _members(client)[:2]
    before = _crew_points(client)
    r = _kudos(client, a, b)
    assert r.status_code == 200, r.text
    assert _crew_points(client) == before + 5
    # también en el GameState del member
    assert client.get(f"{API}/members/{a}/game").json()["crew_points"] == before + 5
    listed = client.get(f"{API}/environments/mars/kudos").json()
    assert listed[0]["id"] == r.json()["id"] and listed[0]["to_member_id"] == b


def test_kudos_is_idempotent_and_detects_conflict(client):
    a, b, c = _members(client)[:3]
    kid = uuid.uuid4()
    before = _crew_points(client)
    assert _kudos(client, a, b, kid=kid).status_code == 200
    assert _kudos(client, a, b, kid=kid).status_code == 200
    assert _crew_points(client) == before + 5  # no suma dos veces
    assert _kudos(client, a, c, kid=kid).status_code == 409


def test_kudos_validation_and_daily_limit(client):
    a, b = _members(client)[:2]
    assert _kudos(client, a, a).status_code == 422
    assert _kudos(client, a, 99999).status_code == 422
    other_env = _members(client, "iss")[0]
    assert _kudos(client, a, other_env).status_code == 422
    assert (
        client.post(
            f"{API}/members/{a}/kudos",
            json={"id": str(uuid.uuid4()), "to_member_id": b, "message": ""},
        ).status_code
        == 422
    )
    for _ in range(3):
        assert _kudos(client, a, b).status_code == 200
    assert _kudos(client, a, b).status_code == 409  # 4.º del día


def test_mission_completes_at_min_participants_and_adds_points(client):
    a, b, c = _members(client)[:3]
    mission = "eat_together"  # min_participants = 2, 30 puntos
    before = _crew_points(client)

    def join(member):
        return client.post(
            f"{API}/members/{member}/missions/{mission}/join", json={"id": str(uuid.uuid4())}
        )

    first = join(a)
    assert first.status_code == 200, first.text
    assert first.json()["completed"] is False and first.json()["participants"] == [a]
    assert _crew_points(client) == before
    second = join(b)
    assert second.json()["completed"] is True
    assert _crew_points(client) == before + 30
    join(c)  # un tercero no suma otra vez
    assert _crew_points(client) == before + 30


def test_join_is_idempotent(client):
    a = _members(client)[0]
    jid = str(uuid.uuid4())
    for _ in range(2):
        r = client.post(f"{API}/members/{a}/missions/tend_plants/join", json={"id": jid})
        assert r.status_code == 200
        assert r.json()["participants"] == [a]
    # otro UUID, mismo día y misión: tampoco duplica
    r = client.post(f"{API}/members/{a}/missions/tend_plants/join", json={"id": str(uuid.uuid4())})
    assert r.json()["participants"] == [a]


def test_missions_listing_and_unknown_mission(client):
    missions = client.get(f"{API}/environments/mars/missions").json()
    assert {m["id"] for m in missions} == {"eat_together", "group_game", "tend_plants"}
    assert all(m["completed"] is False for m in missions)
    a = _members(client)[0]
    r = client.post(f"{API}/members/{a}/missions/nope/join", json={"id": str(uuid.uuid4())})
    assert r.status_code == 404
    # hospital no tiene `eat_together`
    hosp = _members(client, "hospital")[0]
    r = client.post(
        f"{API}/members/{hosp}/missions/eat_together/join", json={"id": str(uuid.uuid4())}
    )
    assert r.status_code == 404
    assert client.get(f"{API}/environments/pluto/missions").status_code == 404
    assert client.get(f"{API}/environments/pluto/kudos").status_code == 404


def test_permissions(client, vega_auth, medic_auth):
    a, b = _members(client)[:2]
    assert (
        client.post(
            f"{API}/members/{a}/kudos",
            json={"id": str(uuid.uuid4()), "to_member_id": b, "message": "hola"},
            headers=medic_auth,
        ).status_code
        == 403
    )
    # un member no da kudos en nombre de otro
    assert _kudos(client, b, a).status_code == 200  # admin sí
    other = login_headers(client, "vega", "ruok-mars")
    r = client.post(
        f"{API}/members/{b}/kudos",
        json={"id": str(uuid.uuid4()), "to_member_id": a, "message": "hola"},
        headers=other,
    )
    assert r.status_code == 403
    assert client.get(f"{API}/environments/mars/missions", headers=vega_auth).status_code == 200
