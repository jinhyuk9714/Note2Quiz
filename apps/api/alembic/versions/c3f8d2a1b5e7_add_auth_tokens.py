"""add_auth_tokens

Revision ID: c3f8d2a1b5e7
Revises: a8c3f1e92d47
Create Date: 2026-02-28 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3f8d2a1b5e7"
down_revision: str | Sequence[str] | None = "a8c3f1e92d47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add refresh token and password reset token fields to users."""
    op.add_column("users", sa.Column("refresh_token", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("refresh_token_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("password_reset_token", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Remove refresh token and password reset token fields from users."""
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token")
    op.drop_column("users", "refresh_token_expires_at")
    op.drop_column("users", "refresh_token")
