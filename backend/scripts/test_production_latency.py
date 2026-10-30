import time
import urllib.request
import urllib.error
import ssl

def test_production_render():
    prod_url = "https://event-manager-api-aeyc.onrender.com"
    health_endpoint = f"{prod_url}/api/health"
    db_health_endpoint = f"{prod_url}/api/health/database"
    events_endpoint = f"{prod_url}/api/events"

    ctx = ssl.create_default_context()

    print(f"=== TESTING PRODUCTION RENDER URL: {prod_url} ===")
    
    # 1. Initial Request (Cold Start vs Warm probe)
    print("\n--- Request 1 (Testing for Cold Start or Live status) ---")
    t0 = time.perf_counter()
    try:
        req = urllib.request.Request(health_endpoint, headers={"User-Agent": "PerfAudit/1.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            total_ms = (time.perf_counter() - t0) * 1000
            status = resp.status
            x_proc = resp.headers.get("X-Process-Time", "N/A")
            print(f"Request 1 -> Status: {status}, Total HTTP Time: {total_ms:.2f}ms, X-Process-Time: {x_proc}")
            is_cold = total_ms > 5000
            print(f"Cold Start Detected? {'YES (Render spun up from sleep)' if is_cold else 'NO (Instance was already warm)'}")
    except Exception as e:
        print(f"Request 1 Failed: {e}")
        return

    # 2. Sequential Warm Requests on /api/health
    print("\n--- 5 Sequential Requests on /api/health ---")
    health_times = []
    for i in range(5):
        t0 = time.perf_counter()
        req = urllib.request.Request(health_endpoint, headers={"User-Agent": "PerfAudit/1.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            total_ms = (time.perf_counter() - t0) * 1000
            x_proc = resp.headers.get("X-Process-Time", "N/A")
            health_times.append((total_ms, x_proc))
            print(f"Run {i+1}: Total = {total_ms:.2f}ms, X-Process-Time = {x_proc}")

    # 3. 5 Sequential Requests on /api/health/database
    print("\n--- 5 Sequential Requests on /api/health/database ---")
    db_times = []
    for i in range(5):
        t0 = time.perf_counter()
        req = urllib.request.Request(db_health_endpoint, headers={"User-Agent": "PerfAudit/1.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            total_ms = (time.perf_counter() - t0) * 1000
            x_proc = resp.headers.get("X-Process-Time", "N/A")
            db_times.append((total_ms, x_proc))
            print(f"Run {i+1}: Total = {total_ms:.2f}ms, X-Process-Time = {x_proc}")

    # Summary
    avg_total_health = sum(t[0] for t in health_times) / len(health_times)
    avg_total_db = sum(t[0] for t in db_times) / len(db_times)
    print("\n--- SUMMARY OF PRODUCTION HTTP MEASUREMENTS ---")
    print(f"/api/health:          Avg Total HTTP = {avg_total_health:.2f}ms")
    print(f"/api/health/database: Avg Total HTTP = {avg_total_db:.2f}ms")

if __name__ == "__main__":
    test_production_render()
