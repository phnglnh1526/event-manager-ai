import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.roles import ROLE_ADMIN
from app.models import Event, User

logger = logging.getLogger(__name__)


def get_event_for_management(
    event_id: int,
    current_user: User,
    db: Session,
) -> Event:
    statement = select(Event).where(Event.id == event_id)
    if current_user.role != ROLE_ADMIN:
        statement = statement.where(Event.owner_id == current_user.id)

    try:
        event = db.scalar(statement)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to load event for management")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Event database operation failed",
        ) from None

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return event
