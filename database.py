from database_safety import assert_safe_application_database_selection, assert_safe_database_selection

# Run before config/settings are imported and before create_engine can bind to a URL.
assert_safe_database_selection()

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings


class Base(DeclarativeBase):
    pass


_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
assert_safe_database_selection(settings.database_url)
assert_safe_application_database_selection(settings.database_url, environment=settings.environment)
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
