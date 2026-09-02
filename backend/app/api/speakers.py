import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.api.event_helpers import get_event_for_management
from app.core.roles import ROLE_ADMIN, ROLE_ORGANIZER
from app.db.database import get_db
from app.models import Speaker, User
from app.schemas import SpeakerCreate, SpeakerResponse, SpeakerUpdate

router = APIRouter(prefix="/api/events/{event_id}/speakers", tags=["Speakers"])
logger = logging.getLogger(__name__)
speaker_manager = require_roles(ROLE_ADMIN, ROLE_ORGANIZER)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("Speaker database operation failed: %s", operation)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Speaker database operation failed",
    )


def _get_speaker(event_id: int, speaker_id: int, db: Session) -> Speaker:
    try:
        speaker = db.scalar(
            select(Speaker).where(
                Speaker.id == speaker_id,
                Speaker.event_id == event_id,
            )
        )
    except SQLAlchemyError:
        raise _database_error(db, "load") from None

    if speaker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Speaker not found",
        )
    return speaker


@router.post("", response_model=SpeakerResponse, status_code=status.HTTP_201_CREATED)
def create_speaker(
    event_id: int,
    payload: SpeakerCreate,
    current_user: User = Depends(speaker_manager),
    db: Session = Depends(get_db),
) -> Speaker:
    get_event_for_management(event_id, current_user, db)
    speaker = Speaker(**payload.model_dump(mode="json"), event_id=event_id)
    db.add(speaker)
    try:
        db.commit()
        db.refresh(speaker)
    except SQLAlchemyError:
        raise _database_error(db, "create") from None
    return speaker


@router.get("", response_model=list[SpeakerResponse])
def list_speakers(
    event_id: int,
    current_user: User = Depends(speaker_manager),
    db: Session = Depends(get_db),
) -> list[Speaker]:
    get_event_for_management(event_id, current_user, db)
    try:
        return list(
            db.scalars(
                select(Speaker)
                .where(Speaker.event_id == event_id)
                .order_by(Speaker.id.asc())
            ).all()
        )
    except SQLAlchemyError:
        raise _database_error(db, "list") from None


@router.get("/{speaker_id}", response_model=SpeakerResponse)
def get_speaker(
    event_id: int,
    speaker_id: int,
    current_user: User = Depends(speaker_manager),
    db: Session = Depends(get_db),
) -> Speaker:
    get_event_for_management(event_id, current_user, db)
    return _get_speaker(event_id, speaker_id, db)


@router.patch("/{speaker_id}", response_model=SpeakerResponse)
def update_speaker(
    event_id: int,
    speaker_id: int,
    payload: SpeakerUpdate,
    current_user: User = Depends(speaker_manager),
    db: Session = Depends(get_db),
) -> Speaker:
    get_event_for_management(event_id, current_user, db)
    speaker = _get_speaker(event_id, speaker_id, db)
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        setattr(speaker, field_name, value)

    try:
        db.commit()
        db.refresh(speaker)
    except SQLAlchemyError:
        raise _database_error(db, "update") from None
    return speaker


@router.delete("/{speaker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_speaker(
    event_id: int,
    speaker_id: int,
    current_user: User = Depends(speaker_manager),
    db: Session = Depends(get_db),
) -> Response:
    get_event_for_management(event_id, current_user, db)
    speaker = _get_speaker(event_id, speaker_id, db)
    db.delete(speaker)
    try:
        db.commit()
    except SQLAlchemyError:
        raise _database_error(db, "delete") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
