"""add_source_unit_ids

Revision ID: d4a7f3e8b1c2
Revises: c3f8d2a1b5e7
Create Date: 2026-03-01 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4a7f3e8b1c2"
down_revision: str | Sequence[str] | None = "c3f8d2a1b5e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add source_unit_ids JSONB column to quiz_items."""
    op.add_column(
        "quiz_items",
        sa.Column(
            "source_unit_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.alter_column("quiz_items", "source_unit_ids", server_default=None)


def downgrade() -> None:
    """Remove source_unit_ids column from quiz_items."""
    op.drop_column("quiz_items", "source_unit_ids")
