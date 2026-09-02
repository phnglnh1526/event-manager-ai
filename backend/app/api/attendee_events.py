import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.api.dependencies import require_roles
from app.core.event_status import EVENT_STATUS_PUBLISHED
from app.core.roles import ROLE_ATTENDEE
from app.db.database import get_db
from app.models import Event, User
from app.schemas import AttendeeEventResponse

router = APIRouter(tags=["Attendee Events"])
logger = logging.getLogger(__name__)

@router.get("/api/attendee/events", response_model=list[AttendeeEventResponse])
def list_attendee_events(current_user: User = Depends(require_roles(ROLE_ATTENDEE)), db: Session = Depends(get_db)) -> list[Event]:
    try:
        return list(db.scalars(select(Event).where(Event.status == EVENT_STATUS_PUBLISHED).order_by(Event.start_time.asc(), Event.id.asc())).all())
    except SQLAlchemyError:
        db.rollback(); logger.exception("Unable to load attendee events")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to load attendee events") from None
