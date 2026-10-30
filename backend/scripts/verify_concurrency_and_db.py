import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Barrier
from uuid import uuid4

from sqlalchemy import func, select, text
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal, engine
from app.main import app
from app.models import Event, Registration, User


def measure_database_latency(n_runs=10):
    print("=== MEASURING DATABASE LATENCY (Aiven MySQL) ===")
    
    # 1. Connection acquisition time
    conn_times = []
    for _ in range(n_runs):
        t0 = time.perf_counter()
        conn = engine.connect()
        conn_times.append((time.perf_counter() - t0) * 1000)
        conn.close()
    
    # 2. SELECT 1 query time (ping + minimal roundtrip)
    select_1_times = []
    with engine.connect() as conn:
        for _ in range(n_runs):
            t0 = time.perf_counter()
            conn.execute(text("SELECT 1")).scalar()
            select_1_times.append((time.perf_counter() - t0) * 1000)

    # 3. Core query: Event fetch
    db = SessionLocal()
    event = db.scalar(select(Event).limit(1))
    event_id = event.id if event else 1

    event_query_times = []
    for _ in range(n_runs):
        t0 = time.perf_counter()
        db.scalar(select(Event).where(Event.id == event_id))
        event_query_times.append((time.perf_counter() - t0) * 1000)

    # 4. Core query: Count registrations
    reg_count_times = []
    for _ in range(n_runs):
        t0 = time.perf_counter()
        db.scalar(select(func.count(Registration.id)).where(Registration.event_id == event_id))
        reg_count_times.append((time.perf_counter() - t0) * 1000)

    # 5. Core query: Group by status
    group_query_times = []
    for _ in range(n_runs):
        t0 = time.perf_counter()
        db.execute(select(Registration.status, func.count(Registration.id)).where(Registration.event_id == event_id).group_by(Registration.status)).all()
        group_query_times.append((time.perf_counter() - t0) * 1000)

    db.close()

    def stats(arr):
        s = sorted(arr)
        p50 = s[len(s) // 2]
        p95 = s[int(len(s) * 0.95)]
        return f"avg={sum(arr)/len(arr):.2f}ms, min={min(arr):.2f}ms, p50={p50:.2f}ms, p95={p95:.2f}ms, max={max(arr):.2f}ms"

    print(f"Pool Connection Acquisition ({n_runs} runs): {stats(conn_times)}")
    print(f"Query SELECT 1 ({n_runs} runs):              {stats(select_1_times)}")
    print(f"Query Event by ID ({n_runs} runs):           {stats(event_query_times)}")
    print(f"Query COUNT(Registration) ({n_runs} runs):    {stats(reg_count_times)}")
    print(f"Query GROUP BY status ({n_runs} runs):        {stats(group_query_times)}")
    print()


def run_concurrency_race_test(num_contenders=30):
    print(f"=== RUNNING CONCURRENCY RACE TEST ({num_contenders} CONTENDERS FOR 1 LAST SEAT) ===")
    db = SessionLocal()
    suffix = uuid4().hex[:8]
    created_users = []
    test_event = None

    try:
        # Create organizer
        organizer = User(
            full_name=f"Race Organizer {suffix}",
            email=f"org-{suffix}@example.com",
            password_hash=hash_password("Pass123!"),
            role="ORGANIZER",
            is_active=True,
        )
        db.add(organizer)
        db.flush()
        created_users.append(organizer)

        # Create event with exactly 1 available seat
        test_event = Event(
            title=f"Race Condition Test Event {suffix}",
            description="Testing concurrent registration serialized on parent Event row",
            location="Virtual Hall",
            start_time="2035-01-01 09:00:00",
            end_time="2035-01-01 18:00:00",
            status="PUBLISHED",
            max_attendees=1,
            owner_id=organizer.id,
        )
        db.add(test_event)
        db.flush()

        # Create N distinct attendee accounts
        attendees = []
        for i in range(num_contenders):
            att = User(
                full_name=f"Contender {i} {suffix}",
                email=f"contender-{i}-{suffix}@example.com",
                password_hash=hash_password("Pass123!"),
                role="ATTENDEE",
                is_active=True,
            )
            db.add(att)
            attendees.append(att)
            created_users.append(att)

        db.commit()
        db.refresh(test_event)

        event_id = test_event.id
        tokens = [create_access_token(a.id, a.email, a.role) for a in attendees]

        # Use Barrier to synchronize all worker threads to fire AT THE EXACT SAME INSTANT
        barrier = Barrier(num_contenders + 1)

        def worker_register(token):
            client = TestClient(app)
            try:
                headers = {"Authorization": f"Bearer {token}"}
                # Wait for all threads to align
                barrier.wait(timeout=15)
                # Fire request
                resp = client.post(f"/api/events/{event_id}/registrations", headers=headers)
                return resp.status_code, resp.json()
            finally:
                client.close()

        with ThreadPoolExecutor(max_workers=num_contenders) as executor:
            futures = [executor.submit(worker_register, tok) for tok in tokens]
            # Release all threads simultaneously
            barrier.wait(timeout=15)
            results = [f.result(timeout=30) for f in as_completed(futures)]

        status_codes = [r[0] for r in results]
        success_count = status_codes.count(201)
        conflict_count = status_codes.count(409)
        other_codes = [code for code in status_codes if code not in (201, 409)]

        print(f"Total Requests:      {len(status_codes)}")
        print(f"201 CREATED (Won):   {success_count}")
        print(f"409 CONFLICT (Full): {conflict_count}")
        print(f"Other Status Codes:  {other_codes}")

        # Verify DB directly with fresh transaction view
        db.commit()
        actual_reg_count = db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == event_id,
                Registration.status == "REGISTERED",
            )
        )
        print(f"Actual in DB:        {actual_reg_count} registrations")
        print(f"Max Attendees:       {test_event.max_attendees}")

        assert success_count == 1, f"Expected exactly 1 success, got {success_count}"
        assert conflict_count == num_contenders - 1, f"Expected {num_contenders - 1} rejections, got {conflict_count}"
        assert actual_reg_count == 1, f"DB has {actual_reg_count} registrations, expected 1"
        assert len(other_codes) == 0, f"Unexpected status codes: {other_codes}"

        print(">>> CONCURRENCY RACE CONDITION TEST: PASSED 100% <<<")
        return True

    except Exception as e:
        print(f">>> CONCURRENCY RACE CONDITION TEST: FAILED ({e}) <<<")
        import traceback
        traceback.print_exc()
        return False

    finally:
        # Clean up test data
        try:
            db.rollback()
            if test_event and test_event.id:
                # Delete tickets and registrations
                regs = db.scalars(select(Registration).where(Registration.event_id == test_event.id)).all()
                for r in regs:
                    db.delete(r)
                ev = db.get(Event, test_event.id)
                if ev:
                    db.delete(ev)
            for u in created_users:
                if u.id:
                    user_obj = db.get(User, u.id)
                    if user_obj:
                        db.delete(user_obj)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


if __name__ == "__main__":
    measure_database_latency(15)
    run_concurrency_race_test(30)
