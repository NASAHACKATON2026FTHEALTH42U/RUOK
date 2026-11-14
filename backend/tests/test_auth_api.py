"""BE-26: endpoints /auth (login, PIN, me, demo-users) con JWT local."""

from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import clock, models
from app.auth import security
from app.db import engine
from app.routers.deps import require_roles
from app.services import accounts, app_state

API = "/api/v1"
VEGA = {"username": "vega", "password": "ruok-mars"}
OTHER_KEY = "otra-clave-de-32-bytes-para-firmar-x"
ENV_KEY = "clave-de-entorno-de-32-bytes-o-mas!"


def _login(client, username, password):
    return client.post(API + "/auth/login", json={"username": username, "password": password})


def _pin(client, username, pin):
    return client.post(API + "/auth/pin", json={"username": username, "pin": pin})


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ── Login con contraseña ────────────────────────────────────────────


def test_login_ok_returns_jwt_and_user(client, monkeypatch):
    monkeypatch.setenv("RUOK_JWT_TTL_HOURS", "12")  # el valor por defecto (conftest lo sube)
    resp = client.post(API + "/auth/login", json=VEGA)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    user = body["user"]
    assert user["username"] == "vega"
    assert user["role"] == "member"
    assert user["env_id"] == "mars"
    assert user["member_id"] == 1
    assert user["role_label"] == "astronauta"

    payload = jwt.decode(body["access_token"], options={"verify_signature": False})
    assert payload["sub"] == str(user["id"])
    assert payload["role"] == "member"
    assert payload["env_id"] == "mars"
    assert payload["member_id"] == 1
    assert payload["exp"] - payload["iat"] == 12 * 3600


def test_wrong_password_is_401(client):
    resp = _login(client, "medic-mars", "nope")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Usuario o contraseña incorrectos"
    assert _login(client, "medic-mars", "ruok-mars").status_code == 200  # resetea el contador


def test_unknown_user_is_401_with_same_message(client):
    resp = _login(client, "nadie", "ruok-mars")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Usuario o contraseña incorrectos"


def test_admin_is_global(client):
    user = _login(client, "admin", "ruok-admin").json()["user"]
    assert user["role"] == "admin"
    assert user["env_id"] is None
    assert user["role_label"] == "operador"


def test_role_label_uses_environment_vocabulary(client):
    user = _login(client, "responder-mars", "ruok-mars").json()["user"]
    assert user["role_label"] == "flight surgeon"
    user = _login(client, "medic-geriatric", "ruok-geriatric").json()["user"]
    assert user["role_label"] == "cuidador"


# ── /auth/me y validación del token ─────────────────────────────────


def test_me_returns_current_user(client):
    token = client.post(API + "/auth/login", json=VEGA).json()["access_token"]
    resp = client.get(API + "/auth/me", headers=_bearer(token))
    assert resp.status_code == 200
    assert resp.json()["username"] == "vega"


def test_me_without_token_is_401(anon_client):
    resp = anon_client.get(API + "/auth/me")
    assert resp.status_code == 401
    assert resp.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("token", ["basura", "a.b.c", "stub-token-7"])
def test_me_with_garbage_token_is_401(client, token):
    assert client.get(API + "/auth/me", headers=_bearer(token)).status_code == 401


def test_token_signed_with_other_key_is_401(client):
    forged = jwt.encode({"sub": "1", "role": "admin", "exp": 9999999999}, OTHER_KEY, "HS256")
    assert client.get(API + "/auth/me", headers=_bearer(forged)).status_code == 401


def test_expired_token_is_401_with_demo_clock(client, monkeypatch):
    monkeypatch.setenv("RUOK_JWT_TTL_HOURS", "12")
    token = client.post(API + "/auth/login", json=VEGA).json()["access_token"]
    clock.advance(12 * 3600 - 60)
    assert client.get(API + "/auth/me", headers=_bearer(token)).status_code == 200
    clock.advance(61)  # el fast-forward de la demo también caduca la sesión
    resp = client.get(API + "/auth/me", headers=_bearer(token))
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Token caducado"


