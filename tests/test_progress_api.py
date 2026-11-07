from datetime import datetime, timedelta, timezone

from tests.helpers import CSRF, auth_header, register

LOCAL = {"X-Local-Date": datetime.now(timezone.utc).date().isoformat()}


def _session_payload(key, minutes=25, ago_minutes=0):
    end = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=ago_minutes)
    start = end - timedelta(minutes=minutes)
    return {
        "client_session_id": key,
        "duration_minutes": minutes,
        "started_at": start.isoformat(),
        "completed_at": end.isoformat(),
        "local_date": LOCAL["X-Local-Date"],
    }


def test_protected_routes_reject_anonymous_requests(client):
    for method, path in [("get", "/me/profile"), ("get", "/me/progress"), ("put", "/me/goals"),
                         ("post", "/me/focus-sessions"), ("post", "/me/quiz-results"),
                         ("post", "/summarize"), ("post", "/quiz"), ("post", "/plan"), ("post", "/flashcards"),
                         ("post", "/rag/quiz")]:
        resp = client.request(method.upper(), path, json={})
        assert resp.status_code == 401, f"{method} {path} returned {resp.status_code}"


def test_profile_and_goals_round_trip(client):
    payload = register(client, name="Ada")
    h = auth_header(payload)
    profile = client.get("/me/profile", headers=h).json()
    assert profile["user"]["display_name"] == "Ada"
    assert profile["goals"] == {"default_focus_minutes": 25, "daily_session_target": 1}

    assert client.patch("/me/profile", headers=h, json={"display_name": "Ada L."}).status_code == 200
    assert client.get("/me/profile", headers=h).json()["user"]["display_name"] == "Ada L."

    goals = client.put("/me/goals", headers=h, json={"default_focus_minutes": 45, "daily_session_target": 3})
    assert goals.status_code == 200
    assert client.get("/me/profile", headers=h).json()["goals"]["daily_session_target"] == 3


def test_goals_reject_unsupported_focus_durations(client):
    h = auth_header(register(client))
    assert client.put("/me/goals", headers=h, json={"default_focus_minutes": 30, "daily_session_target": 1}).status_code == 422


def test_focus_session_records_progress_and_streak(client):
    h = auth_header(register(client))
    created = client.post("/me/focus-sessions", headers=h, json=_session_payload("session-0001-abcd"))
    assert created.status_code == 201 and created.json()["created"] is True

    progress = client.get("/me/progress", headers={**h, **LOCAL}).json()
    assert progress["streak"] == {"current": 1, "longest": 1}
    assert progress["goal"]["today_sessions"] == 1
    assert progress["goal"]["today_percent"] == 100  # 1 session against a daily target of 1
    assert progress["totals"]["focus_sessions"] == 1 and progress["totals"]["focus_minutes"] == 25
    assert progress["recent_activity"][0]["kind"] == "focus"


def test_duplicate_focus_session_is_not_recorded_twice(client):
    h = auth_header(register(client))
    body = _session_payload("dup-session-0001")
    first = client.post("/me/focus-sessions", headers=h, json=body)
    second = client.post("/me/focus-sessions", headers=h, json=body)
    assert first.status_code == 201
    assert second.status_code == 200 and second.json()["created"] is False
    progress = client.get("/me/progress", headers={**h, **LOCAL}).json()
    assert progress["totals"]["focus_sessions"] == 1
    assert len([a for a in progress["recent_activity"] if a["kind"] == "focus"]) == 1


def test_focus_session_rejects_implausible_records(client):
    h = auth_header(register(client))
    future = _session_payload("future-session-01")
    future["completed_at"] = (datetime.now(timezone.utc) + timedelta(hours=3)).replace(tzinfo=None).isoformat()
    assert client.post("/me/focus-sessions", headers=h, json=future).status_code == 422

    short = _session_payload("short-session-01", minutes=25)
    short["started_at"] = (datetime.fromisoformat(short["completed_at"]) - timedelta(minutes=5)).isoformat()
    assert client.post("/me/focus-sessions", headers=h, json=short).status_code == 422

    assert client.post("/me/focus-sessions", headers=h, json=_session_payload("bad-duration-01", minutes=30)).status_code == 422


def test_quiz_results_are_recorded_and_averaged(client):
    h = auth_header(register(client))
    assert client.post("/me/quiz-results", headers={**h, **LOCAL}, json={"topic": "Cells", "score": 4, "total": 5}).status_code == 201
    assert client.post("/me/quiz-results", headers={**h, **LOCAL}, json={"topic": "Cells", "score": 2, "total": 5}).status_code == 201
    progress = client.get("/me/progress", headers={**h, **LOCAL}).json()
    assert progress["totals"]["quizzes"] == 2
    assert progress["totals"]["quiz_average_percent"] == 60
    assert progress["recent_quizzes"][0]["topic"] == "Cells"


