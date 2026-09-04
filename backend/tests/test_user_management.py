from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import SessionLocal
from app.main import app
from app.models import Announcement, CheckIn, Event, Feedback, Registration, Ticket, User


def bearer(user: User) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(user.id, user.email, user.role)}


def expect(response, code: int):
    assert response.status_code == code, f"{response.request.method} {response.request.url}: {response.status_code} {response.text}"
    return response


def run() -> None:
    suffix = uuid4().hex
    password = f"{suffix}!"
    db = SessionLocal()
    admin = User(full_name="User Admin Test", email=f"user-admin-{suffix}@example.com", password_hash=hash_password(password), role="ADMIN", is_active=True)
    organizer = User(full_name="User Organizer Test", email=f"user-organizer-{suffix}@example.com", password_hash=hash_password(password), role="ORGANIZER", is_active=True)
    db.add_all((admin, organizer)); db.commit(); db.refresh(admin); db.refresh(organizer)
    created_ids = [admin.id, organizer.id]
    client = TestClient(app)
    admin_headers, organizer_headers = bearer(admin), bearer(organizer)
    try:
        public_email = f"public-{suffix}@example.com"
        public = expect(client.post("/api/auth/register", json={"full_name": "  Public Attendee  ", "email": public_email.upper(), "password": password}), 201).json()
        created_ids.append(public["id"])
        assert public["role"] == "ATTENDEE" and public["is_active"] is True and public["email"] == public_email
        assert "password" not in public and "password_hash" not in public
        db.rollback()
        persisted_public = db.get(User, public["id"]); db.refresh(persisted_public)
        assert persisted_public.password_hash != password and verify_password(password, persisted_public.password_hash)
        expect(client.post("/api/auth/register", json={"full_name": "Duplicate", "email": public_email, "password": password}), 409)
        injected_email = f"injected-{suffix}@example.com"
        expect(client.post("/api/auth/register", json={"full_name": "Injected", "email": injected_email, "password": password, "role": "ADMIN"}), 422)
        assert db.query(User).filter(User.email == injected_email).count() == 0
        expect(client.post("/api/auth/register", json={"full_name": "Invalid", "email": "not-email", "password": password}), 422)
        expect(client.post("/api/auth/register", json={"full_name": "Short", "email": f"short-{suffix}@example.com", "password": "short"}), 422)

        # Exact reported edit payload: labels stay in the UI while the API receives STAFF.
        domain_counts = {model.__name__: db.query(model).count() for model in (Event, Registration, Ticket, CheckIn, Feedback, Announcement)}
        reported_email = f"hoainam-{suffix}@example.com"
        reported_payload = {"full_name": "Lê Hoài Nam", "email": reported_email, "role": "STAFF", "is_active": True}
        reported_update = client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json=reported_payload)
        expect(reported_update, 200)
        reported_user = reported_update.json()
        assert {key: reported_user[key] for key in reported_payload} == reported_payload
        assert reported_user["id"] == public["id"] and "password_hash" not in reported_user
        db.rollback()
        persisted_reported = db.get(User, public["id"]); db.refresh(persisted_reported)
        assert (persisted_reported.full_name, persisted_reported.email, persisted_reported.role, persisted_reported.is_active) == ("Lê Hoài Nam", reported_email, "STAFF", True)
        assert db.query(User).filter(User.id == public["id"]).count() == 1
        assert domain_counts == {model.__name__: db.query(model).count() for model in (Event, Registration, Ticket, CheckIn, Feedback, Announcement)}
        expect(client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"email": reported_email}), 200)
        assert expect(client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"full_name": "Lê Hoài Nam Updated"}), 200).json()["full_name"] == "Lê Hoài Nam Updated"
        unique_update_email = f"hoainam-{suffix}@example.com"
        assert expect(client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"email": unique_update_email}), 200).json()["email"] == unique_update_email
        assert expect(client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"role": "ORGANIZER"}), 200).json()["role"] == "ORGANIZER"
        assert expect(client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"role": "ATTENDEE"}), 200).json()["role"] == "ATTENDEE"
        assert expect(client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"role": "STAFF"}), 200).json()["role"] == "STAFF"
        duplicate = client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"email": organizer.email})
        expect(duplicate, 409); assert duplicate.json()["detail"] == "Email already registered"
        expect(client.patch(f"/api/admin/users/{public['id']}", headers=admin_headers, json={"email": "not-email"}), 422)
        expect(client.patch(f"/api/admin/users/{public['id']}", headers=organizer_headers, json={"role": "ATTENDEE"}), 403)
        attendee_headers = bearer(db.get(User, public["id"]))
        expect(client.patch(f"/api/admin/users/{public['id']}", headers=attendee_headers, json={"role": "ATTENDEE"}), 403)

        expect(client.get("/api/admin/users"), 401)
        expect(client.get("/api/admin/users", headers=organizer_headers), 403)
        listed = expect(client.get("/api/admin/users", headers=admin_headers), 200).json()
        assert any(item["id"] == public["id"] for item in listed) and all("password_hash" not in item for item in listed)

        managed_email = f"managed-{suffix}@example.com"
        managed = expect(client.post("/api/admin/users", headers=admin_headers, json={"full_name": "Managed Staff", "email": managed_email, "password": password, "role": "STAFF", "is_active": True}), 201).json()
        created_ids.append(managed["id"])
        assert managed["role"] == "STAFF" and "password_hash" not in managed
        reset_password = f"{suffix[::-1]}?"
        expect(client.post(f"/api/admin/users/{managed['id']}/reset-password", json={"new_password": reset_password}), 401)
        expect(client.post(f"/api/admin/users/{managed['id']}/reset-password", headers=organizer_headers, json={"new_password": reset_password}), 403)
        expect(client.post(f"/api/admin/users/{managed['id']}/reset-password", headers=attendee_headers, json={"new_password": reset_password}), 403)
        expect(client.post(f"/api/admin/users/{managed['id']}/reset-password", headers=admin_headers, json={"new_password": "short"}), 422)
        reset_response = expect(client.post(f"/api/admin/users/{managed['id']}/reset-password", headers=admin_headers, json={"new_password": reset_password}), 200).json()
        assert reset_response == {"message": "Password updated successfully"}
        expect(client.post("/api/auth/login", json={"email": managed_email, "password": password}), 401)
        reset_login = expect(client.post("/api/auth/login", json={"email": managed_email, "password": reset_password}), 200).json()
        assert reset_login["user"]["id"] == managed["id"] and "password" not in reset_login["user"] and "password_hash" not in reset_login["user"]
        db.rollback()
        managed_db = db.get(User, managed["id"]); db.refresh(managed_db)
        assert managed_db.password_hash != reset_password and verify_password(reset_password, managed_db.password_hash)
        old_staff_token = bearer(managed_db)
        expect(client.get("/api/rbac/staff", headers=old_staff_token), 200)
        expect(client.patch(f"/api/admin/users/{public['id']}", headers=old_staff_token, json={"full_name": "Forbidden Staff Update"}), 403)
        expect(client.post(f"/api/admin/users/{public['id']}/reset-password", headers=old_staff_token, json={"new_password": reset_password}), 403)
        updated = expect(client.patch(f"/api/admin/users/{managed['id']}", headers=admin_headers, json={"full_name": "Managed Attendee", "role": "ATTENDEE"}), 200).json()
        assert updated["role"] == "ATTENDEE" and updated["full_name"] == "Managed Attendee"
        expect(client.get("/api/rbac/staff", headers=old_staff_token), 403)
        assert expect(client.get("/api/auth/me", headers=old_staff_token), 200).json()["role"] == "ATTENDEE"
        expect(client.patch(f"/api/admin/users/{managed['id']}", headers=admin_headers, json={"is_active": False}), 200)
        expect(client.get("/api/auth/me", headers=old_staff_token), 403)
        expect(client.patch(f"/api/admin/users/{managed['id']}", headers=admin_headers, json={"is_active": True, "role": "ORGANIZER"}), 200)
        assert expect(client.get("/api/auth/me", headers=old_staff_token), 200).json()["role"] == "ORGANIZER"
        expect(client.patch(f"/api/admin/users/{managed['id']}", headers=admin_headers, json={"role": "ATTENDEE"}), 200)

        expect(client.patch(f"/api/admin/users/{admin.id}", headers=admin_headers, json={"is_active": False}), 409)
        expect(client.patch(f"/api/admin/users/{admin.id}", headers=admin_headers, json={"role": "ATTENDEE"}), 409)
        self_reset_password = f"{suffix[::2]}!"
        expect(client.post(f"/api/admin/users/{admin.id}/reset-password", headers=admin_headers, json={"new_password": self_reset_password}), 200)
        expect(client.post("/api/auth/login", json={"email": admin.email, "password": password}), 401)
        expect(client.post("/api/auth/login", json={"email": admin.email, "password": self_reset_password}), 200)
        expect(client.post(f"/api/admin/users/{admin.id}/reset-password", headers=admin_headers, json={"new_password": password}), 200)
        expect(client.patch(f"/api/admin/users/{managed['id']}", headers=admin_headers, json={"role": "INVALID"}), 422)
        expect(client.patch("/api/admin/users/999999999", headers=admin_headers, json={"full_name": "Missing User"}), 404)
        print("USER_MANAGEMENT_TESTS_OK")
    finally:
        db.rollback()
        for user_id in reversed(created_ids):
            user = db.get(User, user_id)
            if user is not None:
                db.delete(user)
        db.commit(); db.close()


if __name__ == "__main__":
    run()
