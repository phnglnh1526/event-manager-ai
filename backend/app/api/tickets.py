import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.roles import ROLE_ADMIN, ROLE_ATTENDEE, ROLE_ORGANIZER
from app.core.registration_status import REGISTRATION_STATUS_REGISTERED
from app.core.ticket_status import TICKET_STATUS_ACTIVE
from app.db.database import get_db
from app.models import Registration, Ticket, User
from app.schemas import TicketResponse
from app.services.qr import generate_ticket_qr

router = APIRouter(tags=["Tickets"])
logger = logging.getLogger(__name__)
attendee_only = require_roles(ROLE_ATTENDEE)
ticket_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Ticket database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Ticket database operation failed",
    )


@router.get("/api/tickets/me", response_model=list[TicketResponse])
def list_my_tickets(
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> list[Ticket]:
    try:
        return list(
            db.scalars(
                select(Ticket)
                .join(Registration, Ticket.registration_id == Registration.id)
                .where(Registration.user_id == current_user.id)
                .order_by(Ticket.issued_at.desc(), Ticket.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list current user") from None


@router.get("/api/tickets/me/{ticket_id}", response_model=TicketResponse)
def get_my_ticket(
    ticket_id: int,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Ticket:
    try:
        ticket = db.scalar(
            select(Ticket)
            .join(Registration, Ticket.registration_id == Registration.id)
            .where(
                Ticket.id == ticket_id,
                Registration.user_id == current_user.id,
            )
        )
    except SQLAlchemyError:
        raise _database_error(db, "get current user detail") from None
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


@router.get(
    "/api/tickets/me/{ticket_id}/qr",
    response_class=StreamingResponse,
    responses={200: {"content": {"image/png": {}}}},
)
def get_my_ticket_qr(
    ticket_id: int,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    try:
        row = db.execute(
            select(Ticket, Registration)
            .join(Registration, Ticket.registration_id == Registration.id)
            .where(
                Ticket.id == ticket_id,
                Registration.user_id == current_user.id,
            )
        ).one_or_none()
    except SQLAlchemyError:
        raise _database_error(db, "get QR") from None
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    ticket, registration = row
    if (
        ticket.status != TICKET_STATUS_ACTIVE
        or registration.status != REGISTRATION_STATUS_REGISTERED
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ticket is not active",
        )
    return StreamingResponse(generate_ticket_qr(ticket.ticket_code), media_type="image/png")


@router.get("/api/events/{event_id}/tickets", response_model=list[TicketResponse])
def list_event_tickets(
    event_id: int,
    current_user: User = Depends(ticket_manager),
    db: Session = Depends(get_db),
) -> list[Ticket]:
    get_event_for_management(event_id, current_user, db)
    try:
        return list(
            db.scalars(
                select(Ticket)
                .join(Registration, Ticket.registration_id == Registration.id)
                .where(Registration.event_id == event_id)
                .order_by(Ticket.issued_at.desc(), Ticket.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list event") from None


@router.get(
    "/api/events/{event_id}/tickets/{ticket_id}",
    response_model=TicketResponse,
)
def get_event_ticket(
    event_id: int,
    ticket_id: int,
    current_user: User = Depends(ticket_manager),
    db: Session = Depends(get_db),
) -> Ticket:
    get_event_for_management(event_id, current_user, db)
    try:
        ticket = db.scalar(
            select(Ticket)
            .join(Registration, Ticket.registration_id == Registration.id)
            .where(Ticket.id == ticket_id, Registration.event_id == event_id)
        )
    except SQLAlchemyError:
        raise _database_error(db, "get event detail") from None
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket
