"""Tests for Event Cover Image - Step EVENT-IMAGE-01.

Verifies:
1. Create Event without image
2. Create Event with cover_image_url
3. Read Event returns cover_image_url
4. Update Event name without cover_image_url preserves cover image
5. Update cover_image_url replaces image
6. Set cover_image_url=null removes image
7. Existing Event compatibility (cover_image_url: null, no crash)
8. Upload API RBAC (401 unauth, 403 attendee/staff, allowed for admin/organizer)
9. Upload API file validation (invalid MIME, spoofed magic bytes, size > 5MB)
10. Regression test on Event endpoints
"""

import io
from datetime import datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.roles import ROLE_ADMIN, ROLE_ATTENDEE, ROLE_ORGANIZER, ROLE_STAFF
from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal
from app.main import app
from app.models import Event, User

client = TestClient(app)


def bearer(user: User) -> dict[str, str]:
    token = create_access_token(user.id, user.email, user.role)
    return {"Authorization": f"Bearer {token}"}


def run_all_tests():
    db = SessionLocal()
    suffix = uuid4().hex[:8]
    created_users: list[User] = []
    created_events: list[Event] = []

    print("\n" + "=" * 60)
    print("STARTING EVENT-IMAGE-01 TEST SUITE")
    print("=" * 60)

    try:
        # Create test users
        admin_user = User(
            full_name=f"Admin Test {suffix}",
            email=f"admin-{suffix}@test.com",
            password_hash=hash_password("Pass123!"),
            role=ROLE_ADMIN,
            is_active=True,
        )
        organizer_user = User(
            full_name=f"Organizer Test {suffix}",
            email=f"organizer-{suffix}@test.com",
            password_hash=hash_password("Pass123!"),
            role=ROLE_ORGANIZER,
            is_active=True,
        )
        staff_user = User(
            full_name=f"Staff Test {suffix}",
            email=f"staff-{suffix}@test.com",
            password_hash=hash_password("Pass123!"),
            role=ROLE_STAFF,
            is_active=True,
        )
        attendee_user = User(
            full_name=f"Attendee Test {suffix}",
            email=f"attendee-{suffix}@test.com",
            password_hash=hash_password("Pass123!"),
            role=ROLE_ATTENDEE,
            is_active=True,
        )

        db.add_all([admin_user, organizer_user, staff_user, attendee_user])
        db.commit()
        for u in (admin_user, organizer_user, staff_user, attendee_user):
            db.refresh(u)
            created_users.append(u)

        admin_auth = bearer(admin_user)
        organizer_auth = bearer(organizer_user)
        staff_auth = bearer(staff_user)
        attendee_auth = bearer(attendee_user)

        now = datetime.utcnow()
        start_time = (now + timedelta(days=5)).isoformat()
        end_time = (now + timedelta(days=6)).isoformat()

        # TEST 1: Create Event without image
        print("TEST 1: Create Event without image...")
        payload_no_img = {
            "title": f"Event No Img {suffix}",
            "description": "Event created without image",
            "location": "Room 101",
            "start_time": start_time,
            "end_time": end_time,
            "status": "DRAFT",
            "max_attendees": 50,
        }
        resp1 = client.post("/api/events", json=payload_no_img, headers=organizer_auth)
        assert resp1.status_code == 201, f"Expected 201, got {resp1.status_code}: {resp1.text}"
        data1 = resp1.json()
        assert data1["cover_image_url"] is None, f"Expected null cover_image_url, got {data1['cover_image_url']}"
        event1_id = data1["id"]
        print("  -> PASS (status 201, cover_image_url: null)")

        # TEST 2: Create Event with cover_image_url
        print("TEST 2: Create Event with cover_image_url...")
        test_img_url = "https://res.cloudinary.com/demo/image/upload/v12345/test_cover.jpg"
        payload_with_img = {
            "title": f"Event With Img {suffix}",
            "description": "Event created with cover image",
            "cover_image_url": test_img_url,
            "location": "Main Hall",
            "start_time": start_time,
            "end_time": end_time,
            "status": "DRAFT",
            "max_attendees": 100,
        }
        resp2 = client.post("/api/events", json=payload_with_img, headers=organizer_auth)
        assert resp2.status_code == 201, f"Expected 201, got {resp2.status_code}: {resp2.text}"
        data2 = resp2.json()
        assert data2["cover_image_url"] == test_img_url, f"Expected {test_img_url}, got {data2['cover_image_url']}"
        event2_id = data2["id"]
        print(f"  -> PASS (status 201, cover_image_url: {test_img_url})")

        # TEST 3: Read Event returns cover_image_url
        print("TEST 3: Read Event...")
        resp3 = client.get(f"/api/events/{event2_id}", headers=organizer_auth)
        assert resp3.status_code == 200, f"Expected 200, got {resp3.status_code}"
        data3 = resp3.json()
        assert data3["cover_image_url"] == test_img_url, f"Expected {test_img_url}, got {data3['cover_image_url']}"
        print("  -> PASS (cover_image_url correctly returned in detail)")

        # TEST 4: Update Event name without sending cover_image_url
        print("TEST 4: Update Event name without sending cover_image_url...")
        resp4 = client.patch(
            f"/api/events/{event2_id}",
            json={"title": f"Event With Img Renamed {suffix}"},
            headers=organizer_auth,
        )
        assert resp4.status_code == 200, f"Expected 200, got {resp4.status_code}"
        data4 = resp4.json()
        assert data4["cover_image_url"] == test_img_url, f"Image was unexpectedly modified: {data4['cover_image_url']}"
        assert data4["title"] == f"Event With Img Renamed {suffix}"
        print("  -> PASS (cover image preserved when updating other fields)")

        # TEST 5: Update cover_image_url
        print("TEST 5: Update cover_image_url...")
        new_img_url = "https://res.cloudinary.com/demo/image/upload/v67890/new_cover.png"
        resp5 = client.patch(
            f"/api/events/{event2_id}",
            json={"cover_image_url": new_img_url},
            headers=organizer_auth,
        )
        assert resp5.status_code == 200, f"Expected 200, got {resp5.status_code}"
        data5 = resp5.json()
        assert data5["cover_image_url"] == new_img_url, f"Expected {new_img_url}, got {data5['cover_image_url']}"
        print(f"  -> PASS (cover image updated to {new_img_url})")

        # TEST 6: Set cover_image_url null
        print("TEST 6: Set cover_image_url null...")
        resp6 = client.patch(
            f"/api/events/{event2_id}",
            json={"cover_image_url": None},
            headers=organizer_auth,
        )
        assert resp6.status_code == 200, f"Expected 200, got {resp6.status_code}"
        data6 = resp6.json()
        assert data6["cover_image_url"] is None, f"Expected None, got {data6['cover_image_url']}"
        print("  -> PASS (cover image successfully removed/set to null)")

        # TEST 7: Old Event compatibility (existing event with null image returns null without crashing)
        print("TEST 7: Old Event compatibility...")
        # Get list of all events
        resp7 = client.get("/api/events", headers=admin_auth)
        assert resp7.status_code == 200, f"Expected 200, got {resp7.status_code}"
        events_list = resp7.json()
        assert len(events_list) > 0, "No events returned"
        for ev in events_list:
            assert "cover_image_url" in ev, f"cover_image_url missing from event {ev.get('id')}"
        print(f"  -> PASS (All {len(events_list)} events serializable, cover_image_url present in schema)")

        # TEST 8: Upload API Auth & RBAC
        print("TEST 8: Upload API Auth & RBAC...")
        dummy_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb"

        # 8a: Unauthenticated -> 401
        resp8a = client.post(
            "/api/uploads/event-image",
            files={"file": ("test.jpg", io.BytesIO(dummy_jpeg), "image/jpeg")},
        )
        assert resp8a.status_code == 401, f"Expected 401, got {resp8a.status_code}"

        # 8b: Attendee role -> 403 Forbidden
        resp8b = client.post(
            "/api/uploads/event-image",
            files={"file": ("test.jpg", io.BytesIO(dummy_jpeg), "image/jpeg")},
            headers=attendee_auth,
        )
        assert resp8b.status_code == 403, f"Expected 403, got {resp8b.status_code}"

        # 8c: Staff role -> 403 Forbidden
        resp8c = client.post(
            "/api/uploads/event-image",
            files={"file": ("test.jpg", io.BytesIO(dummy_jpeg), "image/jpeg")},
            headers=staff_auth,
        )
        assert resp8c.status_code == 403, f"Expected 403, got {resp8c.status_code}"

        # 8d: Organizer role with valid mock upload -> 201 Created
        with patch("cloudinary.uploader.upload") as mock_upload, \
             patch("app.services.image_service.is_cloudinary_configured", return_value=True):
            mock_upload.return_value = {
                "secure_url": "https://res.cloudinary.com/mock-cloud/image/upload/v1/event-manager-ai/events/sample.jpg",
                "public_id": "event-manager-ai/events/sample",
            }
            resp8d = client.post(
                "/api/uploads/event-image",
                files={"file": ("test.jpg", io.BytesIO(dummy_jpeg), "image/jpeg")},
                headers=organizer_auth,
            )
            assert resp8d.status_code == 201, f"Expected 201, got {resp8d.status_code}: {resp8d.text}"
            upload_data = resp8d.json()
            assert "url" in upload_data and upload_data["url"].startswith("https://res.cloudinary.com")
            assert upload_data.get("public_id") == "event-manager-ai/events/sample"

        print("  -> PASS (401 unauthenticated, 403 for attendee/staff, 201 for organizer with mock)")

        # TEST 9: Invalid image upload validation
        print("TEST 9: Invalid image upload validation...")
        # 9a: Bad MIME type (text/plain)
        resp9a = client.post(
            "/api/uploads/event-image",
            files={"file": ("test.txt", io.BytesIO(b"hello text file"), "text/plain")},
            headers=organizer_auth,
        )
        assert resp9a.status_code == 400, f"Expected 400 for text/plain, got {resp9a.status_code}"

        # 9b: Spoofed MIME type (claims image/jpeg, but body is plain text)
        resp9b = client.post(
            "/api/uploads/event-image",
            files={"file": ("fake.jpg", io.BytesIO(b"not a real jpeg file"), "image/jpeg")},
            headers=organizer_auth,
        )
        assert resp9b.status_code == 400, f"Expected 400 for spoofed JPEG, got {resp9b.status_code}"

        # 9c: File too large (> 5MB)
        huge_content = b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024 + 10)
        resp9c = client.post(
            "/api/uploads/event-image",
            files={"file": ("huge.jpg", io.BytesIO(huge_content), "image/jpeg")},
            headers=organizer_auth,
        )
        assert resp9c.status_code == 400, f"Expected 400 for file > 5MB, got {resp9c.status_code}"

        # 9d: Empty file
        resp9d = client.post(
            "/api/uploads/event-image",
            files={"file": ("empty.png", io.BytesIO(b""), "image/png")},
            headers=organizer_auth,
        )
        assert resp9d.status_code == 400, f"Expected 400 for empty file, got {resp9d.status_code}"

        print("  -> PASS (Empty file, invalid MIME, spoofed magic bytes, and >5MB all rejected with 400)")

        # TEST 10: Regression test on existing Event APIs
        print("TEST 10: Regression test on existing Event APIs...")
        # 10a: List events as admin
        resp_list_admin = client.get("/api/events", headers=admin_auth)
        assert resp_list_admin.status_code == 200
        # 10b: List events as organizer (scoped)
        resp_list_org = client.get("/api/events", headers=organizer_auth)
        assert resp_list_org.status_code == 200
        # 10c: Attendee published events
        resp_att_events = client.get("/api/attendee/events", headers=attendee_auth)
        assert resp_att_events.status_code == 200
        # 10d: Event delete
        resp_del = client.delete(f"/api/events/{event1_id}", headers=organizer_auth)
        assert resp_del.status_code == 204
        resp_del_2 = client.delete(f"/api/events/{event2_id}", headers=organizer_auth)
        assert resp_del_2.status_code == 204

        print("  -> PASS (Admin list, organizer list, attendee events, delete all working without regression)")

        print("=" * 60)
        print("ALL 10 TESTS PASSED SUCCESSFULLY!")
        print("=" * 60 + "\n")

    finally:
        # Clean up test records
        try:
            for u in created_users:
                db.delete(u)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


if __name__ == "__main__":
    run_all_tests()
