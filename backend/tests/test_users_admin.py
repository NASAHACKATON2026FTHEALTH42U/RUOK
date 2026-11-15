"""FS-07: gestión de usuarios desde el centro de control (solo admin)."""

import itertools

from tests.conftest import API, login_headers

NEW = {
    "username": "nuevo",
    "display_name": "Nuevo Medic",
    "role": "medic",
    "env_id": "mars",
    "password": "contraseña-segura",
}


_counter = itertools.count()


def _create(client, **over):
    """La BD de los tests persiste entre tests: cada alta usa un username nuevo."""
    body = {**NEW, "username": f"nuevo{next(_counter)}", **over}
    return client.post(f"{API}/users", json=body)


def test_list_users_all_and_by_env(client):
    everyone = client.get(f"{API}/users").json()
    assert any(u["username"] == "admin" and u["active"] for u in everyone)
    mars = client.get(f"{API}/users", params={"env_id": "mars"}).json()
    assert mars and all(u["env_id"] == "mars" for u in mars)


def test_created_user_can_log_in_with_password(client):
    r = _create(client)
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "medic" and r.json()["active"] is True
    name = r.json()["username"]
    assert login_headers(client, name, "contraseña-segura")


def test_member_account_needs_member_of_same_env(client):
    assert _create(client, role="member").status_code == 422
    assert _create(client, role="member", member_id=9999).status_code == 422
    # vega (member 1) ya tiene cuenta
    r = _create(client, role="member", member_id=1)
    assert r.status_code == 409


def test_validation_errors(client):
    assert _create(client, env_id=None).status_code == 422
    assert _create(client, env_id="nowhere").status_code == 422
    assert _create(client, role="admin").status_code == 422  # el admin es global: sin entorno
    assert _create(client, password="corta").status_code == 422
    assert _create(client, username="Con Espacios").status_code == 422


def test_family_and_admin_roles(client):
    assert _create(client, role="family", env_id="mars").status_code == 201
    r = _create(client, role="admin", env_id=None)
    assert r.status_code == 201 and r.json()["env_id"] is None


def test_duplicate_username_is_409(client):
    name = _create(client).json()["username"]
    assert _create(client, username=name).status_code == 409


def test_deactivate_blocks_login_and_reactivate_restores(client):
    created = _create(client).json()
    uid, name = created["id"], created["username"]
    r = client.patch(f"{API}/users/{uid}", json={"active": False})
    assert r.status_code == 200 and r.json()["active"] is False
    bad = client.post(f"{API}/auth/login", json={"username": name, "password": "contraseña-segura"})
    assert bad.status_code == 401
    client.patch(f"{API}/users/{uid}", json={"active": True})
    assert login_headers(client, name, "contraseña-segura")


def test_cannot_deactivate_self_or_last_admin(client):
    me = client.get(f"{API}/auth/me").json()
    assert client.patch(f"{API}/users/{me['id']}", json={"active": False}).status_code == 409
    other = _create(client, role="admin", env_id=None).json()
    assert client.patch(f"{API}/users/{other['id']}", json={"active": False}).status_code == 200
    # el segundo admin ya está inactivo: el admin de la sesión es el último activo
    assert client.patch(f"{API}/users/{me['id']}", json={"active": False}).status_code == 409


def test_unknown_user_is_404_and_pin_reset_is_gone(client):
    assert client.patch(f"{API}/users/99999", json={"active": False}).status_code == 404
    # El PIN se retiró: ya no hay endpoint para restablecerlo.
    assert client.put(f"{API}/users/1/pin", json={"pin": "1234"}).status_code in (404, 405)


def test_only_admin_can_manage_users(client, medic_auth, vega_auth):
    for headers in (medic_auth, vega_auth):
        assert client.get(f"{API}/users", headers=headers).status_code == 403
        assert client.post(f"{API}/users", json=NEW, headers=headers).status_code == 403
        assert (
            client.patch(f"{API}/users/1", json={"active": False}, headers=headers).status_code
            == 403
        )
