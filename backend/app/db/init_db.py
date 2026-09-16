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


def ensure_admin_password() -> None:
    """Safely ensure admin@example.com password matches the configured administrative password."""
    try:
        from app.core.security import hash_password, verify_password

        target_password = "MAT_KHAU_MOI_CUA_TOI"
        db = SessionLocal()
        try:
            admin = db.scalar(select(User).where(User.email == "admin@example.com"))
            if not admin:
                logger.warning("Account admin@example.com not found in database.")
                return

            if admin.role != "ADMIN" or not admin.is_active:
                logger.error(
                    "Account admin@example.com check failed: role=%s, is_active=%s",
                    admin.role,
                    admin.is_active,
                )
                return

            if not verify_password(target_password, admin.password_hash):
                admin.password_hash = hash_password(target_password)
                db.commit()
                db.refresh(admin)
                is_verified = verify_password(target_password, admin.password_hash)
                logger.info("Admin password reset status for admin@example.com: %s", is_verified)
            else:
                logger.info("Admin password for admin@example.com is already up to date.")
        finally:
            db.close()
    except Exception:
        logger.exception("Admin password verification failed")


def ensure_schema_migrations() -> None:
    """Safely apply schema additions without data loss or dropping tables."""
    try:
        inspector = inspect(engine)
        if "events" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("events")]
            if "cover_image_url" not in columns:
                logger.info("Applying safe migration: adding cover_image_url to events table")
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE events ADD COLUMN cover_image_url VARCHAR(500) NULL"))
                logger.info("Migration successful: cover_image_url column added to events")
    except Exception:
        logger.exception("Schema migration check/execution failed")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations()
    ensure_admin_password()
    ensure_registration_tickets()


