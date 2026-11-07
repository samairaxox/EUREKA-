"""Test setup.

- Runs against a real PostgreSQL database (EUREKA_TEST_DATABASE_URL), not SQLite.
- Replaces the LLM-backed agent modules with deterministic stubs so no external API is called.
"""
import os
import sys
import types

from database_safety import assert_safe_database_selection, configure_test_environment

# Select the explicit, allow-listed test URL before importing pytest helpers,
# the application config, or database engine. There is deliberately no fallback.
configure_test_environment()

# Tests build the schema from the models. Startup migrations would try to create the same tables again.
os.environ["AUTO_MIGRATE"] = "false"
os.environ["JWT_SECRET"] = "test_secret_value_that_is_long_enough_for_hs256_0123456789"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["RATE_LIMIT_AUTH_PER_MINUTE"] = "10000"
os.environ["RATE_LIMIT_AI_PER_MINUTE"] = "10000"
os.environ["GOOGLE_CLIENT_ID"] = ""

# ── Stub the LLM-backed modules before main.py imports them ──
agents_stub = types.ModuleType("agents")
agents_stub.summarizer_agent = lambda text: {"summary": f"stub summary of {len(text)} chars", "key_points": ["a", "b", "c", "d", "e"]}
agents_stub.planner_agent = lambda topic, exam_date, start_date="", request_id=None: [{"day": "Day 1", "date": exam_date, "task": topic, "duration": "1 hour"}]
sys.modules["agents"] = agents_stub

graph_stub = types.ModuleType("eureka_graph")


class _StubGraph:
    def invoke(self, state):
        if state["user_input"] == "quiz":
            return {"result": [{"question": "Q1", "options": ["A", "B", "C", "D"], "answer": "A"}]}
        return {"result": [{"front": "Term", "back": "Definition"}]}


graph_stub.app_graph = _StubGraph()
sys.modules["eureka_graph"] = graph_stub

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from database import Base, engine  # noqa: E402
import models  # noqa: E402,F401
import rate_limit  # noqa: E402
from main import app  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def _schema():
    assert_safe_database_selection(engine.url)
    Base.metadata.create_all(bind=engine)
    try:
        yield
    finally:
        # A changed environment or engine must prevent destructive teardown.
        assert_safe_database_selection(engine.url)
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _clean_db():
    assert_safe_database_selection(engine.url)
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    rate_limit.reset()
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c
