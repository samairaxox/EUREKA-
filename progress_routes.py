"""Protected per-user profile, goals, streak, focus sessions, and quiz results.

Every query is scoped to the authenticated user from the access token. No user ID from the
request body or URL is ever trusted to select whose data is read or written.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from models import FocusSession, QuizResult, StudyActivity, User, UserGoal, utcnow
from streak_logic import compute_streaks

router = APIRouter(prefix="/me", tags=["progress"])

ALLOWED_FOCUS_MINUTES = (25, 45, 60)
PROGRESS_WINDOW_DAYS = 365


def _parse_local_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    # The client's local date may differ from the server's UTC date by up to a day.
    today_utc = utcnow().date()
    if abs((parsed - today_utc).days) > 1:
        return None
    return parsed


def local_today(header_value: str | None) -> date:
    """Study days follow the user's local date when the client supplies it, else the server's UTC date."""
    return _parse_local_date(header_value) or utcnow().date()


def record_activity(db: Session, user: User, kind: str, activity_date: date, detail: str | None = None) -> None:
    db.add(StudyActivity(user_id=user.id, activity_date=activity_date, kind=kind, detail=detail))


def ensure_goal(db: Session, user: User) -> UserGoal:
    goal = db.execute(select(UserGoal).where(UserGoal.user_id == user.id)).scalar_one_or_none()
    if goal is None:
        goal = UserGoal(user_id=user.id, default_focus_minutes=25, daily_session_target=1)
        db.add(goal)
        db.flush()
    return goal


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)

    @field_validator("display_name")
    @classmethod
    def strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Display name cannot be empty.")
        return value


class GoalsUpdate(BaseModel):
    default_focus_minutes: Literal[25, 45, 60]
    daily_session_target: int = Field(ge=1, le=10)


class FocusSessionCreate(BaseModel):
    client_session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    duration_minutes: Literal[25, 45, 60]
    started_at: datetime
    completed_at: datetime
    local_date: str = Field(max_length=10)


class QuizResultCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    score: int = Field(ge=0, le=50)
    total: int = Field(ge=1, le=50)

    @field_validator("topic")
    @classmethod
    def strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Topic cannot be empty.")
        return value


def _as_utc_naive(moment: datetime) -> datetime:
    if moment.tzinfo is not None:
        moment = moment.astimezone(timezone.utc).replace(tzinfo=None)
    return moment


def _focus_summary(db: Session, user: User, day: date) -> tuple[int, int]:
    row = db.execute(select(
        func.count(FocusSession.id), func.coalesce(func.sum(FocusSession.duration_minutes), 0),
    ).where(FocusSession.user_id == user.id, FocusSession.activity_date == day)).one()
    return int(row[0]), int(row[1])


@router.get("/profile")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = ensure_goal(db, user)
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "email_verified": user.email_verified,
            "has_password": user.password_hash is not None,
            "providers": sorted({identity.provider for identity in user.identities}),
            "created_at": user.created_at.isoformat(),
        },
        "goals": {
            "default_focus_minutes": goal.default_focus_minutes,
            "daily_session_target": goal.daily_session_target,
        },
    }


@router.patch("/profile")
def update_profile(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.display_name = body.display_name
    db.commit()
    return {"display_name": user.display_name}


@router.put("/goals")
def update_goals(body: GoalsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = ensure_goal(db, user)
    goal.default_focus_minutes = body.default_focus_minutes
    goal.daily_session_target = body.daily_session_target
    db.commit()
    return {
        "default_focus_minutes": goal.default_focus_minutes,
        "daily_session_target": goal.daily_session_target,
    }


@router.get("/progress")
def get_progress(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_local_date: str | None = Header(default=None, alias="X-Local-Date"),
):
    today = local_today(x_local_date)
    goal = ensure_goal(db, user)
    window_start = today - timedelta(days=PROGRESS_WINDOW_DAYS - 1)

    all_dates = {row[0] for row in db.execute(
        select(StudyActivity.activity_date).where(StudyActivity.user_id == user.id).distinct()
    ).all()}
    current, longest = compute_streaks(all_dates, today)
    study_dates = sorted(d.isoformat() for d in all_dates if window_start <= d <= today)

    today_sessions, today_minutes = _focus_summary(db, user, today)
    target = goal.daily_session_target
    today_percent = min(100, round(today_sessions / target * 100)) if target > 0 else 0

    focus_total = db.execute(select(
        func.count(FocusSession.id), func.coalesce(func.sum(FocusSession.duration_minutes), 0),
    ).where(FocusSession.user_id == user.id)).one()

    quiz_row = db.execute(select(
        func.count(QuizResult.id), func.coalesce(func.sum(QuizResult.score), 0),
        func.coalesce(func.sum(QuizResult.total), 0),
    ).where(QuizResult.user_id == user.id)).one()
    quiz_count, quiz_score, quiz_possible = int(quiz_row[0]), int(quiz_row[1]), int(quiz_row[2])

    recent_rows = db.execute(
        select(StudyActivity).where(StudyActivity.user_id == user.id)
        .order_by(StudyActivity.created_at.desc(), StudyActivity.id.desc()).limit(20)
    ).scalars().all()

    recent_quizzes = db.execute(
        select(QuizResult).where(QuizResult.user_id == user.id)
        .order_by(QuizResult.created_at.desc(), QuizResult.id.desc()).limit(5)
    ).scalars().all()

    return {
        "today": date_payload(today),
        "streak": {"current": current, "longest": longest},
        "study_dates": study_dates,
        "goal": {
            "default_focus_minutes": goal.default_focus_minutes,
            "daily_session_target": target,
            "today_sessions": today_sessions,
            "today_focus_minutes": today_minutes,
            # Meaningful denominator: completed focus sessions today against the user's daily target.
            "today_percent": today_percent,
        },
        "totals": {
            "focus_sessions": int(focus_total[0]),
            "focus_minutes": int(focus_total[1]),
            "quizzes": quiz_count,
            "quiz_average_percent": round(quiz_score / quiz_possible * 100) if quiz_possible else None,
        },
        "recent_activity": [
            {"kind": row.kind, "detail": row.detail, "activity_date": row.activity_date.isoformat()}
            for row in recent_rows
        ],
        "recent_quizzes": [
            {"topic": row.topic, "score": row.score, "total": row.total,
             "activity_date": row.activity_date.isoformat()}
            for row in recent_quizzes
        ],
    }


def date_payload(day: date) -> dict:
    return {"date": day.isoformat()}


@router.post("/focus-sessions")
def create_focus_session(
    body: FocusSessionCreate,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    completed = _as_utc_naive(body.completed_at)
    started = _as_utc_naive(body.started_at)
    now = utcnow()
    if completed > now + timedelta(minutes=2):
        raise HTTPException(status_code=422, detail="A session cannot complete in the future.")
    if started > completed:
        raise HTTPException(status_code=422, detail="A session cannot start after it completes.")
    if completed - started < timedelta(minutes=body.duration_minutes - 1):
        raise HTTPException(status_code=422, detail="The recorded session is shorter than the chosen duration.")
    if (now - completed) > timedelta(days=2):
        raise HTTPException(status_code=422, detail="This session is too old to record.")

    existing = db.execute(select(FocusSession).where(
        FocusSession.user_id == user.id, FocusSession.client_session_id == body.client_session_id,
    )).scalar_one_or_none()
    if existing is not None:
        # Idempotent: a repeated completion (refresh, retry, double event) returns the stored record.
        response.status_code = 200
        return {"created": False, "client_session_id": existing.client_session_id,
                "duration_minutes": existing.duration_minutes, "activity_date": existing.activity_date.isoformat()}

    day = _parse_local_date(body.local_date) or completed.date()
    session = FocusSession(
        user_id=user.id,
        client_session_id=body.client_session_id,
        duration_minutes=body.duration_minutes,
        activity_date=day,
        completed_at=completed,
    )
    db.add(session)
    record_activity(db, user, "focus", day, f"{body.duration_minutes}-minute focus session")
    db.commit()
    response.status_code = 201
    return {"created": True, "client_session_id": session.client_session_id,
            "duration_minutes": session.duration_minutes, "activity_date": day.isoformat()}


@router.post("/quiz-results", status_code=201)
def create_quiz_result(
    body: QuizResultCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_local_date: str | None = Header(default=None, alias="X-Local-Date"),
):
    if body.score > body.total:
        raise HTTPException(status_code=422, detail="Score cannot exceed the total number of questions.")
    day = local_today(x_local_date)
    db.add(QuizResult(user_id=user.id, topic=body.topic, score=body.score, total=body.total, activity_date=day))
    record_activity(db, user, "quiz", day, body.topic[:200])
    db.commit()
    return {"topic": body.topic, "score": body.score, "total": body.total, "activity_date": day.isoformat()}
