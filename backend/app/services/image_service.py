import base64
import json
import logging
import urllib.parse
import urllib.request
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
FREEIMAGE_API_KEY = "6d207e02198a847aa98d0a2a901485a5"


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


def upload_to_freeimage(content: bytes) -> dict[str, str | None]:
    """Upload image to FreeImage cloud CDN as an automated zero-config fallback."""
    b64_data = base64.b64encode(content).decode("utf-8")
    data = urllib.parse.urlencode({
        "key": FREEIMAGE_API_KEY,
        "action": "upload",
        "source": b64_data,
        "format": "json",
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://freeimage.host/api/1/upload",
        data=data,
        headers={"User-Agent": "EventManagerAI/1.0"},
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        img_url = res.get("image", {}).get("url")
        if not img_url:
            raise RuntimeError("FreeImage response missing image url")
        return {
            "url": img_url,
            "public_id": res.get("image", {}).get("name"),
        }


def upload_event_cover_image(content: bytes, content_type: str | None) -> dict[str, str | None]:
    """Validate and upload an event cover image to Cloudinary (or FreeImage cloud fallback).

    Returns dict with 'url' and 'public_id'.
    """
    validate_image_file(content, content_type)

    # 1. Primary: Use Cloudinary if credentials are provided in environment
    if init_cloudinary():
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
            logger.warning("Cloudinary upload failed: %s; falling back to cloud image host", exc)

    # 2. Automated zero-config fallback: FreeImage.host CDN
    try:
        return upload_to_freeimage(content)
    except Exception as exc:
        logger.exception("Cloud image upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Image storage upload failed. Please try again.",
        ) from None

