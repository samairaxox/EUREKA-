import importlib.util
from pathlib import Path
import pytest
from types import SimpleNamespace

# tests/conftest.py replaces the application agent module to keep API tests offline.
# Load the planner implementation directly here so these unit tests exercise production code.
_agent_spec = importlib.util.spec_from_file_location("eureka_schedule_agent_under_test", Path(__file__).parents[1] / "agents.py")
agents = importlib.util.module_from_spec(_agent_spec)
_agent_spec.loader.exec_module(agents)
normalize_schedule = agents.normalize_schedule
safe_parse = agents.safe_parse


def test_schedule_rows_are_normalized_to_canonical_fields():
    rows = normalize_schedule([{
        "day_label": "Day 1",
        "study_date": "19-11-2026",
        "activity": "Review equations",
        "time": "45 minutes",
    }])
    assert rows == [{
        "day": "Day 1",
        "date": "2026-11-19",
        "task": "Review equations",
        "duration": "45 minutes",
    }]


def test_schedule_iso_fields_are_preserved():
    rows = normalize_schedule([{
        "day": "Day 1", "date": "2026-11-19",
        "task": "Review equations", "duration": "1 hour",
    }])
    assert rows[0]["date"] == "2026-11-19"
    assert rows[0]["task"] == "Review equations"
    assert rows[0]["duration"] == "1 hour"


@pytest.mark.parametrize("bad_response", [None, {}, [], "not json"])
def test_malformed_or_incomplete_schedule_is_rejected(bad_response):
    with pytest.raises(ValueError):
        normalize_schedule(bad_response)


@pytest.mark.parametrize("row", [
    {"day": "Day 1", "date": "2026-11-19", "duration": "1 hour"},
    {"day": "Day 1", "date": "2026-11-19", "task": "Review algebra"},
])
def test_missing_task_or_duration_is_rejected(row):
    with pytest.raises(ValueError, match="incomplete schedule item"):
        normalize_schedule([row], request_id="test-missing-field")


def test_invalid_schedule_date_is_rejected():
    with pytest.raises(ValueError, match="invalid schedule date"):
        normalize_schedule([{
            "day": "Day 1", "date": "19-99-2026",
            "task": "Review equations", "duration": "1 hour",
        }])


def test_safe_parse_accepts_markdown_json_fence():
    assert safe_parse('```json\n[{"task":"Review","duration":"1 hour"}]\n```',
                      agent_name="planner", request_id="test-1") == [{"task": "Review", "duration": "1 hour"}]


def test_safe_parse_rejects_empty_response_with_clear_error():
    with pytest.raises(ValueError, match="planner returned an empty response"):
        safe_parse(" \n ", agent_name="planner", request_id="test-empty", expected_root="schedule")


def test_safe_parse_rejects_unrepairable_json_with_clear_error():
    with pytest.raises(ValueError, match="planner returned malformed data"):
        safe_parse("This is not JSON", agent_name="planner", request_id="test-bad-json", expected_root="schedule")


def test_planner_agent_returns_validated_schedule(monkeypatch):
    monkeypatch.setattr(agents, "_invoke_summary", lambda chain, payload: SimpleNamespace(content=(
        '[{"day":"Day 1","date":"19-11-2026","task":"Review algebra","duration":"1 hour"}]'
    )))
    schedule = agents.planner_agent("Algebra", "2026-11-19", "2026-11-19", request_id="test-valid")
    assert schedule == [{
        "day": "Day 1", "date": "2026-11-19", "task": "Review algebra", "duration": "1 hour",
    }]


def test_planner_batches_and_covers_every_inclusive_date(monkeypatch):
    calls = []

    def generate(chain, payload):
        calls.append(payload["dates"])
        return SimpleNamespace(content=__import__("json").dumps([
            {"date": date_value, "task": "Study and practice", "duration": "1 hour"}
            for date_value in __import__("json").loads(payload["dates"])
        ]))

    monkeypatch.setattr(agents, "_invoke_summary", generate)
    schedule = agents.planner_agent("Algebra", "2026-11-10", "2026-11-01", request_id="test-range")
    assert len(calls) == 2  # seven date rows per bounded generation request
    assert [row["date"] for row in schedule] == [f"2026-11-{day:02d}" for day in range(1, 11)]
    assert schedule[0]["day"] == "Day 1" and schedule[-1]["day"] == "Day 10"


def test_planner_rejects_incomplete_date_coverage(monkeypatch):
    monkeypatch.setattr(agents, "_invoke_summary", lambda chain, payload: SimpleNamespace(content=(
        '[{"date":"2026-11-19","task":"Review","duration":"1 hour"}]'
    )))
    with pytest.raises(ValueError, match="every requested date"):
        agents.planner_agent("Algebra", "2026-11-20", "2026-11-19", request_id="test-missing-date")
