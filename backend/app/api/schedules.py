import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import Event, Schedule, Speaker, User
from app.schemas import ScheduleCreate, ScheduleResponse, ScheduleUpdate

router = APIRouter(prefix="/api/events/{event_id}/schedules", tags=["Schedules"])
logger = logging.getLogger(__name__)
schedule_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Schedule database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Schedule database operation failed",
    )


def _get_schedule(event_id: int, schedule_id: int, db: Session) -> Schedule:
    try:
        schedule = db.scalar(
            select(Schedule).where(
                Schedule.id == schedule_id,
                Schedule.event_id == event_id,
            )
        )
    except SQLAlchemyError:
        raise _database_error(db, "load") from None

    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule not found",
        )
    return schedule


def _validate_time_range(
    event: Event,
    start_time: datetime,
    end_time: datetime,
) -> None:
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time",
        )
    if start_time < event.start_time or end_time > event.end_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Schedule must be within event time range",
        )


def _validate_speaker(event_id: int, speaker_id: int, db: Session) -> None:
    try:
        speaker = db.scalar(
            select(Speaker).where(
                Speaker.id == speaker_id,
                Speaker.event_id == event_id,
            )
        )
    except SQLAlchemyError:
        raise _database_error(db, "validate speaker") from None

    if speaker is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Speaker does not belong to this event",
        )


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(
    event_id: int,
    payload: ScheduleCreate,
    current_user: User = Depends(schedule_manager),
    db: Session = Depends(get_db),
) -> Schedule:
    event = get_event_for_management(event_id, current_user, db)
    _validate_time_range(event, payload.start_time, payload.end_time)
    if payload.speaker_id is not None:
        _validate_speaker(event_id, payload.speaker_id, db)

    schedule = Schedule(**payload.model_dump(), event_id=event_id)
    db.add(schedule)
    try:
        db.commit()
        db.refresh(schedule)
    except SQLAlchemyError:
        raise _database_error(db, "create") from None
    return schedule


@router.get("", response_model=list[ScheduleResponse])
def list_schedules(
    event_id: int,
    current_user: User = Depends(schedule_manager),
    db: Session = Depends(get_db),
) -> list[Schedule]:
    get_event_for_management(event_id, current_user, db)
    try:
        return list(
            db.scalars(
                select(Schedule)
                .where(Schedule.event_id == event_id)
                .order_by(Schedule.start_time.asc(), Schedule.id.asc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list") from None


@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    event_id: int,
    schedule_id: int,
    current_user: User = Depends(schedule_manager),
    db: Session = Depends(get_db),
) -> Schedule:
    get_event_for_management(event_id, current_user, db)
    return _get_schedule(event_id, schedule_id, db)


@router.patch("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    event_id: int,
    schedule_id: int,
    payload: ScheduleUpdate,
    current_user: User = Depends(schedule_manager),
    db: Session = Depends(get_db),
) -> Schedule:
    event = get_event_for_management(event_id, current_user, db)
    schedule = _get_schedule(event_id, schedule_id, db)
    changes = payload.model_dump(exclude_unset=True)
    start_time = changes.get("start_time", schedule.start_time)
    end_time = changes.get("end_time", schedule.end_time)
    _validate_time_range(event, start_time, end_time)

    if "speaker_id" in changes and changes["speaker_id"] is not None:
        _validate_speaker(event_id, changes["speaker_id"], db)

    for field_name, value in changes.items():
        setattr(schedule, field_name, value)

    try:
        db.commit()
        db.refresh(schedule)
    except SQLAlchemyError:
        raise _database_error(db, "update") from None
    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    event_id: int,
    schedule_id: int,
    current_user: User = Depends(schedule_manager),
    db: Session = Depends(get_db),
) -> Response:
    get_event_for_management(event_id, current_user, db)
    schedule = _get_schedule(event_id, schedule_id, db)
    db.delete(schedule)
    try:
        db.commit()
    except SQLAlchemyError:
        raise _database_error(db, "delete") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
