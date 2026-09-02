import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.core.roles import ROLE_ADMIN, ROLE_ATTENDEE, ROLE_ORGANIZER, ROLE_STAFF
from app.db.database import get_db
from app.models import User
from app.schemas.ai_chat import EventChatRequest, EventChatResponse
from app.services.ai_chat_service import (
    AIInvalidChatResponseError,
    EventChatContextError,
    generate_event_chat_response,
    load_event_chat_context,
)
from app.services.ai_feedback_service import AIConfigurationError, AIUpstreamError

router = APIRouter(tags=["AI Event Chat"])
logger = logging.getLogger(__name__)
event_chat_user = require_roles(
    ROLE_ADMIN,
    ROLE_ORGANIZER,
    ROLE_STAFF,
    ROLE_ATTENDEE,
)


@router.post(
    "/api/events/{event_id}/ai/chat",
    response_model=EventChatResponse,
)
def chat_about_event(
    event_id: int,
    payload: EventChatRequest,
    current_user: User = Depends(event_chat_user),
    db: Session = Depends(get_db),
) -> EventChatResponse:
    try:
        context = load_event_chat_context(db, event_id, current_user)
    except EventChatContextError:
        logger.exception("Unable to load event context for AI chat")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load event context for AI chat",
        ) from None
    try:
        return generate_event_chat_response(
            context=context,
            question=payload.question,
        )
    except AIConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured",
        ) from None
    except AIInvalidChatResponseError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid chat response",
        ) from None
    except AIUpstreamError:
        logger.warning("AI event chat generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable",
        ) from None
