from __future__ import annotations

from app.services.document_service import compute_hash, normalize_text, split_into_chunks


class TestNormalizeText:
    def test_collapses_whitespace(self) -> None:
        assert normalize_text("hello   world") == "hello world"

    def test_collapses_newlines(self) -> None:
        assert normalize_text("a\n\n\n\nb") == "a\n\nb"

    def test_converts_crlf(self) -> None:
        assert normalize_text("a\r\nb") == "a\nb"

    def test_strips_edges(self) -> None:
        assert normalize_text("  hello  ") == "hello"

    def test_empty_string(self) -> None:
        assert normalize_text("") == ""

    def test_korean_whitespace_collapsing(self) -> None:
        assert normalize_text("한국어   테스트") == "한국어 테스트"

    def test_korean_newline_collapsing(self) -> None:
        assert normalize_text("첫째\n\n\n\n둘째") == "첫째\n\n둘째"

    def test_korean_crlf(self) -> None:
        assert normalize_text("가\r\n나") == "가\n나"


class TestSplitIntoChunks:
    def test_single_chunk_short_text(self) -> None:
        chunks = split_into_chunks("Hello world.", chunk_size=100, overlap=10)
        assert len(chunks) == 1
        assert chunks[0] == "Hello world."

    def test_splits_long_text(self) -> None:
        sentences = [f"Sentence number {i}." for i in range(20)]
        text = " ".join(sentences)
        # Each sentence ~19 chars; chunk_size=50 fits ~2 sentences per chunk
        chunks = split_into_chunks(text, chunk_size=50, overlap=0)
        assert len(chunks) >= 2

    def test_overlap_preserves_context(self) -> None:
        sentences = [f"Sentence number {i}." for i in range(20)]
        text = " ".join(sentences)
        chunks = split_into_chunks(text, chunk_size=80, overlap=30)
        if len(chunks) >= 2:
            words_0 = set(chunks[0].split())
            words_1 = set(chunks[1].split())
            assert len(words_0 & words_1) > 0

    def test_empty_text_returns_single_or_no_chunk(self) -> None:
        chunks = split_into_chunks("", chunk_size=100, overlap=10)
        assert len(chunks) <= 1


class TestSplitIntoChunksKorean:
    def test_splits_on_korean_period_no_space(self) -> None:
        """Korean text often has no space after a period."""
        text = "첫 번째 문장입니다.두 번째 문장입니다.세 번째 문장입니다."
        chunks = split_into_chunks(text, chunk_size=30, overlap=0)
        assert len(chunks) >= 2

    def test_splits_on_newlines(self) -> None:
        """Newlines are primary sentence boundaries in Korean PDFs."""
        text = "첫 번째 문장입니다\n두 번째 문장입니다\n세 번째 문장입니다"
        chunks = split_into_chunks(text, chunk_size=25, overlap=0)
        assert len(chunks) >= 2

    def test_korean_period_with_space(self) -> None:
        """Korean text with spaces after periods should also work."""
        text = "첫 번째 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다."
        chunks = split_into_chunks(text, chunk_size=30, overlap=0)
        assert len(chunks) >= 2

    def test_korean_question_marks(self) -> None:
        """Korean questions ending with ?"""
        text = "이것은 무엇입니까?저것은 무엇입니까?그것은 어디에 있습니까?"
        chunks = split_into_chunks(text, chunk_size=25, overlap=0)
        assert len(chunks) >= 2

    def test_korean_full_stop_u3002(self) -> None:
        """CJK full stop character (U+3002)."""
        text = "첫 번째 문장입니다。두 번째 문장입니다。세 번째 문장입니다。"
        chunks = split_into_chunks(text, chunk_size=30, overlap=0)
        assert len(chunks) >= 2

    def test_korean_chunk_size_uses_characters(self) -> None:
        """chunk_size is measured in characters, not words."""
        # 23 chars but only ~1 "word" by space-splitting
        text = "인공지능은현대사회에서매우중요한역할을하고있습니다"
        chunks = split_into_chunks(text, chunk_size=10, overlap=0)
        # No sentence boundary so it stays as one chunk, but it IS > 10 chars
        assert len(chunks) == 1

    def test_korean_overlap_preserves_context(self) -> None:
        """Overlap works with character-based metrics for Korean."""
        sentences = [
            "첫 번째 중요한 개념입니다.",
            "두 번째 핵심 내용입니다.",
            "세 번째 관련 정보입니다.",
            "네 번째 보충 설명입니다.",
        ]
        text = "\n".join(sentences)
        chunks = split_into_chunks(text, chunk_size=35, overlap=15)
        if len(chunks) >= 2:
            assert any(word in chunks[1] for word in chunks[0].split() if len(word) > 1)


class TestSplitIntoChunksMixed:
    def test_mixed_korean_english(self) -> None:
        """Mixed Korean/English text should chunk correctly."""
        text = (
            "Machine Learning은 데이터를 기반으로 학습합니다.\n"
            "Deep Learning은 Neural Network를 사용합니다.\n"
            "자연어 처리(NLP)는 텍스트를 분석합니다."
        )
        chunks = split_into_chunks(text, chunk_size=50, overlap=0)
        assert len(chunks) >= 2
        for chunk in chunks:
            assert len(chunk) > 5


class TestComputeHash:
    def test_deterministic(self) -> None:
        assert compute_hash("hello") == compute_hash("hello")

    def test_different_inputs(self) -> None:
        assert compute_hash("a") != compute_hash("b")

    def test_returns_hex_64_chars(self) -> None:
        result = compute_hash("test")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)
