from __future__ import annotations

import fitz  # pyright: ignore[reportMissingTypeStubs]
import pytest

from app.services.pdf_service import PDFExtractionError, extract_text_from_pdf


def _make_pdf(text: str, num_pages: int = 1) -> bytes:
    doc: fitz.Document = fitz.open()  # pyright: ignore[reportUnknownMemberType]
    for _ in range(num_pages):
        page = doc.new_page()
        page.insert_text((50, 50), text)  # pyright: ignore[reportUnknownMemberType]
    data: bytes = doc.tobytes()  # pyright: ignore[reportUnknownMemberType]
    doc.close()
    return data


class TestExtractTextFromPdf:
    def test_basic_extraction(self) -> None:
        pdf_bytes = _make_pdf("Hello, world!")
        text = extract_text_from_pdf(pdf_bytes)
        assert "Hello, world!" in text

    def test_multi_page(self) -> None:
        pdf_bytes = _make_pdf("Page content here.", num_pages=3)
        text = extract_text_from_pdf(pdf_bytes)
        assert text.count("Page content here.") == 3

    def test_invalid_bytes_raises(self) -> None:
        with pytest.raises(PDFExtractionError, match="Invalid or corrupted"):
            extract_text_from_pdf(b"not a pdf")

    def test_empty_pdf_raises(self) -> None:
        doc: fitz.Document = fitz.open()  # pyright: ignore[reportUnknownMemberType]
        doc.new_page()  # blank page with no text
        pdf_bytes: bytes = doc.tobytes()  # pyright: ignore[reportUnknownMemberType]
        doc.close()
        with pytest.raises(PDFExtractionError, match="No extractable text"):
            extract_text_from_pdf(pdf_bytes)
