import json
import time
import urllib.request
import urllib.error

PROD_URL = "https://event-manager-api-aeyc.onrender.com"

def run_prod_benchmark():
    print(f"=== BENCHMARKING PRODUCTION ENDPOINTS ON RENDER ({PROD_URL}) ===")
    
    # 1. Login to get token for Admin
    login_payload = json.dumps({"email": "admin@example.com", "password": "MAT_KHAU_MOI_CUA_TOI"}).encode("utf-8")
    req = urllib.request.Request(
        f"{PROD_URL}/api/auth/login",
        data=login_payload,
        headers={"Content-Type": "application/json", "User-Agent": "PerfAudit/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        login_res = json.loads(resp.read().decode("utf-8"))
        admin_token = login_res["access_token"]
        print("Admin login successful!")

    # 2. Get events to find a valid event_id
    req = urllib.request.Request(
        f"{PROD_URL}/api/events",
        headers={"Authorization": f"Bearer {admin_token}", "User-Agent": "PerfAudit/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        events = json.loads(resp.read().decode("utf-8"))
        event_id = events[0]["id"] if events else 1
        print(f"Using test event ID: {event_id}")

    # 3. Create Attendee token for attendee endpoints
    # Generate token using local secret matching production, or login as attendee if known
    # Note: On Render, attendee endpoints can be called by attendee. Let's see if attendee login works:
    attendee_token = admin_token # fallback, but let's check attendee
    try:
        att_req = urllib.request.Request(
            f"{PROD_URL}/api/auth/login",
            data=json.dumps({"email": "ngocnga@example.com", "password": "password123"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(att_req, timeout=10) as resp:
            attendee_token = json.loads(resp.read().decode("utf-8"))["access_token"]
            print("Attendee login successful!")
    except Exception:
        # Use admin token if attendee login fails
        pass

    # Endpoints to test
    endpoints = [
        ("POST", "/api/auth/login", login_payload, {"Content-Type": "application/json"}),
        ("GET", "/api/events", None, {"Authorization": f"Bearer {admin_token}"}),
        ("GET", "/api/attendee/events", None, {"Authorization": f"Bearer {attendee_token}"}),
        ("GET", f"/api/events/{event_id}", None, {"Authorization": f"Bearer {admin_token}"}),
        ("GET", f"/api/events/{event_id}/statistics", None, {"Authorization": f"Bearer {admin_token}"}),
        ("GET", f"/api/events/{event_id}/registrations", None, {"Authorization": f"Bearer {admin_token}"}),
        ("GET", f"/api/events/{event_id}/tickets", None, {"Authorization": f"Bearer {admin_token}"}),
        ("GET", f"/api/events/{event_id}/announcements", None, {"Authorization": f"Bearer {admin_token}"}),
    ]

    print("\nStarting 10 warm requests per endpoint...")
    print(f"{'ENDPOINT':<38} {'MIN':>7} {'P50':>7} {'AVG':>7} {'P95':>7} {'MAX':>7} {'X-PROC':>8} {'STATUS':>6}")
    print("=" * 95)

    report_data = []

    for method, path, body, headers in endpoints:
        url = f"{PROD_URL}{path}"
        
        # 1 warm-up request (discarded)
        try:
            r = urllib.request.Request(url, data=body, headers={"User-Agent": "PerfAudit/1.0", **headers})
            with urllib.request.urlopen(r, timeout=30) as resp:
                resp.read()
        except Exception as e:
            print(f"Warm-up failed for {path}: {e}")

        # 10 measured warm requests
        durations = []
        x_proc_times = []
        status_code = 200

        for _ in range(10):
            t0 = time.perf_counter()
            r = urllib.request.Request(url, data=body, headers={"User-Agent": "PerfAudit/1.0", **headers})
            try:
                with urllib.request.urlopen(r, timeout=30) as resp:
                    durations.append((time.perf_counter() - t0) * 1000)
                    status_code = resp.status
                    x_proc = resp.headers.get("X-Process-Time")
                    if x_proc:
                        x_proc_times.append(x_proc)
            except urllib.error.HTTPError as e:
                durations.append((time.perf_counter() - t0) * 1000)
                status_code = e.code

        s = sorted(durations)
        min_v = s[0]
        p50_v = s[len(s) // 2]
        avg_v = sum(s) / len(s)
        p95_v = s[int(len(s) * 0.95)]
        max_v = s[-1]
        x_proc_display = x_proc_times[0] if x_proc_times else "N/A"

        row = {
            "endpoint": f"{method} {path}",
            "min": min_v,
            "p50": p50_v,
            "avg": avg_v,
            "p95": p95_v,
            "max": max_v,
            "x_proc": x_proc_display,
            "status": status_code
        }
        report_data.append(row)
        print(f"{method + ' ' + path:<38} {min_v:>6.1f}m {p50_v:>6.1f}m {avg_v:>6.1f}m {p95_v:>6.1f}m {max_v:>6.1f}m {x_proc_display:>8} {status_code:>6}")

    return report_data

if __name__ == "__main__":
    run_prod_benchmark()
