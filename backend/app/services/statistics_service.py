import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.registration_status import (
    REGISTRATION_STATUS_CANCELLED,
    REGISTRATION_STATUS_REGISTERED,
)
from app.models import CheckIn, Event, Feedback, Registration, Ticket
from app.schemas.statistics import EventStatisticsResponse

logger = logging.getLogger(__name__)


def _percentage(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(min(numerator / denominator * 100, 100.0), 2)


def get_event_statistics(db: Session, event: Event) -> EventStatisticsResponse:
    registration_rows = db.execute(
        select(Registration.status, func.count(Registration.id))
        .where(Registration.event_id == event.id)
        .group_by(Registration.status)
    ).all()
    registration_counts = {row.status: int(row[1]) for row in registration_rows}
    registered = registration_counts.get(REGISTRATION_STATUS_REGISTERED, 0)
    cancelled = registration_counts.get(REGISTRATION_STATUS_CANCELLED, 0)
    total_registrations = int(
        db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == event.id
            )
        )
        or 0
    )

    checked_in = int(
        db.scalar(
            select(func.count(CheckIn.id))
            .join(Ticket, CheckIn.ticket_id == Ticket.id)
            .join(Registration, Ticket.registration_id == Registration.id)
            .where(Registration.event_id == event.id)
        )
        or 0
    )
    if checked_in > registered:
        logger.warning(
            "Event %s has more check-ins (%s) than active registrations (%s)",
            event.id,
            checked_in,
            registered,
        )

    feedback_total, average_rating = db.execute(
        select(func.count(Feedback.id), func.avg(Feedback.rating)).where(
            Feedback.event_id == event.id
        )
    ).one()
    distribution_rows = db.execute(
        select(Feedback.rating, func.count(Feedback.id))
        .where(Feedback.event_id == event.id)
        .group_by(Feedback.rating)
    ).all()
    rating_distribution = {str(rating): 0 for rating in range(1, 6)}
    for rating, count in distribution_rows:
        if 1 <= rating <= 5:
            rating_distribution[str(rating)] = int(count)

    max_attendees = event.max_attendees
    return EventStatisticsResponse(
        event_id=event.id,
        event_title=event.title,
        capacity={
            "max_attendees": max_attendees,
            "registered": registered,
            "available": max(max_attendees - registered, 0),
            "usage_rate": _percentage(registered, max_attendees),
        },
        registrations={
            "total": total_registrations,
            "registered": registered,
            "cancelled": cancelled,
        },
        attendance={
            "checked_in": checked_in,
            "not_checked_in": max(registered - checked_in, 0),
            "attendance_rate": _percentage(checked_in, registered),
        },
        feedback={
            "total": int(feedback_total),
            "average_rating": (
                round(float(average_rating), 2) if average_rating is not None else None
            ),
            "rating_distribution": rating_distribution,
        },
    )
