from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal
from app.main import app
from app.models import CheckIn, Event, Registration, Ticket, User


def auth(user):
    return {"Authorization": "Bearer " + create_access_token(user.id, user.email, user.role)}


def run():
    suffix = uuid4().hex
    db = SessionLocal()
    owner = User(full_name="Step30 Owner", email=f"step30-owner-{suffix}@example.com", password_hash=hash_password("Password123!"), role="ORGANIZER", is_active=True)
    staff = User(full_name="Step30 Staff", email=f"step30-staff-{suffix}@example.com", password_hash=hash_password("Password123!"), role="STAFF", is_active=True)
    attendee = User(full_name="Step30 Attendee", email=f"step30-attendee-{suffix}@example.com", password_hash=hash_password("Password123!"), role="ATTENDEE", is_active=True)
    db.add_all([owner, staff, attendee]); db.flush()
    events = [Event(title=f"Step30 Event {index}", location="Gate", start_time=datetime(2036, 1, index + 1, 9), end_time=datetime(2036, 1, index + 1, 17), status="PUBLISHED", max_attendees=20, owner_id=owner.id) for index in range(2)]
    db.add_all(events); db.flush()
    registrations = [Registration(event_id=events[index].id, user_id=attendee.id, status="REGISTERED") for index in range(2)]
    db.add_all(registrations); db.flush()
    active = Ticket(registration_id=registrations[0].id, ticket_code=f"EVT_{suffix}_ACTIVE", status="ACTIVE")
    void = Ticket(registration_id=registrations[1].id, ticket_code=f"EVT_{suffix}_VOID", status="VOID")
    db.add_all([active, void]); db.commit()
    try:
        client = TestClient(app); staff_headers = auth(staff)
        response = client.post(f"/api/events/{events[0].id}/checkins", headers=staff_headers, json={"ticket_code": f"  {active.ticket_code}  "})
        assert response.status_code == 201, response.text
        assert response.json()["checked_in_by_user_id"] == staff.id
        active_id = response.json()["ticket_id"]
        registration_id = registrations[0].id
        db.rollback(); db.expire_all()
        assert db.query(CheckIn).filter(CheckIn.ticket_id == active_id).count() == 1
        assert db.get(Ticket, active_id).status == "ACTIVE"
        assert db.get(Registration, registration_id).status == "REGISTERED"
        response = client.post(f"/api/events/{events[0].id}/checkins", headers=staff_headers, json={"ticket_code": active.ticket_code})
        assert response.status_code == 409 and response.json()["detail"] == "Ticket already checked in"
        db.rollback()
        assert db.query(CheckIn).filter(CheckIn.ticket_id == active_id).count() == 1
        response = client.post(f"/api/events/{events[1].id}/checkins", headers=staff_headers, json={"ticket_code": active.ticket_code})
        assert response.status_code == 404 and response.json()["detail"] == "Ticket not found"
        response = client.post(f"/api/events/{events[1].id}/checkins", headers=staff_headers, json={"ticket_code": void.ticket_code})
        assert response.status_code == 409 and response.json()["detail"] == "Ticket is not active"
        assert client.post(f"/api/events/{events[0].id}/checkins", json={"ticket_code": "unknown"}).status_code == 401
        assert client.post(f"/api/events/{events[0].id}/checkins", headers=auth(attendee), json={"ticket_code": "unknown"}).status_code == 403
        assert client.post(f"/api/events/{events[0].id}/checkins", headers=staff_headers, json={"ticket_code": "   "}).status_code == 422
        print("STEP30_TESTS_OK")
    finally:
        db.rollback()
        for event in events: db.delete(event)
        db.commit()
        for user in (attendee, staff, owner): db.delete(user)
        db.commit(); db.close()


if __name__ == "__main__":
    run()
