import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.dependencies import require_roles
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.models import User
from app.schemas.upload import UploadImageResponse
from app.services.image_service import MAX_FILE_SIZE_BYTES, upload_event_cover_image

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
    file: UploadFile = File(...),
    current_user: User = Depends(upload_event_image_permission),
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

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB",
        )

    result = upload_event_cover_image(content, file.content_type)
    return UploadImageResponse(
        url=result["url"],
        public_id=result.get("public_id"),
    )
