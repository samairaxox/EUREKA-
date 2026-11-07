"""Regression coverage for fail-closed EUREKA test database selection."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

from database_safety import validate_development_database_url, validate_test_database_url


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SAFE_TEST_URL = "postgresql+psycopg://test_user:test_password@localhost:5432/eureka_test"


def _subprocess_env(**updates):
    env = os.environ.copy()
    env.pop("EUREKA_TESTING", None)
    env.pop("EUREKA_TEST_DATABASE_URL", None)
    env.pop("PYTEST_CURRENT_TEST", None)
    env["PYTHONPATH"] = os.pathsep.join(
        filter(None, (str(PROJECT_ROOT), env.get("PYTHONPATH", "")))
    )
    env.update(updates)
    return env


def test_test_url_is_required_and_cannot_be_empty():
    for value in (None, "", "   "):
        with pytest.raises(RuntimeError, match="required and cannot be empty"):
            validate_test_database_url(value)


def test_test_url_must_be_well_formed_postgresql():
    for value in (
        "not-a-url",
        "sqlite:///eureka_test.db",
        "postgresql://localhost",
        "postgresql+psycopg://test_user@localhost:not-a-port/eureka_test",
    ):
        with pytest.raises(RuntimeError):
            validate_test_database_url(value)


def test_development_database_is_never_an_allowed_test_target():
    with pytest.raises(RuntimeError, match="only the explicitly isolated eureka_test"):
        validate_test_database_url("postgresql+psycopg://test_user:test_password@localhost:5432/eureka")


def test_unexpected_database_name_is_rejected():
    with pytest.raises(RuntimeError, match="only the explicitly isolated eureka_test"):
        validate_test_database_url("postgresql+psycopg://test_user:test_password@localhost:5432/other_test")


def test_development_url_allows_only_the_dedicated_local_database():
    accepted = validate_development_database_url(
        "postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka_dev"
    )
    assert accepted.database == "eureka_dev"
    compose_url = validate_development_database_url(
        "postgresql+psycopg://dev_user:dev_password@db:5432/eureka_dev"
    )
    assert compose_url.host == "db"
    for name in ("eureka", "eureka_test", "other_dev"):
        with pytest.raises(RuntimeError):
            validate_development_database_url(
                f"postgresql+psycopg://dev_user:dev_password@localhost:5432/{name}"
            )


def test_test_execution_allows_eureka_test_but_never_eureka():
    env = _subprocess_env(
        EUREKA_TESTING="1",
        EUREKA_TEST_DATABASE_URL=SAFE_TEST_URL,
        DATABASE_URL=SAFE_TEST_URL,
    )
    accepted = subprocess.run(
        [sys.executable, "-c", "from database_safety import assert_safe_application_database_selection; assert_safe_application_database_selection()"],
        cwd=PROJECT_ROOT, env=env, text=True, capture_output=True, check=False,
    )
    assert accepted.returncode == 0, accepted.stderr

    development_url = "postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka"
    env["EUREKA_TEST_DATABASE_URL"] = development_url
    env["DATABASE_URL"] = development_url
    rejected = subprocess.run(
        [sys.executable, "-c", "from database_safety import assert_safe_application_database_selection; assert_safe_application_database_selection()"],
        cwd=PROJECT_ROOT, env=env, text=True, capture_output=True, check=False,
    )
    assert rejected.returncode != 0
    assert "only the explicitly isolated eureka_test" in rejected.stderr


def test_config_import_enforces_development_and_test_allowlists_without_connecting():
    development_urls = {
        "postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka_dev": True,
        "postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka": False,
        "postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka_test": False,
    }
    for database_url, should_succeed in development_urls.items():
        env = _subprocess_env(DATABASE_URL=database_url, EUREKA_ENV="development")
        result = subprocess.run(
            [sys.executable, "-c", "import config"], cwd=PROJECT_ROOT, env=env,
            text=True, capture_output=True, check=False,
        )
        assert (result.returncode == 0) is should_succeed

    test_env = _subprocess_env(
        EUREKA_TESTING="1", EUREKA_ENV="test",
        EUREKA_TEST_DATABASE_URL=SAFE_TEST_URL, DATABASE_URL=SAFE_TEST_URL,
    )
    accepted = subprocess.run(
        [sys.executable, "-c", "import config"], cwd=PROJECT_ROOT, env=test_env,
        text=True, capture_output=True, check=False,
    )
    assert accepted.returncode == 0, accepted.stderr

    unsafe_url = "postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka"
    test_env["EUREKA_TEST_DATABASE_URL"] = unsafe_url
    test_env["DATABASE_URL"] = unsafe_url
    rejected = subprocess.run(
        [sys.executable, "-c", "import config"], cwd=PROJECT_ROOT, env=test_env,
        text=True, capture_output=True, check=False,
    )
    assert rejected.returncode != 0


def test_non_loopback_or_nonstandard_port_is_rejected():
    for value in (
        "postgresql+psycopg://test_user:test_password@db.example:5432/eureka_test",
        "postgresql+psycopg://test_user:test_password@localhost:5433/eureka_test",
    ):
        with pytest.raises(RuntimeError):
            validate_test_database_url(value)


def test_process_test_url_wins_over_dotenv_in_a_fresh_import(tmp_path):
    # Isolate config.py so its colocated .env definitely names the development DB.
    (tmp_path / "config.py").write_bytes((PROJECT_ROOT / "config.py").read_bytes())
    (tmp_path / ".env").write_text(
        "DATABASE_URL=postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka\n",
        encoding="utf-8",
    )
    code = (
        "import os; from config import settings; "
        "assert settings.database_url == os.environ['EUREKA_TEST_DATABASE_URL']; "
        "print('process test URL preserved')"
    )
    env = _subprocess_env(
        DATABASE_URL=SAFE_TEST_URL,
        EUREKA_TEST_DATABASE_URL=SAFE_TEST_URL,
        EUREKA_TESTING="1",
        PYTHONPATH=os.pathsep.join((str(tmp_path), str(PROJECT_ROOT))),
    )
    result = subprocess.run(
        [sys.executable, "-c", code], cwd=tmp_path, env=env,
        text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "process test URL preserved" in result.stdout


@pytest.mark.parametrize(
    ("database_url", "test_url"),
    [
        (None, SAFE_TEST_URL),
        (SAFE_TEST_URL, None),
        (SAFE_TEST_URL, ""),
        ("postgresql+psycopg://test_user:test_password@localhost:5432/eureka", SAFE_TEST_URL),
        ("postgresql+psycopg://test_user:test_password@localhost:5432/eureka_test", SAFE_TEST_URL),
    ],
)
def test_database_import_before_valid_fixture_setup_fails_closed(database_url, test_url):
    code = "import database"
    env = _subprocess_env(PYTEST_CURRENT_TEST="tests/test_db_isolation.py::pre_fixture_import")
    if database_url is not None:
        env["DATABASE_URL"] = database_url
    else:
        env.pop("DATABASE_URL", None)
    if test_url is not None:
        env["EUREKA_TEST_DATABASE_URL"] = test_url
    env.pop("EUREKA_TESTING", None)
    result = subprocess.run(
        [sys.executable, "-c", code], cwd=PROJECT_ROOT, env=env,
        text=True, capture_output=True, check=False,
    )
    assert result.returncode != 0
    assert "test harness did not initialize" in result.stderr or "required and cannot be empty" in result.stderr


def test_direct_test_file_execution_without_harness_is_blocked(tmp_path):
    script = tmp_path / "test_direct_execution.py"
    script.write_text(
        f"import sys; sys.path.insert(0, {str(PROJECT_ROOT)!r}); import database\n",
        encoding="utf-8",
    )
    env = _subprocess_env(DATABASE_URL=SAFE_TEST_URL)
    result = subprocess.run(
        [sys.executable, str(script)], cwd=tmp_path, env=env,
        text=True, capture_output=True, check=False,
    )
    assert result.returncode != 0
    assert "test harness did not initialize" in result.stderr


def test_harness_configuration_has_no_implicit_test_url_fallback():
    code = "from database_safety import configure_test_environment; configure_test_environment()"
    env = _subprocess_env(DATABASE_URL="postgresql+psycopg://dev_user:dev_password@localhost:5432/eureka")
    result = subprocess.run(
        [sys.executable, "-c", code], cwd=PROJECT_ROOT, env=env,
        text=True, capture_output=True, check=False,
    )
    assert result.returncode != 0
    assert "EUREKA_TEST_DATABASE_URL is required" in result.stderr
