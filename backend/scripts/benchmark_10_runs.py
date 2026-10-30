import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.models import User, Event

def run_benchmark_10():
    client = TestClient(app)
    db = SessionLocal()

    event = db.query(Event).filter(Event.status == "PUBLISHED").first() or db.query(Event).first()
    event_id = event.id

    admin = db.query(User).filter(User.role == "ADMIN", User.is_active == True).first()
    owner = db.query(User).filter(User.id == event.owner_id).first()
    staff = db.query(User).filter(User.role == "STAFF", User.is_active == True).first()
    attendee = db.query(User).filter(User.role == "ATTENDEE", User.is_active == True).first()

    headers_admin = {"Authorization": f"Bearer {create_access_token(admin.id, admin.email, admin.role)}"} if admin else {}
    headers_owner = {"Authorization": f"Bearer {create_access_token(owner.id, owner.email, owner.role)}"} if owner else {}
    headers_staff = {"Authorization": f"Bearer {create_access_token(staff.id, staff.email, staff.role)}"} if staff else {}
    headers_att = {"Authorization": f"Bearer {create_access_token(attendee.id, attendee.email, attendee.role)}"} if attendee else {}

    endpoints = [
        ("GET", "/api/health", {}),
        ("GET", "/api/health/database", {}),
        ("POST", "/api/auth/login", None), # special handler for login
        ("GET", "/api/admin/users", headers_admin),
        ("GET", "/api/events", headers_admin),
        ("GET", f"/api/events/{event_id}", headers_admin),
        ("GET", f"/api/events/{event_id}/statistics", headers_owner),
        ("GET", f"/api/events/{event_id}/registrations", headers_owner),
        ("GET", f"/api/events/{event_id}/tickets", headers_admin),
        ("GET", f"/api/events/{event_id}/announcements", headers_owner),
        ("GET", "/api/checkin/events", headers_staff),
        ("GET", "/api/attendee/events", headers_att),
    ]

    print(f"{'ENDPOINT':<40} {'MIN':>8} {'P50':>8} {'AVG':>8} {'P95':>8} {'MAX':>8} {'STATUS':>8}")
    print("=" * 95)

    stats_table = []

    for method, path, headers in endpoints:
        # Warm-up (discarded)
        if path == "/api/auth/login":
            client.post("/api/auth/login", json={"email": "admin@example.com", "password": "MAT_KHAU_MOI_CUA_TOI"})
        else:
            client.request(method, path, headers=headers)

        # 10 measured runs
        durations = []
        status_code = 200
        for _ in range(10):
            t0 = time.perf_counter()
            if path == "/api/auth/login":
                resp = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "MAT_KHAU_MOI_CUA_TOI"})
            else:
                resp = client.request(method, path, headers=headers)
            dt = (time.perf_counter() - t0) * 1000
            durations.append(dt)
            status_code = resp.status_code

        s = sorted(durations)
        min_v = s[0]
        p50_v = s[len(s) // 2]
        avg_v = sum(s) / len(s)
        p95_v = s[int(len(s) * 0.95)]
        max_v = s[-1]

        stats_table.append({
            "endpoint": f"{method} {path}",
            "min": min_v,
            "p50": p50_v,
            "avg": avg_v,
            "p95": p95_v,
            "max": max_v,
            "status": status_code,
        })

        print(f"{method + ' ' + path:<40} {min_v:>7.2f}m {p50_v:>7.2f}m {avg_v:>7.2f}m {p95_v:>7.2f}m {max_v:>7.2f}m {status_code:>8}")

    db.close()
    return stats_table

if __name__ == "__main__":
    run_benchmark_10()
