from tests.helpers import auth_header, register


def _user(client, email):
    return auth_header(register(client, email=email, name=email.split("@")[0]))


def test_workspace_routes_require_sign_in(client):
    assert client.get("/notes").status_code == 401
    assert client.post("/checklists", json={"title": "x"}).status_code == 401


def test_note_crud_round_trip(client):
    h = _user(client, "notes1@example.com")
    created = client.post("/notes", headers=h, json={"title": "  Cell biology  ", "body": "Mitochondria", "color": "sage"})
    assert created.status_code == 201
    note = created.json()
    assert note["title"] == "Cell biology" and note["color"] == "sage" and note["archived"] is False

    listed = client.get("/notes", headers=h).json()["notes"]
    assert [n["id"] for n in listed] == [note["id"]]

    updated = client.patch(f"/notes/{note['id']}", headers=h, json={"body": "Mitochondria and ribosomes"}).json()
    assert updated["body"] == "Mitochondria and ribosomes"

    archived = client.patch(f"/notes/{note['id']}", headers=h, json={"archived": True}).json()
    assert archived["archived"] is True
    assert client.get("/notes", headers=h).json()["notes"] == []
    assert len(client.get("/notes?archived=true", headers=h).json()["notes"]) == 1

    assert client.delete(f"/notes/{note['id']}", headers=h).status_code == 204
    assert client.get(f"/notes/{note['id']}", headers=h).status_code == 404


def test_note_validation(client):
    h = _user(client, "notes2@example.com")
    assert client.post("/notes", headers=h, json={"title": "   "}).status_code == 422
    assert client.post("/notes", headers=h, json={"title": "x" * 121}).status_code == 422
    assert client.post("/notes", headers=h, json={"title": "ok", "color": "neon"}).status_code == 422


def test_checklist_items_and_progress(client):
    h = _user(client, "lists1@example.com")
    cl = client.post("/checklists", headers=h, json={"title": "Exam week"}).json()
    cid = cl["id"]
    client.post(f"/checklists/{cid}/items", headers=h, json={"text": "Revise chapter 3"})
    after = client.post(f"/checklists/{cid}/items", headers=h, json={"text": "Practice test"}).json()
    assert after["progress"] == {"done": 0, "total": 2, "percent": 0}

    first = after["items"][0]
    toggled = client.patch(f"/checklists/{cid}/items/{first['id']}", headers=h, json={"done": True}).json()
    assert toggled["progress"] == {"done": 1, "total": 2, "percent": 50}

    renamed = client.patch(f"/checklists/{cid}/items/{first['id']}", headers=h, json={"text": "Revise chapters 3 and 4"}).json()
    assert renamed["items"][0]["text"] == "Revise chapters 3 and 4"

    removed = client.delete(f"/checklists/{cid}/items/{first['id']}", headers=h).json()
    assert removed["progress"]["total"] == 1

    assert client.patch(f"/checklists/{cid}", headers=h, json={"title": "Final week"}).json()["title"] == "Final week"
    assert client.delete(f"/checklists/{cid}", headers=h).status_code == 204
    assert client.get("/checklists", headers=h).json()["checklists"] == []


def test_users_cannot_read_or_change_each_others_workspace(client):
    alice = _user(client, "alice-ws@example.com")
    bob = _user(client, "bob-ws@example.com")
    note = client.post("/notes", headers=alice, json={"title": "Private"}).json()
    cl = client.post("/checklists", headers=alice, json={"title": "Private list"}).json()
    item = client.post(f"/checklists/{cl['id']}/items", headers=alice, json={"text": "Secret"}).json()["items"][0]

    assert client.get("/notes", headers=bob).json()["notes"] == []
    assert client.get(f"/notes/{note['id']}", headers=bob).status_code == 404
    assert client.patch(f"/notes/{note['id']}", headers=bob, json={"title": "Hijacked"}).status_code == 404
    assert client.delete(f"/notes/{note['id']}", headers=bob).status_code == 404
    assert client.get("/checklists", headers=bob).json()["checklists"] == []
    assert client.post(f"/checklists/{cl['id']}/items", headers=bob, json={"text": "x"}).status_code == 404
    assert client.patch(f"/checklists/{cl['id']}/items/{item['id']}", headers=bob, json={"done": True}).status_code == 404
    assert client.delete(f"/checklists/{cl['id']}", headers=bob).status_code == 404

    # The owner's data is untouched by the attempts above.
    assert client.get(f"/notes/{note['id']}", headers=alice).json()["title"] == "Private"
    assert client.get("/checklists", headers=alice).json()["checklists"][0]["items"][0]["done"] is False


def test_user_id_in_body_cannot_redirect_ownership(client):
    alice = _user(client, "alice-own@example.com")
    bob_payload = register(client, email="bob-own@example.com")
    client.post("/notes", headers=alice, json={"title": "Mine", "user_id": bob_payload["user"]["id"]})
    assert client.get("/notes", headers=auth_header(bob_payload)).json()["notes"] == []


# Regression: the browser's preflight for DELETE was refused because DELETE was missing from the CORS allow-list.
def test_cors_preflight_allows_checklist_delete_from_the_frontend_origin(client):
    resp = client.options("/checklists/1", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "DELETE",
        "Access-Control-Request-Headers": "authorization,x-local-date,x-requested-with,content-type",
    })
    assert resp.status_code == 200
    assert "DELETE" in resp.headers["access-control-allow-methods"]
    assert resp.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert resp.headers["access-control-allow-credentials"] == "true"


def test_cors_still_refuses_an_unlisted_origin(client):
    resp = client.options("/checklists/1", headers={
        "Origin": "http://evil.example",
        "Access-Control-Request-Method": "DELETE",
    })
    assert resp.status_code == 400
    assert "access-control-allow-origin" not in resp.headers
