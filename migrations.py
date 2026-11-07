"""Alembic helpers used at API startup and by the health check.

Migrations are the only way the schema changes. Running them at startup means a fresh or
out-of-date database is brought up to date automatically. If a migration fails, startup fails
rather than the API serving requests against the wrong schema.
"""
import logging
import os

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from database import engine

logger = logging.getLogger("eureka.migrations")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _config() -> Config:
    cfg = Config(os.path.join(BASE_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BASE_DIR, "alembic"))
    return cfg


def head_revision() -> str | None:
    return ScriptDirectory.from_config(_config()).get_current_head()


def current_revision() -> str | None:
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def upgrade_to_head() -> None:
    before = current_revision()
    command.upgrade(_config(), "head")
    after = current_revision()
    if before != after:
        logger.warning("Database schema upgraded from %s to %s.", before, after)