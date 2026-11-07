"""Authentication endpoints: email/password, Google sign-in, refresh rotation, logout."""
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from google.auth import exceptions as google_auth_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user
from models import AuthIdentity, RefreshToken, User, utcnow
from rate_limit import enforce
from security import (
    create_access_token, hash_password, hash_refresh_token, new_family_id,
    new_refresh_token, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
CSRF_HEADER = "X-Requested-With"
CSRF_VALUE = "eureka"


class RegisterRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=10, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_RE.match(value):
            raise ValueError("Enter a valid email address.")
        return value


class LoginRequest(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class GoogleRequest(BaseModel):
    credential: str = Field(min_length=10, max_length=4096)


def user_public(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "email_verified": user.email_verified,
        "has_password": user.password_hash is not None,
        "providers": sorted({identity.provider for identity in user.identities}),
    }


def _issue_session(db: Session, user: User, response: Response) -> dict:
    refresh = new_refresh_token()
    expires_at = utcnow() + timedelta(days=settings.refresh_token_days)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh),
        family_id=new_family_id(),
        expires_at=expires_at,
    ))
    db.commit()
    _set_refresh_cookie(response, refresh)
    return _token_payload(user)


def _token_payload(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "expires_in": settings.access_token_minutes * 60,
        "user": user_public(user),
    }


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name, path="/auth", httponly=True,
        secure=settings.cookie_secure, samesite="lax",
    )


def _require_csrf_header(value: str | None) -> None:
    if value != CSRF_VALUE:
        raise HTTPException(status_code=403, detail="Missing required request header.")


@router.post("/register", status_code=201)
def register(body: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce(request, "auth", settings.rate_limit_auth_per_minute)
    existing = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Try signing in.")
    display_name = (body.display_name or body.email.split("@", 1)[0]).strip() or "Student"
    user = User(
        email=body.email,
        email_verified=False,
        display_name=display_name,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()
    return _issue_session(db, user, response)


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce(request, "auth", settings.rate_limit_auth_per_minute)
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if user is None or not verify_password(user.password_hash, body.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return _issue_session(db, user, response)


@router.post("/google")
def google_sign_in(body: GoogleRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce(request, "auth", settings.rate_limit_auth_per_minute)
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on this server.")
    # A Google ID token is a three-part JWT. Reject anything else before doing any network work.
    if body.credential.count(".") != 2:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.")
    try:
        # Verifies signature, issuer, audience, and expiry against Google's published keys.
        claims = google_id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.")
    except google_auth_exceptions.TransportError:
        raise HTTPException(status_code=503, detail="Could not reach Google to verify sign-in. Please try again shortly.")

    subject = claims.get("sub")
    email = (claims.get("email") or "").strip().lower()
    if not subject or not email or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google did not return a verified email address.")

    identity = db.execute(select(AuthIdentity).where(
        AuthIdentity.provider == "google", AuthIdentity.subject == subject,
    )).scalar_one_or_none()
    if identity is not None:
        return _issue_session(db, identity.user, response)

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is not None:
        # Only link when the local account's email is already verified. An unverified local account
        # could have been created by someone else with this address, so linking would hand them access.
        if not user.email_verified:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Sign in with your password to connect Google.",
            )
        db.add(AuthIdentity(user_id=user.id, provider="google", subject=subject, email=email))
    else:
        user = User(
            email=email,
            email_verified=True,
            display_name=(claims.get("name") or email.split("@", 1)[0]).strip()[:80] or "Student",
            password_hash=None,
        )
        db.add(user)
        db.flush()
        db.add(AuthIdentity(user_id=user.id, provider="google", subject=subject, email=email))
    db.flush()
    return _issue_session(db, user, response)


@router.post("/refresh")
def refresh(
    request: Request,
    response: Response,
    csrf: str | None = Header(default=None, alias=CSRF_HEADER),
    db: Session = Depends(get_db),
):
    _require_csrf_header(csrf)
    enforce(request, "refresh", settings.rate_limit_refresh_per_minute)
    presented = request.cookies.get(settings.refresh_cookie_name)
    if not presented:
        raise HTTPException(status_code=401, detail="Your session has ended. Please sign in again.")

    row = db.execute(select(RefreshToken).where(
        RefreshToken.token_hash == hash_refresh_token(presented),
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=401, detail="Your session has ended. Please sign in again.")

    now = utcnow()
    if row.revoked_at is not None:
        # A revoked token was presented again: assume theft and end every session in this family.
        for sibling in db.execute(select(RefreshToken).where(
            RefreshToken.family_id == row.family_id, RefreshToken.revoked_at.is_(None),
        )).scalars():
            sibling.revoked_at = now
        db.commit()
        raise HTTPException(status_code=401, detail="Your session has ended. Please sign in again.")

    if row.expires_at <= now:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")

    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Your session has ended. Please sign in again.")

    replacement = new_refresh_token()
    replacement_hash = hash_refresh_token(replacement)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=replacement_hash,
        family_id=row.family_id,
        expires_at=row.expires_at,
    ))
    row.revoked_at = now
    row.replaced_by_hash = replacement_hash
    db.commit()
    _set_refresh_cookie(response, replacement)
    return _token_payload(user)


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    csrf: str | None = Header(default=None, alias=CSRF_HEADER),
    db: Session = Depends(get_db),
):
    _require_csrf_header(csrf)
    presented = request.cookies.get(settings.refresh_cookie_name)
    if presented:
        row = db.execute(select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(presented),
        )).scalar_one_or_none()
        if row is not None:
            now = utcnow()
            for sibling in db.execute(select(RefreshToken).where(
                RefreshToken.family_id == row.family_id, RefreshToken.revoked_at.is_(None),
            )).scalars():
                sibling.revoked_at = now
            db.commit()
    out = Response(status_code=204)
    _clear_refresh_cookie(out)
    return out


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"user": user_public(user)}
