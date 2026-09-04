from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal
from app.main import app
from app.models import Event, Registration, Ticket, User


def bearer(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.email, user.role)
    return {"Authorization": f"Bearer {token}"}


def expect(response, status_code: int):
    assert response.status_code == status_code, (
        f"{response.request.method} {response.request.url}: "
        f"{response.status_code} {response.text}"
    )
    return response


def make_event(
    owner_id: int,
    title: str,
    event_status: str,
    capacity: int,
    *,
    ended: bool = False,
) -> Event:
    now = datetime.now()
    start_time = now - timedelta(days=2) if ended else now + timedelta(days=30)
    end_time = now - timedelta(days=1) if ended else now + timedelta(days=31)
    return Event(
        title=title,
        description="Step 55 registration hardening test event",
        location="Step 55 Hall",
        start_time=start_time,
        end_time=end_time,
        status=event_status,
        max_attendees=capacity,
        owner_id=owner_id,
    )


def run() -> None:
    suffix = uuid4().hex
    password_hash = hash_password(f"{uuid4().hex}!")
    db = SessionLocal()
    user_ids: list[int] = []
    event_ids: list[int] = []
    try:
        owner = User(
            full_name="Step55 Owner",
            email=f"step55-owner-{suffix}@example.com",
            password_hash=password_hash,
            role="ORGANIZER",
            is_active=True,
        )
        admin = User(
            full_name="Step55 Admin",
            email=f"step55-admin-{suffix}@example.com",
            password_hash=password_hash,
            role="ADMIN",
            is_active=True,
        )
        staff = User(
            full_name="Step55 Staff",
            email=f"step55-staff-{suffix}@example.com",
            password_hash=password_hash,
            role="STAFF",
            is_active=True,
        )
        attendees = [
            User(
                full_name=f"Step55 Attendee {index}",
                email=f"step55-attendee-{index}-{suffix}@example.com",
                password_hash=password_hash,
                role="ATTENDEE",
                is_active=True,
            )
            for index in range(5)
        ]
        users = [owner, admin, staff, *attendees]
        db.add_all(users)
        db.flush()

        valid_event = make_event(
            owner.id, "Step55 Valid Event", "PUBLISHED", 2
        )
        full_event = make_event(
            owner.id, "Step55 Full Event", "PUBLISHED", 1
        )
        draft_event = make_event(
            owner.id, "Step55 Draft Event", "DRAFT", 5
        )
        cancelled_event = make_event(
            owner.id, "Step55 Cancelled Event", "CANCELLED", 5
        )
        completed_event = make_event(
            owner.id, "Step55 Completed Event", "COMPLETED", 5
        )
        ended_event = make_event(
            owner.id,
            "Step55 Ended Published Event",
            "PUBLISHED",
            5,
            ended=True,
        )
        race_event = make_event(
            owner.id, "Step55 Last Seat Event", "PUBLISHED", 1
        )
        events = [
            valid_event,
            full_event,
            draft_event,
            cancelled_event,
            completed_event,
            ended_event,
            race_event,
        ]
        db.add_all(events)
        db.commit()
        user_ids = [user.id for user in users]
        event_ids = [event.id for event in events]

        headers = {
            "owner": bearer(owner),
            "admin": bearer(admin),
            "staff": bearer(staff),
            **{
                f"attendee_{index}": bearer(attendee)
                for index, attendee in enumerate(attendees)
            },
        }
        client = TestClient(app)

        # A valid attendee registration creates exactly one active Ticket.
        valid_url = f"/api/events/{valid_event.id}/registrations"
        created = expect(
            client.post(valid_url, headers=headers["attendee_0"]), 201
        ).json()
        assert created["status"] == "REGISTERED"
        db.rollback()
        registration = db.get(Registration, created["id"])
        ticket = db.scalar(
            select(Ticket).where(Ticket.registration_id == registration.id)
        )
        assert ticket is not None and ticket.status == "ACTIVE"

        # A second request is rejected without another Registration or Ticket.
        duplicate = expect(
            client.post(valid_url, headers=headers["attendee_0"]), 409
        )
        assert duplicate.json()["detail"] == "Already registered for this event"
        db.rollback()
        assert db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == valid_event.id,
                Registration.user_id == attendees[0].id,
            )
        ) == 1
        assert db.scalar(
            select(func.count(Ticket.id)).join(Registration).where(
                Registration.event_id == valid_event.id,
                Registration.user_id == attendees[0].id,
            )
        ) == 1

        # Cancellation and re-registration preserve both row identities.
        original_registration_id = registration.id
        original_ticket_id = ticket.id
        original_ticket_code = ticket.ticket_code
        expect(
            client.delete(
                f"/api/events/{valid_event.id}/registrations/me",
                headers=headers["attendee_0"],
            ),
            204,
        )
        db.rollback()
        assert db.get(Registration, original_registration_id).status == "CANCELLED"
        assert db.get(Ticket, original_ticket_id).status == "VOID"
        restored = expect(
            client.post(valid_url, headers=headers["attendee_0"]), 200
        ).json()
        assert restored["id"] == original_registration_id
        db.rollback()
        restored_ticket = db.get(Ticket, original_ticket_id)
        assert restored_ticket.status == "ACTIVE"
        assert restored_ticket.ticket_code == original_ticket_code
        assert db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == valid_event.id,
                Registration.user_id == attendees[0].id,
            )
        ) == 1

        # Capacity is enforced by the backend and rejected attempts create no row.
        full_url = f"/api/events/{full_event.id}/registrations"
        expect(client.post(full_url, headers=headers["attendee_0"]), 201)
        full = expect(
            client.post(full_url, headers=headers["attendee_1"]), 409
        )
        assert full.json()["detail"] == "Event is full"
        db.rollback()
        assert db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == full_event.id,
                Registration.status == "REGISTERED",
            )
        ) == full_event.max_attendees
        assert db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == full_event.id,
                Registration.user_id == attendees[1].id,
            )
        ) == 0

        # All non-open statuses and a stale PUBLISHED event are rejected.
        for invalid_event in (
            draft_event,
            cancelled_event,
            completed_event,
            ended_event,
        ):
            response = expect(
                client.post(
                    f"/api/events/{invalid_event.id}/registrations",
                    headers=headers["attendee_1"],
                ),
                409,
            )
            assert response.json()["detail"] == "Event is not open for registration"
        expect(
            client.post(
                "/api/events/999999999/registrations",
                headers=headers["attendee_1"],
            ),
            404,
        )
        db.rollback()
        assert db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id.in_(
                    [
                        draft_event.id,
                        cancelled_event.id,
                        completed_event.id,
                        ended_event.id,
                    ]
                )
            )
        ) == 0

        # Authentication and attendee-only RBAC are enforced server-side.
        assert client.post(valid_url).status_code == 401
        for role in ("owner", "admin", "staff"):
            assert client.post(valid_url, headers=headers[role]).status_code == 403

        # Concurrent contenders for the last seat serialize on the Event row.
        race_url = f"/api/events/{race_event.id}/registrations"
        barrier = Barrier(3)

        def race_register(attendee_headers: dict[str, str]):
            race_client = TestClient(app)
            try:
                barrier.wait(timeout=10)
                return race_client.post(race_url, headers=attendee_headers)
            finally:
                race_client.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(race_register, headers["attendee_2"]),
                executor.submit(race_register, headers["attendee_3"]),
            ]
            barrier.wait(timeout=10)
            race_responses = [future.result(timeout=20) for future in futures]

        assert sorted(response.status_code for response in race_responses) == [
            201,
            409,
        ]
        rejected = next(
            response for response in race_responses if response.status_code == 409
        )
        assert rejected.json()["detail"] == "Event is full"
        db.rollback()
        active_count = db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == race_event.id,
                Registration.status == "REGISTERED",
            )
        )
        assert active_count == 1
        assert active_count <= race_event.max_attendees
        assert db.scalar(
            select(func.count(Ticket.id)).join(Registration).where(
                Registration.event_id == race_event.id
            )
        ) == 1

        client.close()
        print("STEP55_REGISTRATION_TESTS_OK")
    finally:
        db.rollback()
        for event_id in reversed(event_ids):
            event = db.get(Event, event_id)
            if event is not None:
                db.delete(event)
        db.commit()
        for user_id in reversed(user_ids):
            user = db.get(User, user_id)
            if user is not None:
                db.delete(user)
        db.commit()
        db.close()


if __name__ == "__main__":
    run()
