import time
from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal
from app.main import app
from app.models import Announcement, Event, Registration, User


def bearer(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.email, user.role)
    return {"Authorization": f"Bearer {token}"}


def make_event(owner_id: int, title: str) -> Event:
    return Event(
        title=title,
        description=None,
        location="Announcement Test Hall",
        start_time=datetime(2031, 1, 1, 9),
        end_time=datetime(2031, 1, 1, 12),
        status="DRAFT",
        max_attendees=100,
        owner_id=owner_id,
    )


def run() -> None:
    suffix = uuid4().hex
    db = SessionLocal()
    users: list[User] = []
    events: list[Event] = []
    creator_to_delete: User | None = None
    try:
        for index, role in enumerate(
            ("ADMIN", "ORGANIZER", "ORGANIZER", "STAFF", "ATTENDEE", "ATTENDEE")
        ):
            user = User(
                full_name=f"Step18 {role} {index}",
                email=f"step18-{role.lower()}-{index}-{suffix}@example.com",
                password_hash=hash_password("TestPassword123!"),
                role=role,
                is_active=True,
            )
            db.add(user)
            users.append(user)
        creator_to_delete = User(
            full_name="Step18 Disposable Creator",
            email=f"step18-creator-{suffix}@example.com",
            password_hash=hash_password("TestPassword123!"),
            role="ADMIN",
            is_active=True,
        )
        db.add(creator_to_delete)
        db.flush()

        admin, organizer_a, organizer_b, staff, attendee, outsider = users
        event_a = make_event(organizer_a.id, "Step18 Event A")
        event_b = make_event(organizer_b.id, "Step18 Event B")
        cascade_event = make_event(organizer_a.id, "Step18 Cascade Event")
        events.extend((event_a, event_b, cascade_event))
        db.add_all(events)
        db.flush()
        registration = Registration(
            event_id=event_a.id,
            user_id=attendee.id,
            status="REGISTERED",
        )
        db.add(registration)
        db.commit()
        for item in users + events + [creator_to_delete, registration]:
            db.refresh(item)

        client = TestClient(app)
        base_a = f"/api/events/{event_a.id}/announcements"
        base_b = f"/api/events/{event_b.id}/announcements"

        draft = client.post(
            base_a,
            headers=bearer(organizer_a),
            json={
                "title": "Thay đổi phòng tổ chức",
                "content": "Phiên buổi chiều sẽ chuyển sang phòng A301.",
            },
        )
        assert draft.status_code == 201, draft.text
        draft_body = draft.json()
        draft_id = draft_body["id"]
        assert draft_body["event_id"] == event_a.id
        assert draft_body["created_by_user_id"] == organizer_a.id
        assert draft_body["status"] == "DRAFT"
        assert draft_body["published_at"] is None

        direct = client.post(
            base_a,
            headers=bearer(creator_to_delete),
            json={"title": "Thông báo trực tiếp", "content": "Đã công bố.", "status": "PUBLISHED"},
        )
        assert direct.status_code == 201, direct.text
        direct_id = direct.json()["id"]
        assert direct.json()["published_at"] is not None

        assert client.get(base_a, headers=bearer(organizer_a)).status_code == 200
        assert client.get(f"{base_a}/{draft_id}", headers=bearer(organizer_a)).status_code == 200
        assert client.get(f"{base_b}/{draft_id}", headers=bearer(admin)).status_code == 404
        assert client.patch(f"{base_b}/{draft_id}", headers=bearer(admin), json={"title": "Cross event"}).status_code == 404
        assert client.delete(f"{base_b}/{draft_id}", headers=bearer(admin)).status_code == 404

        published = client.patch(
            f"{base_a}/{draft_id}", headers=bearer(organizer_a), json={"status": "PUBLISHED"}
        )
        assert published.status_code == 200, published.text
        first_published_at = published.json()["published_at"]
        assert first_published_at is not None
        edited = client.patch(
            f"{base_a}/{draft_id}", headers=bearer(organizer_a), json={"title": "Tiêu đề mới"}
        )
        assert edited.status_code == 200
        assert edited.json()["published_at"] == first_published_at

        my_list = client.get("/api/announcements/me", headers=bearer(attendee))
        assert my_list.status_code == 200
        assert {item["id"] for item in my_list.json()} == {draft_id, direct_id}
        assert client.get(f"/api/announcements/me/{draft_id}", headers=bearer(attendee)).status_code == 200
        assert client.get(f"/api/announcements/me/{draft_id}", headers=bearer(outsider)).status_code == 404

        unpublished = client.patch(
            f"{base_a}/{draft_id}", headers=bearer(admin), json={"status": "DRAFT"}
        )
        assert unpublished.status_code == 200
        assert unpublished.json()["published_at"] is None
        assert client.get(f"/api/announcements/me/{draft_id}", headers=bearer(attendee)).status_code == 404
        time.sleep(1.1)
        republished = client.patch(
            f"{base_a}/{draft_id}", headers=bearer(admin), json={"status": "PUBLISHED"}
        )
        assert republished.status_code == 200
        assert republished.json()["published_at"] != first_published_at

        validation_payloads = (
            {"title": " ", "content": "Valid content"},
            {"title": "Valid title", "content": " "},
            {"title": "Valid title", "content": "x" * 5001},
            {"title": "Valid title", "content": "Valid", "status": "SENT"},
            {"title": "Valid title", "content": "Valid", "event_id": 999},
            {"title": "Valid title", "content": "Valid", "created_by_user_id": 1},
            {"title": "Valid title", "content": "Valid", "published_at": "2030-01-01T00:00:00"},
        )
        for payload in validation_payloads:
            assert client.post(base_a, headers=bearer(admin), json=payload).status_code == 422
        assert client.patch(f"{base_a}/{draft_id}", headers=bearer(admin), json={"status": "ACTIVE"}).status_code == 422
        assert client.patch(f"{base_a}/{draft_id}", headers=bearer(admin), json={"title": None}).status_code == 422

        for restricted in (staff, attendee):
            assert client.post(base_a, headers=bearer(restricted), json={"title": "Valid title", "content": "Valid"}).status_code == 403
            assert client.get(base_a, headers=bearer(restricted)).status_code == 403
            assert client.patch(f"{base_a}/{draft_id}", headers=bearer(restricted), json={"title": "Valid title"}).status_code == 403
            assert client.delete(f"{base_a}/{draft_id}", headers=bearer(restricted)).status_code == 403
        for restricted in (admin, organizer_a, staff):
            assert client.get("/api/announcements/me", headers=bearer(restricted)).status_code == 403

        for method in ("get", "post"):
            response = getattr(client, method)(
                base_b,
                headers=bearer(organizer_a),
                **({"json": {"title": "Valid title", "content": "Valid"}} if method == "post" else {}),
            )
            assert response.status_code == 404
        assert client.get(f"{base_b}/{draft_id}", headers=bearer(organizer_a)).status_code == 404
        assert client.patch(f"{base_b}/{draft_id}", headers=bearer(organizer_a), json={"title": "Valid title"}).status_code == 404
        assert client.delete(f"{base_b}/{draft_id}", headers=bearer(organizer_a)).status_code == 404

        registration.status = "CANCELLED"
        db.commit()
        assert client.get("/api/announcements/me", headers=bearer(attendee)).json() == []
        assert client.get(f"/api/announcements/me/{direct_id}", headers=bearer(attendee)).status_code == 404
        registration.status = "REGISTERED"
        db.commit()
        assert {item["id"] for item in client.get("/api/announcements/me", headers=bearer(attendee)).json()} == {draft_id, direct_id}

        cascade_created = client.post(
            f"/api/events/{cascade_event.id}/announcements",
            headers=bearer(admin),
            json={"title": "Cascade test", "content": "Delete with event"},
        )
        assert cascade_created.status_code == 201
        cascade_id = cascade_created.json()["id"]
        assert client.delete(f"/api/events/{cascade_event.id}", headers=bearer(admin)).status_code == 204
        assert db.get(Announcement, cascade_id) is None
        events.remove(cascade_event)

        db.delete(creator_to_delete)
        db.commit()
        creator_to_delete = None
        db.expire_all()
        assert db.get(Announcement, direct_id).created_by_user_id is None

        assert client.delete(f"{base_a}/{draft_id}", headers=bearer(admin)).status_code == 204
        assert client.get(f"{base_a}/{draft_id}", headers=bearer(admin)).status_code == 404
        print("STEP18_TESTS_OK")
    finally:
        db.rollback()
        for event in events:
            persisted = db.get(Event, event.id) if event.id else None
            if persisted:
                db.delete(persisted)
        db.commit()
        if creator_to_delete is not None:
            persisted = db.get(User, creator_to_delete.id)
            if persisted:
                db.delete(persisted)
        for user in users:
            persisted = db.get(User, user.id) if user.id else None
            if persisted:
                db.delete(persisted)
        db.commit()
        db.close()


if __name__ == "__main__":
    run()
