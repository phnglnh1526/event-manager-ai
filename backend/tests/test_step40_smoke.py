from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal, engine
from app.main import app
from app.models import Event, Schedule, Speaker, User


def bearer(user: User) -> dict[str, str]:
    return {
        "Authorization": "Bearer "
        + create_access_token(user.id, user.email, user.role)
    }


def event(owner_id: int, title: str, event_status: str) -> Event:
    return Event(
        title=title,
        description="Thông tin dành riêng cho sự kiện kiểm thử.",
        location="ICTU - Tòa nhà A",
        start_time=datetime(2037, 9, 10, 7, 30),
        end_time=datetime(2037, 9, 10, 10, 0),
        status=event_status,
        max_attendees=250,
        owner_id=owner_id,
    )


def run() -> None:
    suffix = uuid4().hex
    db = SessionLocal()
    users: list[User] = []
    events: list[Event] = []
    try:
        for index, role in enumerate(
            ("ADMIN", "ORGANIZER", "ORGANIZER", "STAFF", "ATTENDEE")
        ):
            user = User(
                full_name=f"Step40 {role}",
                email=f"step40-{role.lower()}-{index}-{suffix}@example.com",
                password_hash=hash_password("Step40Password123!"),
                role=role,
                is_active=True,
            )
            db.add(user)
            users.append(user)
        db.flush()
        admin, organizer, other_organizer, staff, attendee = users

        published = event(organizer.id, "AI Technology Conference 2037", "PUBLISHED")
        draft = event(organizer.id, "Private Draft Event", "DRAFT")
        other = event(other_organizer.id, "Other Owner Event", "PUBLISHED")
        empty = event(organizer.id, "Empty Context Event", "PUBLISHED")
        db.add_all((published, draft, other, empty))
        events.extend((published, draft, other, empty))
        db.flush()

        speaker = Speaker(
            event_id=published.id,
            full_name="Nguyễn Minh Anh",
            title="AI Engineer",
            organization="ICTU AI Lab",
            bio="Chuyên gia trí tuệ nhân tạo.",
            email="private-speaker@example.com",
        )
        other_speaker = Speaker(
            event_id=other.id,
            full_name="Cross Event Secret Speaker",
            email="cross-event@example.com",
        )
        db.add_all((speaker, other_speaker))
        db.flush()
        db.add_all(
            (
                Schedule(
                    event_id=published.id,
                    speaker_id=speaker.id,
                    title="AI Foundations",
                    description="Tổng quan AI.",
                    start_time=datetime(2037, 9, 10, 8, 0),
                    end_time=datetime(2037, 9, 10, 9, 0),
                    location="Phòng A101",
                ),
                Schedule(
                    event_id=published.id,
                    speaker_id=None,
                    title="Open Discussion",
                    description=None,
                    start_time=datetime(2037, 9, 10, 9, 0),
                    end_time=datetime(2037, 9, 10, 9, 30),
                    location=None,
                ),
            )
        )
        db.commit()
        for item in users + events:
            db.refresh(item)

        client = TestClient(app)
        url = f"/api/events/{published.id}/ai/chat"
        headers = {
            "admin": bearer(admin),
            "organizer": bearer(organizer),
            "other": bearer(other_organizer),
            "staff": bearer(staff),
            "attendee": bearer(attendee),
        }

        assert client.post(url, json={"question": "Địa điểm sự kiện?"}).status_code == 401
        for role in ("admin", "organizer", "staff", "attendee"):
            response = client.post(
                url,
                headers=headers[role],
                json={"question": "Sự kiện bắt đầu lúc nào?"},
            )
            assert response.status_code == 200, (role, response.text)
            assert response.json()["source"] == "mock"
            assert response.json()["event_id"] == published.id
            assert "07:30" in response.json()["answer"]

        assert client.post(
            f"/api/events/{draft.id}/ai/chat",
            headers=headers["organizer"],
            json={"question": "Sự kiện ở đâu?"},
        ).status_code == 200
        assert client.post(
            f"/api/events/{other.id}/ai/chat",
            headers=headers["organizer"],
            json={"question": "Sự kiện ở đâu?"},
        ).status_code == 404
        for role in ("staff", "attendee"):
            assert client.post(
                f"/api/events/{draft.id}/ai/chat",
                headers=headers[role],
                json={"question": "Sự kiện ở đâu?"},
            ).status_code == 404
        assert client.post(
            f"/api/events/{draft.id}/ai/chat",
            headers=headers["admin"],
            json={"question": "Sự kiện ở đâu?"},
        ).status_code == 200

        cases = (
            ("Sự kiện được tổ chức ở đâu?", "ICTU - Tòa nhà A"),
            ("Địa điểm sự kiện?", "ICTU - Tòa nhà A"),
            ("Có những diễn giả nào?", "Nguyễn Minh Anh"),
            ("Diễn giả của sự kiện là ai?", "Nguyễn Minh Anh"),
            ("Lịch trình sự kiện gồm những gì?", "AI Foundations"),
            ("Sự kiện kết thúc lúc nào?", "10:00"),
            ("Sức chứa tối đa bao nhiêu?", "250"),
        )
        for question, expected in cases:
            response = client.post(
                url,
                headers=headers["admin"],
                json={"question": question},
            )
            assert response.status_code == 200, response.text
            assert expected in response.json()["answer"]
            assert "private-speaker@example.com" not in response.text
            assert "Cross Event Secret Speaker" not in response.text

        schedule_response = client.post(
            url,
            headers=headers["admin"],
            json={"question": "Lich trinh co nhung session nao?"},
        )
        assert schedule_response.status_code == 200
        assert "Open Discussion" in schedule_response.json()["answer"]
        assert "None" not in schedule_response.json()["answer"]

        unknown_body = {"question": "Giá vé máy bay hôm nay là bao nhiêu?"}
        unknown_a = client.post(url, headers=headers["admin"], json=unknown_body)
        unknown_b = client.post(url, headers=headers["admin"], json=unknown_body)
        assert unknown_a.status_code == 200
        assert unknown_a.json() == unknown_b.json()
        assert "chưa có đủ thông tin" in unknown_a.json()["answer"]

        for question, expected in (
            ("Có những diễn giả nào?", "chưa có thông tin diễn giả"),
            ("Lịch trình gồm những gì?", "chưa có thông tin lịch trình"),
        ):
            response = client.post(
                f"/api/events/{empty.id}/ai/chat",
                headers=headers["attendee"],
                json={"question": question},
            )
            assert response.status_code == 200
            assert expected in response.json()["answer"]

        invalid_bodies = (
            {},
            {"question": ""},
            {"question": "  "},
            {"question": "ab"},
            {"question": "x" * 501},
            {"question": "Valid question", "event_id": published.id},
            {"question": "Valid question", "user_id": admin.id},
            {"question": "Valid question", "role": "ADMIN"},
            {"question": "Valid question", "context": {}},
            {"question": "Valid question", "answer": "injected"},
            {"question": "Valid question", "source": "openai"},
        )
        for body in invalid_bodies:
            response = client.post(url, headers=headers["admin"], json=body)
            assert response.status_code == 422, (body, response.text)

        assert client.post(
            "/api/events/999999999/ai/chat",
            headers=headers["admin"],
            json={"question": "Sự kiện ở đâu?"},
        ).status_code == 404
        assert len(inspect(engine).get_table_names()) == 9
        assert db.scalar(select(func.count(Event.id)).where(Event.id.in_([item.id for item in events]))) == 4
        print("STEP40_TESTS_OK")
    finally:
        db.rollback()
        for item in reversed(events):
            persisted = db.get(Event, item.id) if item.id else None
            if persisted is not None:
                db.delete(persisted)
        db.commit()
        for item in reversed(users):
            persisted = db.get(User, item.id) if item.id else None
            if persisted is not None:
                db.delete(persisted)
        db.commit()
        db.close()


if __name__ == "__main__":
    run()
