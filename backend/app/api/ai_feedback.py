import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import Feedback, User
from app.schemas import AIFeedbackSummaryResponse
from app.services.ai_feedback_service import (
    AIConfigurationError,
    AIInvalidResponseError,
    AIUpstreamError,
    generate_feedback_summary,
)

router = APIRouter(tags=["AI Feedback"])
logger = logging.getLogger(__name__)
ai_feedback_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


@router.post(
    "/api/events/{event_id}/ai/feedback-summary",
    response_model=AIFeedbackSummaryResponse,
)
def summarize_event_feedback(
    event_id: int,
    current_user: User = Depends(ai_feedback_manager),
    db: Session = Depends(get_db),
) -> AIFeedbackSummaryResponse:
    event = get_event_for_management(event_id, current_user, db)
    try:
        feedback_count, average_rating = db.execute(
            select(func.count(Feedback.id), func.avg(Feedback.rating)).where(
                Feedback.event_id == event_id
            )
        ).one()
        distribution_rows = db.execute(
            select(Feedback.rating, func.count(Feedback.id))
            .where(Feedback.event_id == event_id)
            .group_by(Feedback.rating)
        ).all()
        comment_rows = db.execute(
            select(Feedback.rating, Feedback.comment)
            .where(
                Feedback.event_id == event_id,
                Feedback.comment.is_not(None),
                func.length(func.trim(Feedback.comment)) > 0,
            )
            .order_by(Feedback.created_at.desc(), Feedback.id.desc())
            .limit(100)
        ).all()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to load feedback for AI summary for event %s", event_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load feedback for AI summary",
        ) from None

    if feedback_count == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No feedback available for AI summary",
        )
    if not comment_rows:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No written feedback available for AI summary",
        )

    try:
        return generate_feedback_summary(
            event_id=event.id,
            event_title=event.title,
            feedback_count=feedback_count,
            average_rating=round(float(average_rating), 2),
            rating_distribution={rating: count for rating, count in distribution_rows},
            feedback_items=[(rating, comment) for rating, comment in comment_rows],
        )
    except AIConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured",
        ) from None
    except AIInvalidResponseError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid response",
        ) from None
    except AIUpstreamError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable",
        ) from None
