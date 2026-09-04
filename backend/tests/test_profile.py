from datetime import datetime, timedelta
from time import perf_counter
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import event as sqlalchemy_event

from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import SessionLocal, engine
from app.main import app
from app.models import Announcement, CheckIn, Event, Feedback, Registration, Ticket, User


def bearer(user: User) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(user.id, user.email, user.role)}


def expect(response, code: int):
    assert response.status_code == code, f"{response.request.method} {response.request.url}: {response.status_code} {response.text}"
    return response


def run() -> None:
    suffix = uuid4().hex
    original_password = f"{suffix}!"
    roles = ("ADMIN", "ORGANIZER", "STAFF", "ATTENDEE")
    db = SessionLocal()
    users = [User(full_name=f"Profile {role}", email=f"profile-{role.lower()}-{suffix}@example.com", password_hash=hash_password(original_password), role=role, is_active=True) for role in roles]
    db.add_all(users); db.commit()
    for user in users: db.refresh(user)
    organizer = users[1]
    now = datetime.now().replace(microsecond=0)
    owned_event = Event(title="Profile ownership regression", location="Test", start_time=now + timedelta(days=1), end_time=now + timedelta(days=1, hours=2), status="DRAFT", max_attendees=10, owner_id=organizer.id)
    db.add(owned_event); db.commit(); db.refresh(owned_event)
    client = TestClient(app)
    try:
        domain_counts = {model.__name__: db.query(model).count() for model in (Event, Registration, Ticket, CheckIn, Feedback, Announcement)}
        original_ids = {user.role: user.id for user in users}
        original_status = {user.role: user.is_active for user in users}
        for index, user in enumerate(users):
            headers = bearer(user)
            profile = expect(client.get("/api/auth/me", headers=headers), 200).json()
            assert profile["id"] == user.id and profile["role"] == user.role and "password_hash" not in profile
            updated_email = f"updated-{user.role.lower()}-{suffix}@example.com"
            statements = []
            def record_query(*args): statements.append(args[2])
            if index == 0: sqlalchemy_event.listen(engine, "before_cursor_execute", record_query)
            started = perf_counter()
            rename_response = expect(client.patch("/api/auth/me", headers=headers, json={"full_name": f"Nguyễn Ngọc Ánh {index}"}), 200)
            patch_ms = (perf_counter() - started) * 1000
            if index == 0: sqlalchemy_event.remove(engine, "before_cursor_execute", record_query)
            renamed = rename_response.json()
            assert renamed["full_name"] == f"Nguyễn Ngọc Ánh {index}"
            updated = expect(client.patch("/api/auth/me", headers=headers, json={"email": updated_email}), 200).json()
            assert updated["id"] == original_ids[user.role] and updated["role"] == user.role and updated["is_active"] == original_status[user.role]
            assert updated["full_name"] == f"Nguyễn Ngọc Ánh {index}" and updated["email"] == updated_email
            # The old JWT remains valid because authorization reloads by sub from the DB.
            started = perf_counter()
            me_response = expect(client.get("/api/auth/me", headers=headers), 200)
            get_me_ms = (perf_counter() - started) * 1000
            assert me_response.json()["email"] == updated_email
            if index == 0: print(f"PROFILE_TIMING patch_ms={patch_ms:.2f} get_me_ms={get_me_ms:.2f} patch_bytes={len(rename_response.content)} patch_queries={len(statements)}")
            expect(client.patch("/api/auth/me", headers=headers, json={"full_name": updated["full_name"], "email": updated_email}), 200)
            expect(client.patch("/api/auth/me", headers=headers, json={"full_name": "Escalation", "email": updated_email, "role": "ADMIN"}), 422)
            expect(client.patch("/api/auth/me", headers=headers, json={"full_name": "Deactivate", "email": updated_email, "is_active": False}), 422)
            current = expect(client.get("/api/auth/me", headers=headers), 200).json()
            assert current["role"] == user.role and current["is_active"] is True

        db.rollback()
        for user in users: db.refresh(user)
        attendee = users[3]
        attendee_headers = bearer(attendee)
        expect(client.patch("/api/auth/me", headers=attendee_headers, json={"full_name": "Duplicate", "email": users[0].email}), 409)
        expect(client.patch("/api/auth/me", headers=attendee_headers, json={"full_name": "Invalid", "email": "not-email"}), 422)
        new_password = f"{suffix[::-1]}?"
        expect(client.post("/api/auth/change-password", headers=attendee_headers, json={"current_password": "wrong-password", "new_password": new_password}), 400)
        expect(client.post("/api/auth/change-password", headers=attendee_headers, json={"current_password": original_password, "new_password": original_password}), 409)
        expect(client.post("/api/auth/change-password", headers=attendee_headers, json={"current_password": original_password, "new_password": "short"}), 422)
        response = expect(client.post("/api/auth/change-password", headers=attendee_headers, json={"current_password": original_password, "new_password": new_password}), 200).json()
        assert response == {"message": "Password updated successfully"}
        expect(client.post("/api/auth/login", json={"email": attendee.email, "password": original_password}), 401)
        login = expect(client.post("/api/auth/login", json={"email": attendee.email, "password": new_password}), 200).json()
        assert login["user"]["id"] == attendee.id and "password" not in login["user"] and "password_hash" not in login["user"]

        db.rollback()
        persisted = db.get(User, attendee.id); db.refresh(persisted)
        assert persisted.password_hash != new_password and verify_password(new_password, persisted.password_hash)
        db.refresh(owned_event); assert owned_event.owner_id == organizer.id
        assert domain_counts == {model.__name__: db.query(model).count() for model in (Event, Registration, Ticket, CheckIn, Feedback, Announcement)}
        print("PROFILE_TESTS_OK")
    finally:
        db.rollback()
        event = db.get(Event, owned_event.id)
        if event is not None: db.delete(event); db.commit()
        for user in reversed(users):
            item = db.get(User, user.id)
            if item is not None: db.delete(item)
        db.commit(); db.close()


if __name__ == "__main__":
    run()
