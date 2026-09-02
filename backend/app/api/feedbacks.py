import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.event_status import EVENT_STATUS_COMPLETED, EVENT_STATUS_PUBLISHED
from app.core.registration_status import REGISTRATION_STATUS_REGISTERED
from app.core.roles import ROLE_ADMIN, ROLE_ATTENDEE, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import CheckIn, Event, Feedback, Registration, Ticket, User
from app.schemas import FeedbackCreate, FeedbackResponse, FeedbackUpdate

router = APIRouter(tags=["Feedbacks"])
logger = logging.getLogger(__name__)
attendee_only = require_roles(ROLE_ATTENDEE)
feedback_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Feedback database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Feedback database operation failed",
    )


def _get_event(event_id: int, db: Session) -> Event:
    try:
        event = db.get(Event, event_id)
    except SQLAlchemyError:
        raise _database_error(db, "load event") from None
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


def _require_feedback_eligibility(
    event_id: int, user_id: int, db: Session
) -> None:
    eligible = db.scalar(
        select(CheckIn.id)
        .join(Ticket, CheckIn.ticket_id == Ticket.id)
        .join(Registration, Ticket.registration_id == Registration.id)
        .where(
            Registration.event_id == event_id,
            Registration.user_id == user_id,
            Registration.status == REGISTRATION_STATUS_REGISTERED,
        )
    )
    if eligible is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feedback is only available after check-in",
        )


def _get_own_feedback(event_id: int, user_id: int, db: Session) -> Feedback:
    try:
        feedback = db.scalar(
            select(Feedback).where(
                Feedback.event_id == event_id,
                Feedback.user_id == user_id,
            )
        )
    except SQLAlchemyError:
        raise _database_error(db, "load own feedback") from None
    if feedback is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found"
        )
    return feedback


@router.post(
    "/api/events/{event_id}/feedbacks",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_feedback(
    event_id: int,
    payload: FeedbackCreate,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Feedback:
    event = _get_event(event_id, db)
    if event.status not in {EVENT_STATUS_PUBLISHED, EVENT_STATUS_COMPLETED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Event is not available for feedback",
        )
    try:
        _require_feedback_eligibility(event_id, current_user.id, db)
        if db.scalar(
            select(Feedback.id).where(
                Feedback.event_id == event_id,
                Feedback.user_id == current_user.id,
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Feedback already submitted",
            )
        feedback = Feedback(
            event_id=event_id,
            user_id=current_user.id,
            **payload.model_dump(),
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return feedback
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Feedback already submitted",
        ) from None
    except SQLAlchemyError:
        raise _database_error(db, "create") from None


@router.get(
    "/api/events/{event_id}/feedbacks/me", response_model=FeedbackResponse
)
def get_own_feedback(
    event_id: int,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Feedback:
    return _get_own_feedback(event_id, current_user.id, db)


@router.patch(
    "/api/events/{event_id}/feedbacks/me", response_model=FeedbackResponse
)
def update_own_feedback(
    event_id: int,
    payload: FeedbackUpdate,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Feedback:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field must be provided",
        )
    feedback = _get_own_feedback(event_id, current_user.id, db)
    for field_name, value in changes.items():
        setattr(feedback, field_name, value)
    try:
        db.commit()
        db.refresh(feedback)
        return feedback
    except SQLAlchemyError:
        raise _database_error(db, "update") from None


@router.delete(
    "/api/events/{event_id}/feedbacks/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_own_feedback(
    event_id: int,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Response:
    feedback = _get_own_feedback(event_id, current_user.id, db)
    db.delete(feedback)
    try:
        db.commit()
    except SQLAlchemyError:
        raise _database_error(db, "delete") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/api/events/{event_id}/feedbacks",
    response_model=list[FeedbackResponse],
)
def list_event_feedbacks(
    event_id: int,
    current_user: User = Depends(feedback_manager),
    db: Session = Depends(get_db),
) -> list[Feedback]:
    get_event_for_management(event_id, current_user, db)
    try:
        return list(
            db.scalars(
                select(Feedback)
                .where(Feedback.event_id == event_id)
                .order_by(Feedback.created_at.desc(), Feedback.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list event") from None
