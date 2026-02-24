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


class TestSplitIntoChunks:
    def test_single_chunk_short_text(self) -> None:
        chunks = split_into_chunks("Hello world.", chunk_size=100, overlap=10)
        assert len(chunks) == 1
        assert chunks[0] == "Hello world."

    def test_splits_long_text(self) -> None:
        sentences = [f"Sentence number {i}." for i in range(20)]
        text = " ".join(sentences)
        chunks = split_into_chunks(text, chunk_size=4, overlap=0)
        assert len(chunks) >= 2

    def test_overlap_preserves_context(self) -> None:
        sentences = [f"Sentence number {i}." for i in range(20)]
        text = " ".join(sentences)
        chunks = split_into_chunks(text, chunk_size=10, overlap=3)
        if len(chunks) >= 2:
            words_0 = set(chunks[0].split())
            words_1 = set(chunks[1].split())
            assert len(words_0 & words_1) > 0

    def test_empty_text_returns_single_or_no_chunk(self) -> None:
        chunks = split_into_chunks("", chunk_size=100, overlap=10)
        assert len(chunks) <= 1


class TestComputeHash:
    def test_deterministic(self) -> None:
        assert compute_hash("hello") == compute_hash("hello")

    def test_different_inputs(self) -> None:
        assert compute_hash("a") != compute_hash("b")

    def test_returns_hex_64_chars(self) -> None:
        result = compute_hash("test")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)
