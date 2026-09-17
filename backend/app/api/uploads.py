import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import UploadedFile, User
from app.schemas.upload import UploadImageResponse
from app.services.image_service import (
    MAX_FILE_SIZE_BYTES,
    init_cloudinary,
    upload_event_cover_image,
    validate_image_file,
)

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])
logger = logging.getLogger(__name__)

# Only roles authorized to create/edit events may upload cover images
upload_event_image_permission = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


@router.post(
    "/event-image",
    response_model=UploadImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_event_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(upload_event_image_permission),
    db: Session = Depends(get_db),
) -> UploadImageResponse:
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    # Read content with limit check
    try:
        content = await file.read()
    except Exception:
        logger.exception("Failed to read uploaded file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded file",
        ) from None

    # Validate file size and format signatures
    validate_image_file(content, file.content_type)

    # 1. Primary: Cloudinary if configured in environment
    if init_cloudinary():
        try:
            result = upload_event_cover_image(content, file.content_type)
            return UploadImageResponse(
                url=result["url"],
                public_id=result.get("public_id"),
            )
        except Exception as exc:
            logger.warning("Cloudinary upload failed: %s; falling back to cloud database storage", exc)

    # 2. Automated zero-config persistent Cloud Storage in Aiven MySQL (works everywhere)
    file_id = str(uuid.uuid4())
    uploaded_record = UploadedFile(
        id=file_id,
        filename=file.filename or f"{file_id}.jpg",
        content_type=file.content_type or "image/jpeg",
        data=content,
    )
    db.add(uploaded_record)
    db.commit()

    # Determine public URL
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    host = forwarded_host or request.headers.get("host")
    proto = forwarded_proto or request.url.scheme

    if host and "localhost" not in host:
        public_url = f"{proto}://{host}/api/uploads/file/{file_id}"
    else:
        public_url = f"https://event-manager-api-aeyc.onrender.com/api/uploads/file/{file_id}"

    return UploadImageResponse(
        url=public_url,
        public_id=file_id,
    )


@router.get("/file/{file_id}")
def get_uploaded_file(
    file_id: str,
    db: Session = Depends(get_db),
) -> Response:
    """Public endpoint to serve uploaded cover images from persistent cloud storage."""
    file_record = db.scalar(select(UploadedFile).where(UploadedFile.id == file_id))
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )
    return Response(
        content=file_record.data,
        media_type=file_record.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )

