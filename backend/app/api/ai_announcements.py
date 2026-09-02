import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import User
from app.schemas import AIAnnouncementDraftRequest, AIAnnouncementDraftResponse
from app.services.ai_announcement_service import (
    AIAnnouncementContextError,
    AIInvalidAnnouncementResponseError,
    generate_announcement_draft,
)
from app.services.ai_feedback_service import AIConfigurationError, AIUpstreamError

router = APIRouter(tags=["AI"])
logger = logging.getLogger(__name__)
ai_announcement_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


@router.post(
    "/api/events/{event_id}/ai/announcement-draft",
    response_model=AIAnnouncementDraftResponse,
)
def create_ai_announcement_draft(
    event_id: int,
    payload: AIAnnouncementDraftRequest,
    current_user: User = Depends(ai_announcement_manager),
    db: Session = Depends(get_db),
) -> AIAnnouncementDraftResponse:
    event = get_event_for_management(event_id, current_user, db)
    try:
        return generate_announcement_draft(db=db, event=event, request=payload)
    except AIAnnouncementContextError:
        logger.exception("Unable to load event context for AI announcement draft")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load event context for AI announcement draft",
        ) from None
    except AIConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured",
        ) from None
    except AIInvalidAnnouncementResponseError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid announcement draft",
        ) from None
    except AIUpstreamError:
        logger.warning("AI announcement generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable",
        ) from None
