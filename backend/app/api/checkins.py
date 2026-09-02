import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.event_status import EVENT_STATUS_PUBLISHED
from app.core.registration_status import REGISTRATION_STATUS_REGISTERED
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER, ROLE_STAFF
from app.core.ticket_status import TICKET_STATUS_ACTIVE
from app.db.database import get_db
from app.models import CheckIn, Event, Registration, Ticket, User
from app.schemas import CheckInEventResponse, CheckInRequest, CheckInResponse

router = APIRouter(tags=["Check-ins"])
logger = logging.getLogger(__name__)
checkin_operator = require_roles(ROLE_ADMIN, ROLE_ORGANIZER, ROLE_STAFF)
checkin_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)

@router.get("/api/checkin/events", response_model=list[CheckInEventResponse])
def list_checkin_events(current_user: User = Depends(checkin_operator), db: Session = Depends(get_db)) -> list[Event]:
    statement = select(Event).where(Event.status == EVENT_STATUS_PUBLISHED)
    if current_user.role == ROLE_ORGANIZER:
        statement = statement.where(Event.owner_id == current_user.id)
    try:
        return list(db.scalars(statement.order_by(Event.start_time.asc(), Event.id.asc())).all())
    except SQLAlchemyError:
        raise _database_error(db, "list check-in events") from None


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Check-in database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Check-in database operation failed",
    )


def _get_event_for_checkin(
    event_id: int, current_user: User, db: Session
) -> Event:
    if current_user.role != ROLE_STAFF:
        return get_event_for_management(event_id, current_user, db)
    try:
        event = db.get(Event, event_id)
    except SQLAlchemyError:
        raise _database_error(db, "load event") from None
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.post(
    "/api/events/{event_id}/checkins",
    response_model=CheckInResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_checkin(
    event_id: int,
    payload: CheckInRequest,
    current_user: User = Depends(checkin_operator),
    db: Session = Depends(get_db),
) -> CheckIn:
    event = _get_event_for_checkin(event_id, current_user, db)
    if event.status != EVENT_STATUS_PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Event is not open for check-in",
        )

    try:
        ticket = db.scalar(
            select(Ticket)
            .join(Registration, Ticket.registration_id == Registration.id)
            .where(
                Ticket.ticket_code == payload.ticket_code,
                Registration.event_id == event_id,
            )
            .with_for_update()
        )
        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
            )
        registration = db.get(Registration, ticket.registration_id)
        if registration is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
            )
        if registration.status != REGISTRATION_STATUS_REGISTERED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Registration is not active",
            )
        if ticket.status != TICKET_STATUS_ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ticket is not active",
            )
        if db.scalar(select(CheckIn.id).where(CheckIn.ticket_id == ticket.id)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ticket already checked in",
            )

        checkin = CheckIn(
            ticket_id=ticket.id,
            checked_in_by_user_id=current_user.id,
        )
        db.add(checkin)
        db.commit()
        db.refresh(checkin)
        return checkin
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ticket already checked in",
        ) from None
    except SQLAlchemyError:
        raise _database_error(db, "create") from None


@router.get(
    "/api/events/{event_id}/checkins",
    response_model=list[CheckInResponse],
)
def list_event_checkins(
    event_id: int,
    current_user: User = Depends(checkin_manager),
    db: Session = Depends(get_db),
) -> list[CheckIn]:
    get_event_for_management(event_id, current_user, db)
    try:
        return list(
            db.scalars(
                select(CheckIn)
                .join(Ticket, CheckIn.ticket_id == Ticket.id)
                .join(Registration, Ticket.registration_id == Registration.id)
                .where(Registration.event_id == event_id)
                .order_by(CheckIn.checked_in_at.desc(), CheckIn.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list event") from None
