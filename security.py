"""Password hashing (Argon2), access-token signing (JWT), and refresh-token helpers."""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from config import settings

_hasher = PasswordHasher()


class TokenError(Exception):
    """Raised when an access token is missing, malformed, expired, or otherwise invalid."""


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if not password_hash:
        # Burn comparable time so unknown accounts are not distinguishable by timing.
        _hasher.hash(password)
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _require_secret() -> str:
    if len(settings.jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET must be set to at least 32 characters. See .env.example.")
    return settings.jwt_secret


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iss": settings.jwt_issuer,
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, _require_secret(), algorithm="HS256")


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(
            token,
            _require_secret(),
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "exp", "iat", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("expired") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("invalid") from exc
    if payload.get("typ") != "access":
        raise TokenError("invalid")
    try:
        return int(payload["sub"])
    except (TypeError, ValueError) as exc:
        raise TokenError("invalid") from exc


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_family_id() -> str:
    return str(uuid.uuid4())
