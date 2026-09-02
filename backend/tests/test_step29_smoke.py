from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal
from app.main import app
from app.models import CheckIn, Event, Feedback, Registration, Ticket, User


def auth(user):
    return {"Authorization": "Bearer " + create_access_token(user.id, user.email, user.role)}


def run():
    suffix = uuid4().hex
    db = SessionLocal()
    owner = User(full_name="Step29 Owner", email=f"step29-owner-{suffix}@example.com", password_hash=hash_password("Password123!"), role="ORGANIZER", is_active=True)
    attendee = User(full_name="Step29 Attendee", email=f"step29-attendee-{suffix}@example.com", password_hash=hash_password("Password123!"), role="ATTENDEE", is_active=True)
    db.add_all([owner, attendee]); db.flush()
    events = [Event(title=f"Step29 {status} {index}", location="Hall", start_time=datetime(2035, 1, index + 1, 9), end_time=datetime(2035, 1, index + 1, 17), status=status, max_attendees=20, owner_id=owner.id) for index, status in enumerate(("PUBLISHED", "COMPLETED", "PUBLISHED", "CANCELLED"))]
    db.add_all(events); db.flush()
    registrations = [Registration(event_id=event.id, user_id=attendee.id, status="REGISTERED") for event in events]
    db.add_all(registrations); db.flush()
    tickets = [Ticket(registration_id=registration.id, ticket_code=f"STEP29-{suffix}-{index}", status="ACTIVE") for index, registration in enumerate(registrations)]
    db.add_all(tickets); db.flush()
    db.add_all([CheckIn(ticket_id=tickets[index].id, checked_in_by_user_id=owner.id) for index in (0, 1, 3)])
    db.commit()
    try:
        client = TestClient(app); headers = auth(attendee)
        response = client.get(f"/api/events/{events[0].id}/feedbacks/me", headers=headers)
        assert response.status_code == 404 and response.json()["detail"] == "Feedback not found"
        response = client.post(f"/api/events/{events[2].id}/feedbacks", headers=headers, json={"rating": 5, "comment": "no checkin"})
        assert response.status_code == 403 and response.json()["detail"] == "Feedback is only available after check-in"
        for event in events[:2]:
            response = client.post(f"/api/events/{event.id}/feedbacks", headers=headers, json={"rating": 5, "comment": "Excellent"})
            assert response.status_code == 201, response.text
        feedback_id = response.json()["id"]
        response = client.post(f"/api/events/{events[1].id}/feedbacks", headers=headers, json={"rating": 4, "comment": None})
        assert response.status_code == 409 and response.json()["detail"] == "Feedback already submitted"
        response = client.patch(f"/api/events/{events[1].id}/feedbacks/me", headers=headers, json={"rating": 4, "comment": "Updated"})
        assert response.status_code == 200 and response.json()["id"] == feedback_id and response.json()["rating"] == 4
        response = client.delete(f"/api/events/{events[1].id}/feedbacks/me", headers=headers)
        assert response.status_code == 204
        assert client.get(f"/api/events/{events[1].id}/feedbacks/me", headers=headers).status_code == 404
        assert client.post(f"/api/events/{events[1].id}/feedbacks", headers=headers, json={"rating": 3, "comment": None}).status_code == 201
        response = client.post(f"/api/events/{events[3].id}/feedbacks", headers=headers, json={"rating": 5, "comment": "invalid status"})
        assert response.status_code == 409
        for rating in (0, 6):
            assert client.post(f"/api/events/{events[2].id}/feedbacks", headers=headers, json={"rating": rating, "comment": None}).status_code == 422
        print("STEP 29 SMOKE PASS")
    finally:
        db.rollback()
        for event in events: db.query(Feedback).filter(Feedback.event_id == event.id).delete(synchronize_session=False)
        for event in events: db.delete(event)
        db.commit(); db.delete(attendee); db.delete(owner); db.commit(); db.close()


if __name__ == "__main__":
    run()
