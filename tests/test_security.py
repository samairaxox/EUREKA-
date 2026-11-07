from datetime import datetime, timedelta, timezone

import jwt
import pytest

from config import settings
from security import (
    TokenError, create_access_token, decode_access_token, hash_password,
    hash_refresh_token, new_refresh_token, verify_password,
)


def test_password_hash_is_not_plaintext_and_verifies():
    stored = hash_password("a-very-good-passphrase")
    assert "a-very-good-passphrase" not in stored
    assert stored.startswith("$argon2")
    assert verify_password(stored, "a-very-good-passphrase")
    assert not verify_password(stored, "wrong-passphrase-entirely")


def test_missing_hash_never_verifies():
    assert verify_password(None, "anything") is False


def test_access_token_round_trip():
    token = create_access_token(42)
    assert decode_access_token(token) == 42


def test_expired_access_token_is_rejected():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": "1", "iss": settings.jwt_issuer, "typ": "access",
         "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
        settings.jwt_secret, algorithm="HS256",
    )
    with pytest.raises(TokenError) as exc:
        decode_access_token(token)
    assert str(exc.value) == "expired"


def test_token_signed_with_wrong_secret_is_rejected():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": "1", "iss": settings.jwt_issuer, "typ": "access",
         "iat": now, "exp": now + timedelta(minutes=5)},
        "a_completely_different_secret_value_0000000000", algorithm="HS256",
    )
    with pytest.raises(TokenError):
        decode_access_token(token)


def test_token_with_wrong_type_is_rejected():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": "1", "iss": settings.jwt_issuer, "typ": "refresh",
         "iat": now, "exp": now + timedelta(minutes=5)},
        settings.jwt_secret, algorithm="HS256",
    )
    with pytest.raises(TokenError):
        decode_access_token(token)


def test_refresh_tokens_are_random_and_stored_hashed():
    a, b = new_refresh_token(), new_refresh_token()
    assert a != b and len(a) >= 60
    assert hash_refresh_token(a) != a
    assert len(hash_refresh_token(a)) == 64
