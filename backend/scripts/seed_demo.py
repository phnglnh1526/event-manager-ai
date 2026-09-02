import os
from datetime import datetime

from sqlalchemy import select

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models import Announcement, CheckIn, Event, Feedback, Registration, Schedule, Speaker, Ticket, User
from app.services.tickets import create_ticket_with_retry

EVENT_TITLE = "EVENT MANAGER AI — Demo Conference 2026"


def run():
    password = os.getenv("DEMO_PASSWORD", "")
    if len(password) < 8:
        raise SystemExit("Set DEMO_PASSWORD to at least 8 characters.")
    db = SessionLocal()
    try:
        users = {}
        for key, role, name in [
            ("admin", "ADMIN", "Demo Administrator"),
            ("staff", "STAFF", "Demo Check-in Staff"),
            *[(f"attendee{index}", "ATTENDEE", f"Demo Attendee {index}") for index in range(1, 9)],
        ]:
            email = f"{key}@event-demo.local"
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(full_name=name, email=email, password_hash=hash_password(password), role=role, is_active=True)
                db.add(user); db.flush()
            else:
                user.password_hash = hash_password(password)
                user.is_active = True
            users[key] = user
        existing = db.scalar(select(Event).where(Event.title == EVENT_TITLE))
        if existing:
            db.commit()
            print(f"DEMO_DATA_READY event_id={existing.id} credentials_refreshed=true")
            return
        event = Event(title=EVENT_TITLE, description="A complete, real-data walkthrough for classroom presentation.", location="ICTU - Main Hall", start_time=datetime(2026, 10, 10, 8), end_time=datetime(2026, 10, 10, 17), status="PUBLISHED", max_attendees=100, owner_id=users["admin"].id)
        db.add(event); db.flush()
        speakers = [
            Speaker(event_id=event.id, full_name="Nguyễn Minh Anh", title="AI Researcher", organization="ICTU AI Lab", email="minhanh@event-demo.local"),
            Speaker(event_id=event.id, full_name="Trần Hoàng Nam", title="Senior Software Engineer", organization="TechVision", email="hoangnam@event-demo.local"),
        ]
        db.add_all(speakers); db.flush()
        db.add_all([
            Schedule(event_id=event.id, speaker_id=speakers[0].id, title="Opening Session", start_time=datetime(2026, 10, 10, 8), end_time=datetime(2026, 10, 10, 8, 30), location="Main Stage"),
            Schedule(event_id=event.id, speaker_id=speakers[0].id, title="AI Fundamentals", start_time=datetime(2026, 10, 10, 8, 30), end_time=datetime(2026, 10, 10, 9, 30), location="Main Stage"),
            Schedule(event_id=event.id, speaker_id=speakers[1].id, title="AI in Software Development", start_time=datetime(2026, 10, 10, 9, 45), end_time=datetime(2026, 10, 10, 10, 45), location="Room A"),
        ])
        tickets = []
        for index in range(1, 9):
            status = "CANCELLED" if index == 8 else "REGISTERED"
            registration = Registration(event_id=event.id, user_id=users[f"attendee{index}"].id, status=status)
            db.add(registration); db.flush()
            ticket = create_ticket_with_retry(db, registration.id, "VOID" if index == 8 else "ACTIVE")
            tickets.append(ticket)
        db.flush()
        for index in range(6):
            db.add(CheckIn(ticket_id=tickets[index].id, checked_in_by_user_id=users["staff"].id))
        for index, rating in enumerate((5, 5, 4, 4, 3), start=1):
            db.add(Feedback(event_id=event.id, user_id=users[f"attendee{index}"].id, rating=rating, comment=f"Demo feedback {index}: clear sessions and useful event content."))
        db.add(Announcement(event_id=event.id, created_by_user_id=users["admin"].id, title="Welcome to the Demo Conference", content="Doors open at 07:30. Please have your ticket QR ready for check-in.", status="PUBLISHED", published_at=datetime.now()))
        db.commit()
        print(f"DEMO_DATA_READY event_id={event.id} admin=admin@event-demo.local staff=staff@event-demo.local attendee=attendee7@event-demo.local")
    except Exception:
        db.rollback(); raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
