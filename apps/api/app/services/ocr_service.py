from __future__ import annotations

import base64
import logging

import anthropic
from anthropic.types import (
    Base64ImageSourceParam,
    ImageBlockParam,
    TextBlock,
    TextBlockParam,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

SUPPORTED_IMAGE_TYPES: frozenset[str] = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)

_MAX_IMAGE_BYTES: int = settings.max_upload_size_mb * 1024 * 1024


class ImageExtractionError(Exception):
    """Raised when image OCR text extraction fails."""


def validate_image(image_bytes: bytes, content_type: str) -> None:
    """Validate image bytes and content type before OCR.

    Raises:
        ImageExtractionError: If validation fails.
    """
    if content_type not in SUPPORTED_IMAGE_TYPES:
        raise ImageExtractionError(
            f"Unsupported image type: {content_type}. Supported: JPEG, PNG, WEBP."
        )
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise ImageExtractionError(
            f"Image exceeds maximum size ({settings.max_upload_size_mb} MB)."
        )
    if len(image_bytes) < 100:
        raise ImageExtractionError("Image file is too small or corrupted.")


async def extract_text_from_image(
    image_bytes: bytes,
    media_type: str,
) -> str:
    """Extract text from an image using Claude Vision API.

    Args:
        image_bytes: Raw image bytes.
        media_type: MIME type (image/jpeg, image/png, image/webp).

    Returns:
        Extracted text preserving structure (headings, bullets, etc.).

    Raises:
        ImageExtractionError: On validation failure or API error.
    """
    validate_image(image_bytes, media_type)

    image_b64 = base64.standard_b64encode(image_bytes).decode("ascii")

    image_block = ImageBlockParam(
        type="image",
        source=Base64ImageSourceParam(
            type="base64",
            media_type=media_type,  # type: ignore[arg-type]
            data=image_b64,
        ),
    )
    text_block = TextBlockParam(type="text", text=_build_ocr_prompt())

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [image_block, text_block],
                }
            ],
        )
    except anthropic.BadRequestError as exc:
        raise ImageExtractionError(
            "Image could not be processed. It may be corrupted or unreadable."
        ) from exc
    except anthropic.APIError as exc:
        logger.exception("Claude Vision API call failed")
        raise ImageExtractionError(
            "OCR service temporarily unavailable. Please try again."
        ) from exc

    first_block = response.content[0]
    extracted = first_block.text if isinstance(first_block, TextBlock) else ""

    if len(extracted.strip()) < 10:
        raise ImageExtractionError(
            "No readable text found in the image. "
            "The image may be too blurry, empty, or contain only diagrams."
        )

    return extracted


def _build_ocr_prompt() -> str:
    """Build the OCR instruction prompt for Claude Vision."""
    return """You are an expert OCR system for educational materials. Extract ALL text from this image accurately.

Instructions:
1. Extract every piece of text visible in the image.
2. Preserve the document structure: headings, bullet points, numbered lists, paragraphs.
3. If there are multiple columns, read left-to-right, top-to-bottom.
4. For handwritten text, do your best to interpret it accurately.
5. Preserve mathematical notation as plain text (e.g., "x^2 + y^2 = r^2").
6. If text is in Korean, Chinese, Japanese, or any other language, extract it in the original language.
7. Do NOT add any commentary, explanation, or markdown formatting.
8. Do NOT describe the image or its layout -- only output the extracted text.

Output the extracted text directly, preserving line breaks and structure."""
