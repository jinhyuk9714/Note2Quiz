"""add_wrong_note_unique_constraint

Revision ID: a3da42008f20
Revises: e4375d2b36e9
Create Date: 2026-02-26 03:44:18.946321

"""

from collections.abc import Sequence  # noqa: I001

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a3da42008f20"
down_revision: str | Sequence[str] | None = "e4375d2b36e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Remove duplicate wrong notes (keep newest) then add unique constraint."""
    # Delete duplicates: keep the row with the latest created_at per (user_id, quiz_item_id)
    op.execute("""
        DELETE FROM wrong_answer_notes
        WHERE id NOT IN (
            SELECT DISTINCT ON (user_id, quiz_item_id) id
            FROM wrong_answer_notes
            ORDER BY user_id, quiz_item_id, created_at DESC
        )
    """)
    op.create_unique_constraint(
        "uq_wrong_note_user_item", "wrong_answer_notes", ["user_id", "quiz_item_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_wrong_note_user_item", "wrong_answer_notes", type_="unique")
