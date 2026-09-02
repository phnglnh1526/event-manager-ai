import logging

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.registration_status import REGISTRATION_STATUS_REGISTERED
from app.core.ticket_status import TICKET_STATUS_ACTIVE, TICKET_STATUS_VOID
from app.db.base import Base
from app.db.database import SessionLocal, engine
from app.models import (  # noqa: F401
    Announcement,
    CheckIn,
    Event,
    Feedback,
    Registration,
    Schedule,
    Speaker,
    Ticket,
    User,
)
from app.services.tickets import create_ticket_with_retry

logger = logging.getLogger(__name__)


def ensure_registration_tickets() -> None:
    db = SessionLocal()
    try:
        registrations = db.scalars(
            select(Registration)
            .outerjoin(Ticket, Ticket.registration_id == Registration.id)
            .where(Ticket.id.is_(None))
            .order_by(Registration.id)
        ).all()
        for registration in registrations:
            ticket_status = (
                TICKET_STATUS_ACTIVE
                if registration.status == REGISTRATION_STATUS_REGISTERED
                else TICKET_STATUS_VOID
            )
            create_ticket_with_retry(db, registration.id, ticket_status)
        db.commit()
        if registrations:
            logger.info("Created tickets for %d existing registrations", len(registrations))
    except (SQLAlchemyError, RuntimeError):
        db.rollback()
        logger.exception("Registration ticket backfill failed")
        raise
    finally:
        db.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_registration_tickets()
