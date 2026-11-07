"""Fail-closed database selection checks for EUREKA test execution."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy.engine import URL, make_url


TEST_DATABASE_NAME = "eureka_test"
TEST_DATABASE_HOSTS = {"localhost", "127.0.0.1", "::1"}
TEST_DATABASE_PORT = 5432
DEVELOPMENT_DATABASE_NAME = "eureka_dev"
DEVELOPMENT_DATABASE_HOSTS = TEST_DATABASE_HOSTS | {"db"}
DEVELOPMENT_DATABASE_PORT = 5432
RESERVED_LOCAL_DATABASE_NAMES = {"eureka", TEST_DATABASE_NAME}


def _safe_error(reason: str) -> RuntimeError:
    return RuntimeError(f"EUREKA test database safety check failed: {reason}")


def validate_test_database_url(value: str | URL | None) -> URL:
    """Require an explicit local PostgreSQL URL for exactly the isolated test database."""
    if value is None or not str(value).strip():
        raise _safe_error("EUREKA_TEST_DATABASE_URL is required and cannot be empty.")
    try:
        url = make_url(value)
        port = url.port
    except Exception as exc:
        raise _safe_error("EUREKA_TEST_DATABASE_URL is malformed.") from exc

    if url.drivername.lower() not in {"postgresql", "postgresql+psycopg"}:
        raise _safe_error("the test URL must use PostgreSQL with the synchronous psycopg driver.")
    if not url.host or url.host.casefold() not in TEST_DATABASE_HOSTS:
        raise _safe_error("the test database must use an explicit loopback host.")
    if port != TEST_DATABASE_PORT:
        raise _safe_error(f"the test database must use local PostgreSQL port {TEST_DATABASE_PORT}.")
    if not url.database:
        raise _safe_error("the test URL must name its database explicitly.")
    if url.database.casefold() != TEST_DATABASE_NAME:
        raise _safe_error(f"only the explicitly isolated {TEST_DATABASE_NAME} database is allowed.")
    if {key.casefold() for key in url.query} & {"service", "host", "hostaddr", "dbname"}:
        raise _safe_error("the test URL cannot override its explicit database or host through query options.")
    return url


def validate_development_database_url(value: str | URL | None) -> URL:
    """Allow local development to use only the dedicated eureka_dev database."""
    if value is None or not str(value).strip():
        raise _safe_error("DATABASE_URL is required for local development.")
    try:
        url = make_url(value)
        port = url.port
    except Exception as exc:
        raise _safe_error("the development DATABASE_URL is malformed.") from exc

    if url.drivername.lower() not in {"postgresql", "postgresql+psycopg"}:
        raise _safe_error("the development DATABASE_URL must use PostgreSQL with the synchronous psycopg driver.")
    if not url.host or url.host.casefold() not in DEVELOPMENT_DATABASE_HOSTS:
        raise _safe_error("the development database must use localhost or the local Compose service 'db'.")
    if port != DEVELOPMENT_DATABASE_PORT:
        raise _safe_error(f"the development database must use local PostgreSQL port {DEVELOPMENT_DATABASE_PORT}.")
    if not url.database:
        raise _safe_error("the development DATABASE_URL must name its database explicitly.")
    if url.database.casefold() != DEVELOPMENT_DATABASE_NAME:
        raise _safe_error(f"local development is restricted to {DEVELOPMENT_DATABASE_NAME}.")
    if {key.casefold() for key in url.query} & {"service", "host", "hostaddr", "dbname"}:
        raise _safe_error("the development URL cannot override its explicit database or host through query options.")
    return url


def configure_test_environment() -> URL:
    """Select and mark the test database before any application module is imported."""
    raw_url = os.environ.get("EUREKA_TEST_DATABASE_URL")
    url = validate_test_database_url(raw_url)
    # Do not load a test default or read .env here. The caller must supply the URL.
    os.environ["DATABASE_URL"] = raw_url
    os.environ["EUREKA_TESTING"] = "1"
    return url


def _direct_test_invocation() -> bool:
    candidates = [sys.argv[0], *sys.argv[1:]]
    for argument in candidates:
        if not argument or argument.startswith("-"):
            continue
        path = Path(argument)
        if path.suffix.lower() == ".py" and (
            path.name.lower().startswith("test_")
            or any(part.casefold() in {"test", "tests"} for part in path.parts)
        ):
            return True
        if path.suffix.lower() == ".py" and "unittest" in {part.casefold() for part in path.parts}:
            return True
        if argument.startswith(("tests.", "test_")):
            return True
    return False


def is_test_execution() -> bool:
    """Identify pytest, unittest, and direct test-file execution without relying on conftest."""
    return (
        os.environ.get("EUREKA_TESTING") == "1"
        or "PYTEST_CURRENT_TEST" in os.environ
        or "pytest" in sys.modules
        or "unittest" in sys.modules and _direct_test_invocation()
        or _direct_test_invocation()
        or any(
            getattr(module, "__file__", None)
            and Path(module.__file__).name.lower().startswith("test_")
            and any(part.casefold() in {"test", "tests"} for part in Path(module.__file__).parts)
            for module in tuple(sys.modules.values())
        )
    )


def assert_safe_database_selection(active_database_url: str | URL | None = None) -> URL | None:
    """Reject app imports or cleanup in a test process until the harness selects eureka_test."""
    if not is_test_execution():
        return None
    if os.environ.get("EUREKA_TESTING") != "1":
        raise _safe_error("the test harness did not initialize before application imports.")

    expected = validate_test_database_url(os.environ.get("EUREKA_TEST_DATABASE_URL"))
    selected = validate_test_database_url(os.environ.get("DATABASE_URL"))
    if _target(selected) != _target(expected):
        raise _safe_error("DATABASE_URL does not match EUREKA_TEST_DATABASE_URL.")
    if active_database_url is not None:
        engine_url = validate_test_database_url(active_database_url)
        if _target(engine_url) != _target(expected):
            raise _safe_error("the already-created database engine does not target eureka_test.")
    return expected


def assert_safe_application_database_selection(
    active_database_url: str | URL | None = None,
    *,
    environment: str | None = None,
) -> URL | None:
    """Apply the correct database allowlist before application engine creation."""
    if is_test_execution():
        return assert_safe_database_selection(active_database_url)

    mode = (environment or os.environ.get("EUREKA_ENV") or "development").strip().casefold()
    if mode in {"development", "dev", "local"}:
        return validate_development_database_url(active_database_url or os.environ.get("DATABASE_URL"))
    if mode in {"production", "prod"}:
        raw_url = active_database_url or os.environ.get("DATABASE_URL")
        if raw_url is None or not str(raw_url).strip():
            raise _safe_error("DATABASE_URL must be explicitly configured in production.")
        try:
            url = make_url(raw_url)
        except Exception as exc:
            raise _safe_error("the production DATABASE_URL is malformed.") from exc
        if (url.host or "localhost").casefold() in DEVELOPMENT_DATABASE_HOSTS and \
                (url.database or "").casefold() in RESERVED_LOCAL_DATABASE_NAMES:
            raise _safe_error("the damaged development database and test database are reserved and cannot be used by the app.")
        return url
    raise _safe_error("EUREKA_ENV must be development or production.")


def _target(url: URL) -> tuple[str, str, int, str]:
    return (
        url.drivername.lower(),
        (url.host or "").casefold(),
        url.port or TEST_DATABASE_PORT,
        (url.database or "").casefold(),
    )
