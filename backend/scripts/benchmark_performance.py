import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.models import User, Event

def run_benchmark():
    client = TestClient(app)
    db = SessionLocal()
    
    event = db.query(Event).first()
    if not event:
        print("No event found")
        return
    event_id = event.id
    
    # Event owner (or admin who has access to all events)
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
        ("GET", "/api/events", headers_admin),
        ("GET", f"/api/events/{event_id}", headers_admin),
        ("GET", f"/api/events/{event_id}/statistics", headers_owner),
        ("GET", f"/api/events/{event_id}/registrations", headers_owner),
        ("GET", f"/api/events/{event_id}/tickets", headers_admin),
        ("GET", f"/api/events/{event_id}/announcements", headers_att),
        ("GET", "/api/attendee/events", headers_att),
    ]

    print(f"{'METHOD':<6} {'ENDPOINT':<40} {'STATUS':<8} {'LATENCY (ms)':<15}")
    print("-" * 75)

    results = []
    for method, path, h in endpoints:
        # warm-up
        client.request(method, path, headers=h)
        
        # measure 3 runs
        latencies = []
        status_code = 200
        for _ in range(3):
            t0 = time.perf_counter()
            resp = client.request(method, path, headers=h)
            dt = (time.perf_counter() - t0) * 1000
            latencies.append(dt)
            status_code = resp.status_code
        
        avg_latency = sum(latencies) / len(latencies)
        results.append((method, path, status_code, avg_latency))
        print(f"{method:<6} {path:<40} {status_code:<8} {avg_latency:>10.2f} ms")

    db.close()

if __name__ == "__main__":
    run_benchmark()
