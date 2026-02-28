"""add_indexes_and_jsonb

Revision ID: a8c3f1e92d47
Revises: 776727e8f77d
Create Date: 2026-02-28 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql  # noqa: F401

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a8c3f1e92d47"
down_revision: str | Sequence[str] | None = "776727e8f77d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add composite indexes, convert concept_tags to JSONB, add GIN indexes."""
    # --- Composite indexes ---
    op.create_index(
        "ix_documents_owner_created",
        "documents",
        ["owner_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_chunks_document_index",
        "chunks",
        ["document_id", "index"],
        unique=False,
    )
    op.create_index(
        "ix_quiz_attempts_user_created",
        "quiz_attempts",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_quiz_items_source_chunk_id",
        "quiz_items",
        ["source_chunk_id"],
        unique=False,
    )

    # --- Convert concept_tags from JSON to JSONB ---
    op.alter_column(
        "wrong_answer_notes",
        "concept_tags",
        existing_type=sa.JSON(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        postgresql_using="concept_tags::jsonb",
    )
    op.alter_column(
        "quiz_items",
        "concept_tags",
        existing_type=sa.JSON(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        postgresql_using="concept_tags::jsonb",
    )

    # --- GIN indexes on JSONB concept_tags ---
    op.create_index(
        "ix_wrong_notes_concept_tags_gin",
        "wrong_answer_notes",
        ["concept_tags"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index(
        "ix_quiz_items_concept_tags_gin",
        "quiz_items",
        ["concept_tags"],
        unique=False,
        postgresql_using="gin",
    )


def downgrade() -> None:
    """Remove indexes and revert JSONB to JSON."""
    # --- Drop GIN indexes ---
    op.drop_index("ix_quiz_items_concept_tags_gin", table_name="quiz_items")
    op.drop_index("ix_wrong_notes_concept_tags_gin", table_name="wrong_answer_notes")

    # --- Revert JSONB to JSON ---
    op.alter_column(
        "quiz_items",
        "concept_tags",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.JSON(),
        existing_nullable=False,
        postgresql_using="concept_tags::json",
    )
    op.alter_column(
        "wrong_answer_notes",
        "concept_tags",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.JSON(),
        existing_nullable=False,
        postgresql_using="concept_tags::json",
    )

    # --- Drop composite indexes ---
    op.drop_index("ix_quiz_items_source_chunk_id", table_name="quiz_items")
    op.drop_index("ix_quiz_attempts_user_created", table_name="quiz_attempts")
    op.drop_index("ix_chunks_document_index", table_name="chunks")
    op.drop_index("ix_documents_owner_created", table_name="documents")
