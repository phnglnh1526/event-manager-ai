import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import Event, User
from app.schemas import EventCreate, EventResponse, EventUpdate

router = APIRouter(prefix="/api/events", tags=["Events"])
logger = logging.getLogger(__name__)
event_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Event database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Event database operation failed",
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    current_user: User = Depends(event_manager),
    db: Session = Depends(get_db),
) -> Event:
    event = Event(**payload.model_dump(), owner_id=current_user.id)
    db.add(event)
    try:
        db.commit()
        db.refresh(event)
    except SQLAlchemyError:
        raise _database_error(db, "create") from None
    return event


@router.get("", response_model=list[EventResponse])
def list_events(
    current_user: User = Depends(event_manager),
    db: Session = Depends(get_db),
) -> list[Event]:
    statement = select(Event)
    if current_user.role != ROLE_ADMIN:
        statement = statement.where(Event.owner_id == current_user.id)
    statement = statement.order_by(Event.id.desc())

    try:
        return list(db.scalars(statement).all())
    except SQLAlchemyError:
        raise _database_error(db, "list") from None


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    current_user: User = Depends(event_manager),
    db: Session = Depends(get_db),
) -> Event:
    return get_event_for_management(event_id, current_user, db)


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    payload: EventUpdate,
    current_user: User = Depends(event_manager),
    db: Session = Depends(get_db),
) -> Event:
    event = get_event_for_management(event_id, current_user, db)
    changes = payload.model_dump(exclude_unset=True)
    start_time = changes.get("start_time", event.start_time)
    end_time = changes.get("end_time", event.end_time)
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time",
        )

    for field_name, value in changes.items():
        setattr(event, field_name, value)

    try:
        db.commit()
        db.refresh(event)
    except SQLAlchemyError:
        raise _database_error(db, "update") from None
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    current_user: User = Depends(event_manager),
    db: Session = Depends(get_db),
) -> Response:
    event = get_event_for_management(event_id, current_user, db)
    db.delete(event)
    try:
        db.commit()
    except SQLAlchemyError:
        raise _database_error(db, "delete") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
