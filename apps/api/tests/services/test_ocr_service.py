from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ocr_service import (
    ImageExtractionError,
    extract_text_from_image,
    validate_image,
)


class TestValidateImage:
    def test_valid_jpeg(self) -> None:
        validate_image(b"x" * 1000, "image/jpeg")

    def test_valid_png(self) -> None:
        validate_image(b"x" * 1000, "image/png")

    def test_valid_webp(self) -> None:
        validate_image(b"x" * 1000, "image/webp")

    def test_unsupported_type_raises(self) -> None:
        with pytest.raises(ImageExtractionError, match="Unsupported image type"):
            validate_image(b"x" * 1000, "text/plain")

    def test_gif_not_supported(self) -> None:
        with pytest.raises(ImageExtractionError, match="Unsupported image type"):
            validate_image(b"x" * 1000, "image/gif")

    def test_too_small_raises(self) -> None:
        with pytest.raises(ImageExtractionError, match="too small"):
            validate_image(b"x" * 10, "image/jpeg")

    def test_too_large_raises(self) -> None:
        with pytest.raises(ImageExtractionError, match="exceeds maximum"):
            validate_image(b"x" * (21 * 1024 * 1024), "image/jpeg")


class TestExtractTextFromImage:
    @pytest.mark.asyncio
    async def test_successful_extraction(self) -> None:
        from anthropic.types import TextBlock

        mock_block = MagicMock(spec=TextBlock)
        mock_block.text = "Extracted lecture notes text here with enough content."

        mock_response = MagicMock()
        mock_response.content = [mock_block]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with patch(
            "app.core.llm_client.create_llm_client",
            return_value=mock_client,
        ):
            result = await extract_text_from_image(b"x" * 1000, "image/jpeg")

        assert "Extracted lecture notes" in result

    @pytest.mark.asyncio
    async def test_empty_result_raises(self) -> None:
        mock_block = MagicMock(spec=[])
        mock_block.text = "short"

        mock_response = MagicMock()
        mock_response.content = [mock_block]

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with (
            patch(
                "app.core.llm_client.create_llm_client",
                return_value=mock_client,
            ),
            pytest.raises(ImageExtractionError, match="No readable text"),
        ):
            await extract_text_from_image(b"x" * 1000, "image/png")

    @pytest.mark.asyncio
    async def test_api_error_raises(self) -> None:
        import anthropic as anthropic_mod

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic_mod.APIError(message="fail", request=MagicMock(), body=None)
        )

        with (
            patch(
                "app.core.llm_client.create_llm_client",
                return_value=mock_client,
            ),
            pytest.raises(ImageExtractionError, match="temporarily unavailable"),
        ):
            await extract_text_from_image(b"x" * 1000, "image/jpeg")

    @pytest.mark.asyncio
    async def test_bad_request_error_raises(self) -> None:
        import anthropic as anthropic_mod

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            side_effect=anthropic_mod.BadRequestError(
                message="invalid image", response=MagicMock(), body=None
            )
        )

        with (
            patch(
                "app.core.llm_client.create_llm_client",
                return_value=mock_client,
            ),
            pytest.raises(ImageExtractionError, match="corrupted or unreadable"),
        ):
            await extract_text_from_image(b"x" * 1000, "image/webp")

    @pytest.mark.asyncio
    async def test_validation_failure_skips_api_call(self) -> None:
        with pytest.raises(ImageExtractionError, match="Unsupported image type"):
            await extract_text_from_image(b"x" * 1000, "text/plain")
