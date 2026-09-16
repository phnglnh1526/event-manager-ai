import logging
from typing import BinaryIO

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, status

from app.core.config import get_settings

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
CLOUDINARY_EVENTS_FOLDER = "event-manager-ai/events"


def validate_image_file(content: bytes, content_type: str | None) -> str:
    """Validate file content size, MIME type and magic bytes.

    Returns the detected image format ('jpeg', 'png', 'webp').
    Raises HTTPException(400) if invalid.
    """
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB",
        )

    if not content_type or content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image type. Allowed types: image/jpeg, image/png, image/webp",
        )

    # Validate actual file signatures (magic bytes)
    if content_type.lower() == "image/jpeg":
        if not content.startswith(b"\xff\xd8\xff"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match JPEG format",
            )
        return "jpeg"

    if content_type.lower() == "image/png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match PNG format",
            )
        return "png"

    if content_type.lower() == "image/webp":
        if not (content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match WebP format",
            )
        return "webp"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported image format",
    )


def is_cloudinary_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.cloudinary_cloud_name
        and settings.cloudinary_api_key
        and settings.cloudinary_api_secret
    )


def init_cloudinary() -> bool:
    settings = get_settings()
    if not is_cloudinary_configured():
        return False
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    return True


def upload_event_cover_image(content: bytes, content_type: str | None) -> dict[str, str | None]:
    """Validate and upload an event cover image to Cloudinary.

    Returns dict with 'url' and 'public_id'.
    """
    validate_image_file(content, content_type)

    if not init_cloudinary():
        logger.error("Cloudinary credentials are not configured in environment")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload service is not configured",
        )

    try:
        response = cloudinary.uploader.upload(
            content,
            folder=CLOUDINARY_EVENTS_FOLDER,
            resource_type="image",
        )
        return {
            "url": response.get("secure_url"),
            "public_id": response.get("public_id"),
        }
    except Exception as exc:
        logger.exception("Cloudinary upload failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Image storage upload failed",
        ) from None