def test_quiz_result_cannot_exceed_total(client):
    h = auth_header(register(client))
    assert client.post("/me/quiz-results", headers=h, json={"topic": "x", "score": 6, "total": 5}).status_code == 422


def test_ai_endpoint_records_activity_only_on_success(client):
    h = auth_header(register(client))
    resp = client.post("/summarize", headers={**h, **LOCAL}, json={"text": "Photosynthesis notes"})
    assert resp.status_code == 200 and "summary" in resp.json()
    progress = client.get("/me/progress", headers={**h, **LOCAL}).json()
    assert any(a["kind"] == "summary" for a in progress["recent_activity"])


def test_users_cannot_see_each_others_progress_or_profile(client):
    alice = auth_header(register(client, email="alice@example.com", name="Alice"))
    bob = auth_header(register(client, email="bob@example.com", name="Bob"))

    client.post("/me/focus-sessions", headers=alice, json=_session_payload("alice-session-01"))
    client.post("/me/quiz-results", headers={**alice, **LOCAL}, json={"topic": "Secret", "score": 5, "total": 5})

    bob_progress = client.get("/me/progress", headers={**bob, **LOCAL}).json()
    assert bob_progress["totals"]["focus_sessions"] == 0
    assert bob_progress["totals"]["quizzes"] == 0
    assert bob_progress["recent_quizzes"] == []
    assert client.get("/me/profile", headers=bob).json()["user"]["display_name"] == "Bob"

    # The same client session key from another user is an independent record, not a conflict.
    assert client.post("/me/focus-sessions", headers=bob, json=_session_payload("alice-session-01")).status_code == 201


def test_user_id_in_body_is_ignored_for_ownership(client):
    alice = auth_header(register(client, email="alice2@example.com"))
    bob_payload = register(client, email="bob2@example.com")
    body = {"topic": "Injected", "score": 1, "total": 1, "user_id": bob_payload["user"]["id"]}
    client.post("/me/quiz-results", headers={**alice, **LOCAL}, json=body)
    bob_progress = client.get("/me/progress", headers={**auth_header(bob_payload), **LOCAL}).json()
    assert bob_progress["totals"]["quizzes"] == 0


def test_rag_session_belongs_to_its_uploader(client, monkeypatch):
    import main
    owner = auth_header(register(client, email="owner@example.com"))
    other = auth_header(register(client, email="other@example.com"))
    main._rag_store["session-abc"] = {"owner_id": client.get("/auth/me", headers=owner).json()["user"]["id"],
                                      "vectorstore": object()}
    import types, sys
    stub = types.ModuleType("rag_engine")
    stub.rag_query = lambda vs, prompt: "stub answer"
    stub.summarize_document = lambda vs: "stub summary"
    monkeypatch.setitem(sys.modules, "rag_engine", stub)

    assert client.post("/rag/summarize", headers=owner, json={"session_id": "session-abc"}).status_code == 200
    answer = client.post("/rag/ask", headers=owner, json={"session_id": "session-abc", "question": "What does it explain?"})
    assert answer.status_code == 200 and answer.json()["answer"] == "stub answer"
    denied = client.post("/rag/summarize", headers=other, json={"session_id": "session-abc"})
    assert denied.status_code == 404
    denied_question = client.post("/rag/ask", headers=other, json={"session_id": "session-abc", "question": "What does it explain?"})
    assert denied_question.status_code == 404
    main._rag_store.pop("session-abc", None)


def test_rag_plan_returns_structured_schedule_and_legacy_text(client, monkeypatch):
    import main
    import rag_engine

    owner = auth_header(register(client, email="planner-owner@example.com"))
    user_id = client.get("/auth/me", headers=owner).json()["user"]["id"]
    session_id = "full-document-planner-session"
    main._rag_store[session_id] = {"owner_id": user_id, "vectorstore": object()}
    expected = [{
        "day": "Day 1", "date": "2026-11-19", "task": "Review cell structure",
        "duration": "1 hour", "topics": ["Cell membrane"], "pages": [3, 4],
    }]
    monkeypatch.setattr(rag_engine, "generate_document_plan", lambda store, start, exam, request_id: expected)

    response = client.post("/rag/plan", headers={**owner, **LOCAL}, json={
        "session_id": session_id, "start_date": "2026-11-19", "exam_date": "2026-11-19",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["schedule"] == expected
    assert "Review cell structure" in body["study_plan"]
    assert response.headers["x-request-id"]
    main._rag_store.pop(session_id, None)
