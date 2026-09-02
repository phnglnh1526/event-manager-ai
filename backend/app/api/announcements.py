import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.announcement_status import (
    ANNOUNCEMENT_STATUS_DRAFT,
    ANNOUNCEMENT_STATUS_PUBLISHED,
)
from app.core.registration_status import REGISTRATION_STATUS_REGISTERED
from app.core.roles import ROLE_ADMIN, ROLE_ATTENDEE, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import Announcement, Registration, User
from app.schemas import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate

router = APIRouter(tags=["Announcements"])
logger = logging.getLogger(__name__)
announcement_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)
attendee_only = require_roles(ROLE_ATTENDEE)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Announcement database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Announcement database operation failed",
    )


def _published_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _get_managed_announcement(
    event_id: int,
    announcement_id: int,
    db: Session,
) -> Announcement:
    try:
        announcement = db.scalar(
            select(Announcement).where(
                Announcement.id == announcement_id,
                Announcement.event_id == event_id,
            )
        )
    except SQLAlchemyError:
        raise _database_error(db, "load") from None
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    return announcement


@router.post(
    "/api/events/{event_id}/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    event_id: int,
    payload: AnnouncementCreate,
    current_user: User = Depends(announcement_manager),
    db: Session = Depends(get_db),
) -> Announcement:
    get_event_for_management(event_id, current_user, db)
    announcement = Announcement(
        **payload.model_dump(),
        event_id=event_id,
        created_by_user_id=current_user.id,
        published_at=(
            _published_now()
            if payload.status == ANNOUNCEMENT_STATUS_PUBLISHED
            else None
        ),
    )
    db.add(announcement)
    try:
        db.commit()
        db.refresh(announcement)
    except (IntegrityError, SQLAlchemyError):
        raise _database_error(db, "create") from None
    return announcement


@router.get(
    "/api/events/{event_id}/announcements",
    response_model=list[AnnouncementResponse],
)
def list_event_announcements(
    event_id: int,
    current_user: User = Depends(announcement_manager),
    db: Session = Depends(get_db),
) -> list[Announcement]:
    get_event_for_management(event_id, current_user, db)
    try:
        return list(
            db.scalars(
                select(Announcement)
                .where(Announcement.event_id == event_id)
                .order_by(Announcement.created_at.desc(), Announcement.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list event") from None


@router.get(
    "/api/events/{event_id}/announcements/{announcement_id}",
    response_model=AnnouncementResponse,
)
def get_event_announcement(
    event_id: int,
    announcement_id: int,
    current_user: User = Depends(announcement_manager),
    db: Session = Depends(get_db),
) -> Announcement:
    get_event_for_management(event_id, current_user, db)
    return _get_managed_announcement(event_id, announcement_id, db)


@router.patch(
    "/api/events/{event_id}/announcements/{announcement_id}",
    response_model=AnnouncementResponse,
)
def update_event_announcement(
    event_id: int,
    announcement_id: int,
    payload: AnnouncementUpdate,
    current_user: User = Depends(announcement_manager),
    db: Session = Depends(get_db),
) -> Announcement:
    get_event_for_management(event_id, current_user, db)
    announcement = _get_managed_announcement(event_id, announcement_id, db)
    changes = payload.model_dump(exclude_unset=True)
    new_status = changes.get("status")
    if (
        new_status == ANNOUNCEMENT_STATUS_PUBLISHED
        and announcement.status == ANNOUNCEMENT_STATUS_DRAFT
    ):
        announcement.published_at = _published_now()
    elif (
        new_status == ANNOUNCEMENT_STATUS_DRAFT
        and announcement.status == ANNOUNCEMENT_STATUS_PUBLISHED
    ):
        announcement.published_at = None
    for field_name, value in changes.items():
        setattr(announcement, field_name, value)
    try:
        db.commit()
        db.refresh(announcement)
    except (IntegrityError, SQLAlchemyError):
        raise _database_error(db, "update") from None
    return announcement


@router.delete(
    "/api/events/{event_id}/announcements/{announcement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_event_announcement(
    event_id: int,
    announcement_id: int,
    current_user: User = Depends(announcement_manager),
    db: Session = Depends(get_db),
) -> Response:
    get_event_for_management(event_id, current_user, db)
    announcement = _get_managed_announcement(event_id, announcement_id, db)
    db.delete(announcement)
    try:
        db.commit()
    except (IntegrityError, SQLAlchemyError):
        raise _database_error(db, "delete") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/announcements/me", response_model=list[AnnouncementResponse])
def list_my_announcements(
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> list[Announcement]:
    try:
        return list(
            db.scalars(
                select(Announcement)
                .join(Registration, Registration.event_id == Announcement.event_id)
                .where(
                    Registration.user_id == current_user.id,
                    Registration.status == REGISTRATION_STATUS_REGISTERED,
                    Announcement.status == ANNOUNCEMENT_STATUS_PUBLISHED,
                )
                .order_by(Announcement.published_at.desc(), Announcement.id.desc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list attendee") from None


@router.get(
    "/api/announcements/me/{announcement_id}",
    response_model=AnnouncementResponse,
)
def get_my_announcement(
    announcement_id: int,
    current_user: User = Depends(attendee_only),
    db: Session = Depends(get_db),
) -> Announcement:
    try:
        announcement = db.scalar(
            select(Announcement)
            .join(Registration, Registration.event_id == Announcement.event_id)
            .where(
                Announcement.id == announcement_id,
                Announcement.status == ANNOUNCEMENT_STATUS_PUBLISHED,
                Registration.user_id == current_user.id,
                Registration.status == REGISTRATION_STATUS_REGISTERED,
            )
        )
    except SQLAlchemyError:
        raise _database_error(db, "load attendee detail") from None
    if announcement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )
    return announcement
