import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.api.dependencies import require_roles
from app.core.event_status import EVENT_STATUS_PUBLISHED
from app.core.roles import ROLE_ATTENDEE
from app.db.database import get_db
from app.models import Event, Schedule, Speaker, User
from app.schemas import AttendeeEventDetailResponse, AttendeeEventResponse

router = APIRouter(tags=["Attendee Events"])
logger = logging.getLogger(__name__)

@router.get("/api/attendee/events", response_model=list[AttendeeEventResponse])
def list_attendee_events(current_user: User = Depends(require_roles(ROLE_ATTENDEE)), db: Session = Depends(get_db)) -> list[Event]:
    try:
        return list(db.scalars(select(Event).where(Event.status == EVENT_STATUS_PUBLISHED).order_by(Event.start_time.asc(), Event.id.asc())).all())
    except SQLAlchemyError as exc:
        if "cover_image_url" in str(exc) or "1054" in str(exc):
            try:
                from app.db.init_db import ensure_schema_migrations
                ensure_schema_migrations()
                return list(db.scalars(select(Event).where(Event.status == EVENT_STATUS_PUBLISHED).order_by(Event.start_time.asc(), Event.id.asc())).all())
            except Exception:
                pass
        db.rollback(); logger.exception("Unable to load attendee events")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to load attendee events") from None


@router.get("/api/attendee/events/{event_id}", response_model=AttendeeEventDetailResponse)
def get_attendee_event_detail(
    event_id: int,
    current_user: User = Depends(require_roles(ROLE_ATTENDEE)),
    db: Session = Depends(get_db),
) -> dict:
    try:
        event = db.scalar(select(Event).where(Event.id == event_id, Event.status == EVENT_STATUS_PUBLISHED))
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sự kiện không tồn tại hoặc chưa được công bố",
            )

        speakers = list(
            db.scalars(
                select(Speaker).where(Speaker.event_id == event_id).order_by(Speaker.id.asc())
            ).all()
        )

        schedule_rows = db.execute(
            select(Schedule, Speaker.full_name)
            .outerjoin(
                Speaker,
                (Schedule.speaker_id == Speaker.id) & (Speaker.event_id == event_id),
            )
            .where(Schedule.event_id == event_id)
            .order_by(Schedule.start_time.asc(), Schedule.id.asc())
        ).all()

        schedules = [
            {
                "id": s.id,
                "title": s.title,
                "description": s.description,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "location": s.location,
                "speaker_id": s.speaker_id,
                "speaker_name": speaker_name,
            }
            for s, speaker_name in schedule_rows
        ]

        return {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "cover_image_url": event.cover_image_url,
            "location": event.location,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "status": event.status,
            "max_attendees": event.max_attendees,
            "speakers": speakers,
            "schedules": schedules,
        }
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Unable to load attendee event details")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to load attendee event details",
        ) from None

