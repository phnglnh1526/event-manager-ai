import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import User
from app.schemas import EventStatisticsResponse
from app.services.statistics_service import get_event_statistics

router = APIRouter(tags=["Statistics"])
logger = logging.getLogger(__name__)
statistics_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


@router.get(
    "/api/events/{event_id}/statistics",
    response_model=EventStatisticsResponse,
)
def event_statistics(
    event_id: int,
    current_user: User = Depends(statistics_manager),
    db: Session = Depends(get_db),
) -> EventStatisticsResponse:
    event = get_event_for_management(event_id, current_user, db)
    try:
        return get_event_statistics(db, event)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to load statistics for event %s", event_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load event statistics",
        ) from None
