import pytest

from tests.helpers import CSRF, PASSWORD, auth_header, register

FAKE_ID_TOKEN = "aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccc"


def test_register_returns_token_and_sets_httponly_refresh_cookie(client):
    body = register(client)
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "ada@example.com"
    assert body["user"]["has_password"] is True
    assert "password" not in str(body).lower().replace("has_password", "")
    cookie_header = client.cookies.jar  # cookie stored by client
    assert any(c.name == "eureka_refresh" for c in cookie_header)


def test_register_normalizes_email_and_rejects_duplicates(client):
    register(client, email="  Ada@Example.COM ")
    resp = client.post("/auth/register", json={"email": "ada@example.com", "password": PASSWORD})
    assert resp.status_code == 409


def test_register_validates_input(client):
    assert client.post("/auth/register", json={"email": "not-an-email", "password": PASSWORD}).status_code == 422
    assert client.post("/auth/register", json={"email": "x@example.com", "password": "short"}).status_code == 422


def test_login_success_and_generic_failure(client):
    register(client)
    client.cookies.clear()
    ok = client.post("/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert ok.status_code == 200
    wrong_pw = client.post("/auth/login", json={"email": "ada@example.com", "password": "nope-nope-nope"})
    unknown = client.post("/auth/login", json={"email": "nobody@example.com", "password": "nope-nope-nope"})
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json()["detail"] == unknown.json()["detail"]


def test_me_requires_valid_access_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    payload = register(client)
    resp = client.get("/auth/me", headers=auth_header(payload))
    assert resp.status_code == 200 and resp.json()["user"]["email"] == "ada@example.com"


def test_refresh_rotates_token_and_old_cookie_is_rejected(client):
    register(client)
    old_cookie = client.cookies.get("eureka_refresh", path="/auth")
    rotated = client.post("/auth/refresh", headers=CSRF)
    assert rotated.status_code == 200
    new_cookie = client.cookies.get("eureka_refresh", path="/auth")
    assert new_cookie and new_cookie != old_cookie

    # Replay the old token: must fail, and must revoke the whole family (including the new token).
    client.cookies.set("eureka_refresh", old_cookie, path="/auth")
    replay = client.post("/auth/refresh", headers=CSRF)
    assert replay.status_code == 401
    client.cookies.set("eureka_refresh", new_cookie, path="/auth")
    assert client.post("/auth/refresh", headers=CSRF).status_code == 401


def test_refresh_requires_csrf_header(client):
    register(client)
    assert client.post("/auth/refresh").status_code == 403
    assert client.post("/auth/refresh", headers={"X-Requested-With": "other"}).status_code == 403


def test_logout_revokes_refresh_session(client):
    register(client)
    stolen = client.cookies.get("eureka_refresh", path="/auth")
    assert client.post("/auth/logout", headers=CSRF).status_code == 204
    client.cookies.set("eureka_refresh", stolen, path="/auth")
    assert client.post("/auth/refresh", headers=CSRF).status_code == 401


def test_refresh_without_cookie_is_unauthorized(client):
    assert client.post("/auth/refresh", headers=CSRF).status_code == 401


def test_google_is_unavailable_until_configured(client):
    resp = client.post("/auth/google", json={"credential": "x" * 40})
    assert resp.status_code == 503


def test_google_invalid_token_is_rejected(client, monkeypatch):
    import auth_routes
    from config import Settings
    monkeypatch.setattr(auth_routes, "settings", Settings(google_client_id="client-id.apps.googleusercontent.com"))
    resp = client.post("/auth/google", json={"credential": "x" * 40})
    assert resp.status_code == 401


def _fake_google(monkeypatch, claims):
    import auth_routes
    from config import Settings
    monkeypatch.setattr(auth_routes.google_id_token, "verify_oauth2_token", lambda *a, **k: claims)
    # Settings is frozen; swap the module-level reference used by the route.
    patched = Settings(google_client_id="client-id.apps.googleusercontent.com")
    monkeypatch.setattr(auth_routes, "settings", patched)


def test_google_creates_new_verified_account(client, monkeypatch):
    _fake_google(monkeypatch, {"sub": "g-123", "email": "new@example.com", "email_verified": True, "name": "New Person"})
    resp = client.post("/auth/google", json={"credential": FAKE_ID_TOKEN})
    assert resp.status_code == 200
    user = resp.json()["user"]
    assert user["email"] == "new@example.com" and user["has_password"] is False and "google" in user["providers"]


def test_google_reuses_identity_on_second_sign_in(client, monkeypatch):
    _fake_google(monkeypatch, {"sub": "g-777", "email": "same@example.com", "email_verified": True})
    first = client.post("/auth/google", json={"credential": FAKE_ID_TOKEN}).json()["user"]["id"]
    second = client.post("/auth/google", json={"credential": FAKE_ID_TOKEN}).json()["user"]["id"]
    assert first == second


def test_google_does_not_link_to_unverified_local_account(client, monkeypatch):
    register(client, email="victim@example.com")
    _fake_google(monkeypatch, {"sub": "g-attacker", "email": "victim@example.com", "email_verified": True})
    resp = client.post("/auth/google", json={"credential": FAKE_ID_TOKEN})
    assert resp.status_code == 409


def test_google_rejects_unverified_google_email(client, monkeypatch):
    _fake_google(monkeypatch, {"sub": "g-9", "email": "maybe@example.com", "email_verified": False})
    assert client.post("/auth/google", json={"credential": FAKE_ID_TOKEN}).status_code == 401


# Regression: every page load restores the session. The strict login limit (10/min) logged users out after a few reloads.
def test_session_restore_survives_normal_reloading(client, monkeypatch):
    import auth_routes
    from config import Settings
    # Use the production login limit (10/min) so the test would fail if restores shared it.
    monkeypatch.setattr(auth_routes, "settings", Settings(rate_limit_auth_per_minute=10))
    register(client)
    for _ in range(15):
        resp = client.post("/auth/refresh", headers=CSRF)
        assert resp.status_code == 200, resp.text
