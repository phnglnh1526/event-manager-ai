import logging

from sqlalchemy import inspect, select, text
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
    UploadedFile,
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


def ensure_schema_migrations() -> None:
    """Safely apply schema additions and indexes without data loss or dropping tables."""
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()

        if "events" in table_names:
            columns = [c["name"] for c in inspector.get_columns("events")]
            if "cover_image_url" not in columns:
                logger.info("Applying safe migration: adding cover_image_url to events table")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE events ADD COLUMN cover_image_url VARCHAR(500) NULL"))
                logger.info("Migration successful: cover_image_url column added to events")

            existing_indexes = {idx["name"] for idx in inspector.get_indexes("events")}
            with engine.begin() as conn:
                if "ix_events_status" not in existing_indexes:
                    conn.execute(text("CREATE INDEX ix_events_status ON events (status)"))
                    logger.info("Created index ix_events_status")
                if "ix_events_start_time" not in existing_indexes:
                    conn.execute(text("CREATE INDEX ix_events_start_time ON events (start_time)"))
                    logger.info("Created index ix_events_start_time")

        if "registrations" in table_names:
            existing_indexes = {idx["name"] for idx in inspector.get_indexes("registrations")}
            if "ix_registrations_event_id_status" not in existing_indexes:
                with engine.begin() as conn:
                    conn.execute(text("CREATE INDEX ix_registrations_event_id_status ON registrations (event_id, status)"))
                    logger.info("Created index ix_registrations_event_id_status")

        if "announcements" in table_names:
            existing_indexes = {idx["name"] for idx in inspector.get_indexes("announcements")}
            with engine.begin() as conn:
                if "ix_announcements_status" not in existing_indexes:
                    conn.execute(text("CREATE INDEX ix_announcements_status ON announcements (status)"))
                    logger.info("Created index ix_announcements_status")
                if "ix_announcements_event_id_status" not in existing_indexes:
                    conn.execute(text("CREATE INDEX ix_announcements_event_id_status ON announcements (event_id, status)"))
                    logger.info("Created index ix_announcements_event_id_status")

        if "feedbacks" in table_names:
            existing_indexes = {idx["name"] for idx in inspector.get_indexes("feedbacks")}
            if "ix_feedbacks_event_id_rating" not in existing_indexes:
                with engine.begin() as conn:
                    conn.execute(text("CREATE INDEX ix_feedbacks_event_id_rating ON feedbacks (event_id, rating)"))
                    logger.info("Created index ix_feedbacks_event_id_rating")
    except Exception:
        logger.exception("Schema migration check/execution failed")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations()
    ensure_registration_tickets()


