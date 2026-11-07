"""Notes, checklists, and checklist items.

Revision ID: 0002_notes_checklists
Revises: 0001_initial
Create Date: 2026-10-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_notes_checklists"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_notes_user_id", "notes", ["user_id"])

    op.create_table(
        "checklists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_checklists_user_id", "checklists", ["user_id"])

    op.create_table(
        "checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("checklist_id", sa.Integer(), sa.ForeignKey("checklists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.String(length=300), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_checklist_items_checklist_id", "checklist_items", ["checklist_id"])


def downgrade() -> None:
    op.drop_index("ix_checklist_items_checklist_id", table_name="checklist_items")
    op.drop_table("checklist_items")
    op.drop_index("ix_checklists_user_id", table_name="checklists")
    op.drop_table("checklists")
    op.drop_index("ix_notes_user_id", table_name="notes")
    op.drop_table("notes")
