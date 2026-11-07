"""Shared helpers for API tests."""
PASSWORD = "correct-horse-battery"
CSRF = {"X-Requested-With": "eureka"}


def register(client, email="ada@example.com", password=PASSWORD, name="Ada"):
    resp = client.post("/auth/register", json={"email": email, "password": password, "display_name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


def auth_header(payload):
    return {"Authorization": f"Bearer {payload['access_token']}"}
