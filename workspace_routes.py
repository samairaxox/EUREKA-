"""Notes and checklists. Every read and write is scoped to the authenticated user.

A record owned by someone else returns 404, the same as a record that does not exist, so IDs cannot be probed.
"""
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from models import Checklist, ChecklistItem, Note, User, utcnow

router = APIRouter(tags=["workspace"])

NOTE_COLORS = ("lavender", "butter", "blush", "powder", "sage")
CHECKLIST_COLORS = ("butter", "lavender", "blush", "powder", "sage")
NoteColor = Literal["lavender", "butter", "blush", "powder", "sage"]
ChecklistColor = Literal["lavender", "butter", "blush", "powder", "sage"]


def _clean(value: str, field: str, max_length: int, allow_empty: bool = False) -> str:
    value = value.strip()
    if not value and not allow_empty:
        raise ValueError(f"{field} cannot be empty.")
    if len(value) > max_length:
        raise ValueError(f"{field} must be {max_length} characters or fewer.")
    return value


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(default="", max_length=20000)
    color: NoteColor = "lavender"

    @field_validator("title")
    @classmethod
    def _title(cls, v):
        return _clean(v, "Title", 120)
    @field_validator("body")
    @classmethod
    def _body(cls, v):
        return v.rstrip()


class NotePatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    body: Optional[str] = Field(default=None, max_length=20000)
    color: Optional[NoteColor] = None
    archived: Optional[bool] = None

    @field_validator("title")
    @classmethod
    def _title(cls, v):
        return None if v is None else _clean(v, "Title", 120)


class ChecklistCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    color: ChecklistColor = "butter"

    @field_validator("title")
    @classmethod
    def _title(cls, v):
        return _clean(v, "Title", 120)


class ChecklistPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    color: Optional[ChecklistColor] = None

    @field_validator("title")
    @classmethod
    def _title(cls, v):
        return None if v is None else _clean(v, "Title", 120)


class ItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=300)

    @field_validator("text")
    @classmethod
    def _text(cls, v):
        return _clean(v, "Item", 300)


class ItemPatch(BaseModel):
    text: Optional[str] = Field(default=None, min_length=1, max_length=300)
    done: Optional[bool] = None

    @field_validator("text")
    @classmethod
    def _text(cls, v):
        return None if v is None else _clean(v, "Item", 300)


def note_out(note: Note) -> dict:
    return {
        "id": note.id, "title": note.title, "body": note.body, "color": note.color,
        "archived": note.archived,
        "created_at": note.created_at.isoformat(), "updated_at": note.updated_at.isoformat(),
    }


def checklist_out(checklist: Checklist) -> dict:
    total = len(checklist.items)
    done = sum(1 for item in checklist.items if item.done)
    return {
        "id": checklist.id, "title": checklist.title, "color": checklist.color,
        "items": [{"id": i.id, "text": i.text, "done": i.done, "position": i.position} for i in checklist.items],
        "progress": {"done": done, "total": total, "percent": round(done / total * 100) if total else 0},
        "created_at": checklist.created_at.isoformat(), "updated_at": checklist.updated_at.isoformat(),
    }


def _owned_note(db: Session, user: User, note_id: int) -> Note:
    note = db.execute(select(Note).where(Note.id == note_id, Note.user_id == user.id)).scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note


def _owned_checklist(db: Session, user: User, checklist_id: int) -> Checklist:
    checklist = db.execute(select(Checklist).where(
        Checklist.id == checklist_id, Checklist.user_id == user.id)).scalar_one_or_none()
    if checklist is None:
        raise HTTPException(status_code=404, detail="Checklist not found.")
    return checklist


# ── Notes ───────────────────────────────────────────────────────
@router.get("/notes")
def list_notes(archived: bool = False, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Note).where(Note.user_id == user.id, Note.archived == archived)
                      .order_by(Note.updated_at.desc(), Note.id.desc())).scalars().all()
    return {"notes": [note_out(n) for n in rows]}


@router.post("/notes", status_code=201)
def create_note(body: NoteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = Note(user_id=user.id, title=body.title, body=body.body, color=body.color, archived=False)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note_out(note)


@router.get("/notes/{note_id}")
def get_note(note_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return note_out(_owned_note(db, user, note_id))


@router.patch("/notes/{note_id}")
def update_note(note_id: int, body: NotePatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = _owned_note(db, user, note_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(note, field, value)
    note.updated_at = utcnow()
    db.commit()
    return note_out(note)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned_note(db, user, note_id))
    db.commit()
    return Response(status_code=204)


# ── Checklists ──────────────────────────────────────────────────
@router.get("/checklists")
def list_checklists(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Checklist).where(Checklist.user_id == user.id)
                      .order_by(Checklist.updated_at.desc(), Checklist.id.desc())).scalars().all()
    return {"checklists": [checklist_out(c) for c in rows]}


@router.post("/checklists", status_code=201)
def create_checklist(body: ChecklistCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    checklist = Checklist(user_id=user.id, title=body.title, color=body.color)
    db.add(checklist)
    db.commit()
    db.refresh(checklist)
    return checklist_out(checklist)


@router.patch("/checklists/{checklist_id}")
def update_checklist(checklist_id: int, body: ChecklistPatch, user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    checklist = _owned_checklist(db, user, checklist_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(checklist, field, value)
    checklist.updated_at = utcnow()
    db.commit()
    return checklist_out(checklist)


@router.delete("/checklists/{checklist_id}", status_code=204)
def delete_checklist(checklist_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned_checklist(db, user, checklist_id))
    db.commit()
    return Response(status_code=204)


@router.post("/checklists/{checklist_id}/items", status_code=201)
def add_item(checklist_id: int, body: ItemCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    checklist = _owned_checklist(db, user, checklist_id)
    position = max((i.position for i in checklist.items), default=-1) + 1
    checklist.items.append(ChecklistItem(text=body.text, done=False, position=position))
    checklist.updated_at = utcnow()
    db.commit()
    db.refresh(checklist)
    return checklist_out(checklist)


@router.patch("/checklists/{checklist_id}/items/{item_id}")
def update_item(checklist_id: int, item_id: int, body: ItemPatch, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    checklist = _owned_checklist(db, user, checklist_id)
    item = next((i for i in checklist.items if i.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(item, field, value)
    checklist.updated_at = utcnow()
    db.commit()
    db.refresh(checklist)
    return checklist_out(checklist)


@router.delete("/checklists/{checklist_id}/items/{item_id}")
def delete_item(checklist_id: int, item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    checklist = _owned_checklist(db, user, checklist_id)
    item = next((i for i in checklist.items if i.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    checklist.items.remove(item)
    checklist.updated_at = utcnow()
    db.commit()
    db.refresh(checklist)
    return checklist_out(checklist)
