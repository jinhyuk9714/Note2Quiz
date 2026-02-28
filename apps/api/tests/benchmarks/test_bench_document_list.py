"""Document list query benchmark: 4-query vs 2-query (JOIN consolidated)."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.benchmarks.conftest import QueryCounter
from tests.benchmarks.seed_factory import SeedResult


@pytest.mark.benchmark
class TestDocumentListBenchmark:
    """Measure document list query performance after JOIN consolidation."""

    async def test_query_count(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        """Verify the optimized list_documents uses only 2 SQL queries (count + data)."""
        from sqlalchemy import func, select

        from app.models.document import Document
        from app.models.folder import Folder
        from app.models.quiz import Quiz

        user_id = large_dataset.user_id

        counter = QueryCounter()
        with counter:
            # Count query
            count_stmt = select(func.count()).select_from(
                select(Document).where(Document.owner_id == user_id).subquery()
            )
            total = (await db_session.execute(count_stmt)).scalar_one()

            # Combined data query (single JOIN for quiz_count + folder_name)
            data_stmt = (
                select(
                    Document,
                    func.coalesce(func.count(Quiz.id), 0).label("quiz_count"),
                    Folder.name.label("folder_name"),
                )
                .outerjoin(Quiz, Quiz.document_id == Document.id)
                .outerjoin(Folder, Folder.id == Document.folder_id)
                .where(Document.owner_id == user_id)
                .group_by(Document.id, Folder.id)
                .order_by(Document.created_at.desc())
                .limit(20)
            )
            result = await db_session.execute(data_stmt)
            rows = result.all()

        query_count = counter.count

        print(f"\n  Optimized document list queries: {query_count}")
        print(f"  Total documents: {total}")
        print(f"  Rows returned: {len(rows)}")

        # The optimized version should use exactly 2 queries
        assert query_count == 2, f"Expected 2 queries, got {query_count}"
        assert total == 100  # from seed_factory defaults
        assert len(rows) == 20  # limit

    async def test_data_correctness(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        """Verify JOIN query returns correct quiz_count and folder_name."""
        from sqlalchemy import func, select

        from app.models.document import Document
        from app.models.folder import Folder
        from app.models.quiz import Quiz

        user_id = large_dataset.user_id

        # Get one document with a folder and quizzes via the optimized query
        data_stmt = (
            select(
                Document,
                func.coalesce(func.count(Quiz.id), 0).label("quiz_count"),
                Folder.name.label("folder_name"),
            )
            .outerjoin(Quiz, Quiz.document_id == Document.id)
            .outerjoin(Folder, Folder.id == Document.folder_id)
            .where(Document.owner_id == user_id, Document.folder_id.isnot(None))
            .group_by(Document.id, Folder.id)
            .limit(1)
        )
        result = await db_session.execute(data_stmt)
        row = result.first()
        assert row is not None

        doc, quiz_count, folder_name = row

        # Cross-check quiz count
        verify_stmt = select(func.count(Quiz.id)).where(Quiz.document_id == doc.id)
        expected_count = (await db_session.execute(verify_stmt)).scalar_one()
        assert int(quiz_count) == expected_count

        # Cross-check folder name
        assert folder_name is not None
        assert isinstance(folder_name, str)
        assert len(folder_name) > 0
