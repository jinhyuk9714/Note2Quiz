from __future__ import annotations

import logging

import fitz  # pyright: ignore[reportMissingTypeStubs]

from app.core.config import settings

logger = logging.getLogger(__name__)


class PDFExtractionError(Exception):
    """Raised when PDF text extraction fails."""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF byte stream.

    Returns concatenated text from all pages, separated by double newlines.

    Raises:
        PDFExtractionError: If the file is invalid, encrypted, exceeds the
            page limit, or contains no extractable text.
    """
    try:
        doc: fitz.Document = fitz.open(stream=pdf_bytes, filetype="pdf")  # pyright: ignore[reportUnknownMemberType]
    except Exception as exc:
        raise PDFExtractionError("Invalid or corrupted PDF file.") from exc

    if doc.is_encrypted:
        doc.close()
        raise PDFExtractionError("Encrypted/password-protected PDFs are not supported.")

    if len(doc) > settings.max_pdf_pages:
        doc.close()
        raise PDFExtractionError(
            f"PDF exceeds maximum page limit ({settings.max_pdf_pages} pages)."
        )

    logger.info("Extracting text from PDF: %d pages", len(doc))
    pages: list[str] = []
    for page in doc:
        text: str = page.get_text("text")  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType, reportAssignmentType]
        if text.strip():
            pages.append(text.strip())
    doc.close()

    full_text = "\n\n".join(pages)
    if len(full_text.strip()) < 10:
        raise PDFExtractionError(
            "No extractable text found in PDF. The file may contain only images."
        )

    return full_text
