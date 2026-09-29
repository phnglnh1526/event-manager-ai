import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.core.roles import ROLE_ATTENDEE
from app.db.database import get_db
from app.models import User
from app.schemas.ai_assistant import (
    PersonalAssistantChatRequest,
    PersonalAssistantChatResponse,
)
from app.services.ai_chat_service import AIInvalidChatResponseError
from app.services.ai_feedback_service import AIConfigurationError, AIUpstreamError
from app.services.ai_personal_assistant_service import (
    PersonalAssistantContextError,
    generate_personal_assistant_response,
    load_personal_assistant_context,
)

router = APIRouter(tags=["AI Personal Assistant"])
logger = logging.getLogger(__name__)
attendee_user = require_roles(ROLE_ATTENDEE)


@router.post(
    "/api/attendee/ai-assistant/chat",
    response_model=PersonalAssistantChatResponse,
)
def chat_with_personal_assistant(
    payload: PersonalAssistantChatRequest,
    current_user: User = Depends(attendee_user),
    db: Session = Depends(get_db),
) -> PersonalAssistantChatResponse:
    try:
        context = load_personal_assistant_context(db, current_user)
    except PersonalAssistantContextError:
        logger.exception("Unable to load personal assistant context")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load personal assistant context",
        ) from None
    try:
        return generate_personal_assistant_response(context=context, payload=payload)
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
        logger.warning("Personal assistant generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable",
        ) from None
