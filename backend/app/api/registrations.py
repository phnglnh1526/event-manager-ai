import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.event_status import EVENT_STATUS_PUBLISHED
from app.core.registration_status import (
    REGISTRATION_STATUS_CANCELLED,
    REGISTRATION_STATUS_REGISTERED,
)
from app.core.roles import ROLE_ADMIN, ROLE_ATTENDEE, ROLE_ORGANIZER
from app.core.ticket_status import TICKET_STATUS_ACTIVE, TICKET_STATUS_VOID
from app.db.database import get_db
from app.models import CheckIn, Event, Registration, Ticket, User
from app.schemas import RegistrationResponse
from app.services.tickets import create_ticket_with_retry

router = APIRouter(tags=["Registrations"])
logger = logging.getLogger(__name__)
attendee_only = require_roles(ROLE_ATTENDEE)
registration_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Registration database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Registration database operation failed",
    )


@router.post(
    "/api/events/{event_id}/registrations",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_for_event(
    event_id: int,
    response: Response,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Registration:
    try:
        event = db.scalar(
            select(Event).where(Event.id == event_id).with_for_update()
        )
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )
        if (
            event.status != EVENT_STATUS_PUBLISHED
            or event.end_time <= datetime.now()
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Event is not open for registration",
            )

        registration = db.scalar(
            select(Registration)
            .where(
                Registration.event_id == event_id,
                Registration.user_id == current_user.id,
            )
            .with_for_update()
        )
        if (
            registration is not None
            and registration.status == REGISTRATION_STATUS_REGISTERED
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Already registered for this event",
            )

        active_registration_ids = db.scalars(
            select(Registration.id)
            .where(
                Registration.event_id == event_id,
                Registration.status == REGISTRATION_STATUS_REGISTERED,
            )
            .with_for_update()
        ).all()
        if len(active_registration_ids) >= event.max_attendees:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Event is full",
            )

        if registration is None:
            registration = Registration(
                event_id=event_id,
                user_id=current_user.id,
                status=REGISTRATION_STATUS_REGISTERED,
            )
            db.add(registration)
            db.flush()
            create_ticket_with_retry(db, registration.id)
        else:
            registration.status = REGISTRATION_STATUS_REGISTERED
            ticket = db.scalar(
                select(Ticket)
                .where(Ticket.registration_id == registration.id)
                .with_for_update()
            )
            if ticket is None:
                create_ticket_with_retry(db, registration.id)
            else:
                ticket.status = TICKET_STATUS_ACTIVE
            response.status_code = status.HTTP_200_OK

        db.commit()
        db.refresh(registration)
        return registration
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already registered for this event",
        ) from None
    except RuntimeError:
        raise _database_error(db, "generate ticket code") from None
    except SQLAlchemyError:
        raise _database_error(db, "register") from None


@router.delete(
    "/api/events/{event_id}/registrations/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
def cancel_registration(
    event_id: int,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Response:
    try:
        registration = db.scalar(
            select(Registration)
            .where(
                Registration.event_id == event_id,
                Registration.user_id == current_user.id,
                Registration.status == REGISTRATION_STATUS_REGISTERED,
            )
            .with_for_update()
        )
        if registration is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active registration not found",
            )
        ticket = db.scalar(
            select(Ticket)
            .where(Ticket.registration_id == registration.id)
            .with_for_update()
        )
        if ticket is not None and db.scalar(
            select(CheckIn.id).where(CheckIn.ticket_id == ticket.id)
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Checked-in registration cannot be cancelled",
            )
        registration.status = REGISTRATION_STATUS_CANCELLED
        if ticket is None:
            create_ticket_with_retry(db, registration.id, TICKET_STATUS_VOID)
        else:
            ticket.status = TICKET_STATUS_VOID
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        raise _database_error(db, "cancel") from None
    except RuntimeError:
        raise _database_error(db, "generate ticket code during cancel") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/api/registrations/me",
    response_model=list[RegistrationResponse],
)
def list_my_registrations(
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> list[Registration]:
    try:
        return list(
            db.scalars(
                select(Registration)
                .where(Registration.user_id == current_user.id)
                .order_by(Registration.created_at.desc(), Registration.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list current user") from None


@router.get(
    "/api/events/{event_id}/registrations",
    response_model=list[RegistrationResponse],
)
def list_event_registrations(
    event_id: int,
    current_user: User = Depends(registration_manager),
    db: Session = Depends(get_db),
) -> list[Registration]:
    get_event_for_management(event_id, current_user, db)
    try:
        return list(
            db.scalars(
                select(Registration)
                .where(Registration.event_id == event_id)
                .order_by(Registration.created_at.desc(), Registration.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list event") from None
