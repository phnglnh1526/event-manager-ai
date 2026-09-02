import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.ticket_status import TICKET_STATUS_ACTIVE
from app.models.ticket import Ticket

TICKET_CODE_PREFIX = "EVT_"
TICKET_CODE_RETRY_LIMIT = 3


def generate_ticket_code() -> str:
    return f"{TICKET_CODE_PREFIX}{secrets.token_urlsafe(32)}"


def create_ticket_with_retry(
    db: Session,
    registration_id: int,
    ticket_status: str = TICKET_STATUS_ACTIVE,
) -> Ticket:
    for _ in range(TICKET_CODE_RETRY_LIMIT):
        ticket = Ticket(
            registration_id=registration_id,
            ticket_code=generate_ticket_code(),
            status=ticket_status,
        )
        try:
            with db.begin_nested():
                db.add(ticket)
                db.flush()
            return ticket
        except IntegrityError:
            continue

    raise RuntimeError("Could not generate a unique ticket code")