def test_login_after_fast_forward_is_valid(client):
    """BE-36: un token emitido con el reloj de la demo adelantado (iat en el "futuro" para
    la hora del sistema) es válido: la validez se mide solo con clock.now()."""
    clock.advance(3 * 86400)
    token = client.post(API + "/auth/login", json=VEGA).json()["access_token"]
    resp = client.get(API + "/auth/me", headers=_bearer(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "vega"


def test_ttl_is_configurable(client, monkeypatch):
    monkeypatch.setenv("RUOK_JWT_TTL_HOURS", "1")
    token = client.post(API + "/auth/login", json=VEGA).json()["access_token"]
    clock.advance(3601)
    assert client.get(API + "/auth/me", headers=_bearer(token)).status_code == 401


def test_secret_is_persisted_in_app_state(client, monkeypatch):
    monkeypatch.delenv("RUOK_JWT_SECRET", raising=False)
    token = client.post(API + "/auth/login", json=VEGA).json()["access_token"]
    with Session(engine) as s:
        secret = app_state.get_value(s, security.SECRET_KEY)
    assert secret
    jwt.decode(token, secret, algorithms=["HS256"], options={"verify_exp": False})


def test_env_secret_overrides_app_state(client, monkeypatch):
    monkeypatch.setenv("RUOK_JWT_SECRET", ENV_KEY)
    token = client.post(API + "/auth/login", json=VEGA).json()["access_token"]
    jwt.decode(token, ENV_KEY, algorithms=["HS256"], options={"verify_exp": False})
    assert client.get(API + "/auth/me", headers=_bearer(token)).status_code == 200
    monkeypatch.delenv("RUOK_JWT_SECRET")
    # Con otra clave, los tokens firmados con la de entorno dejan de valer.
    assert client.get(API + "/auth/me", headers=_bearer(token)).status_code == 401


# ── PIN ─────────────────────────────────────────────────────────────


def test_pin_login_ok(client):
    resp = _pin(client, "vega", "1234")
    assert resp.status_code == 200
    assert resp.json()["user"]["username"] == "vega"


def test_pin_for_role_without_pin_is_401(client):
    assert _pin(client, "commander-mars", "1234").status_code == 401
    assert _login(client, "commander-mars", "ruok-mars").status_code == 200


def test_pin_is_locked_after_five_failures(client):
    for _ in range(accounts.MAX_FAILED_ATTEMPTS):
        assert _pin(client, "okafor", "0000").status_code == 401

    resp = _pin(client, "okafor", "1234")  # PIN correcto, pero bloqueada
    assert resp.status_code == 429  # el front lo muestra como "demasiados intentos"
    assert "bloqueada" in resp.json()["detail"]
    assert 0 < int(resp.headers["retry-after"]) <= accounts.LOCK_SECONDS
    assert _login(client, "okafor", "ruok-mars").status_code == 429  # también con contraseña

    clock.advance(accounts.LOCK_SECONDS + 1)
    assert _pin(client, "okafor", "1234").status_code == 200


def test_pin_format_is_validated(client):
    assert _pin(client, "vega", "12a4").status_code == 422


# ── Usuarios demo ───────────────────────────────────────────────────


def test_demo_users_lists_seeded_accounts(client):
    resp = client.get(API + "/auth/demo-users")
    assert resp.status_code == 200
    users = resp.json()
    names = {u["username"] for u in users}
    assert {"vega", "medic-mars", "responder-mars", "psych-mars", "admin"} <= names
    assert users[-1]["username"] == "admin"  # el admin global va al final
    assert set(users[0]) == {"username", "display_name", "role", "env_id", "role_label"}


def test_demo_users_is_404_without_demo_mode(client, monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "false")
    assert client.get(API + "/auth/demo-users").status_code == 404


# ── require_roles ───────────────────────────────────────────────────


def test_require_roles(client):
    mini = FastAPI()

    @mini.get("/solo-admin")
    def solo_admin(user: Annotated[models.UserAccount, Depends(require_roles("admin"))]):
        return {"username": user.username}

    admin = _login(client, "admin", "ruok-admin").json()["access_token"]
    member = client.post(API + "/auth/login", json=VEGA).json()["access_token"]
    with TestClient(mini) as c:
        assert c.get("/solo-admin").status_code == 401
        assert c.get("/solo-admin", headers=_bearer(member)).status_code == 403
        resp = c.get("/solo-admin", headers=_bearer(admin))
        assert resp.status_code == 200
        assert resp.json() == {"username": "admin"}
