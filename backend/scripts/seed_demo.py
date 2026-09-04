"""Create the complete, idempotent Event Manager AI demo dataset.

Run manually via CLI:
  DEMO_PASSWORD="your-password" python -m scripts.seed_demo
or
  DEMO_PASSWORD="your-password" python scripts/seed_demo.py
"""

import os
import sys
from pathlib import Path

# Ensure backend root is in sys.path when run directly
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.db.seed import run_seed


def run():
    password = os.getenv("DEMO_PASSWORD", "").strip()
    if len(password) < 8 or len(password.encode("utf-8")) > 72:
        raise SystemExit("Set DEMO_PASSWORD to 8-72 UTF-8 bytes (local test value only).")

    result = run_seed(lambda role, email: password, refresh_demo_passwords=True)
    main_id = result["main_id"]
    counts = result["counts"]
    ratings = result["ratings"]
    average = result["average"]
    roles = result["roles"]
    rereg = result["rereg"]
    tickets = result["tickets"]
    after_tables = result["after_tables"]

    print("COMPLETE_DEMO_DATA_READY")
    print(f"TABLE_COUNT={len(after_tables)}")
    print(f"MAIN_EVENT_ID={main_id}")
    print(f"MAIN_COUNTS={counts}")
    print(f"RATING_DISTRIBUTION={dict(sorted(ratings.items()))}; AVERAGE={average:.1f}")
    print(f"DEMO_ROLE_COUNTS={dict(sorted(roles.items()))}")
    print(f"REREGISTRATION_PRESERVED registration_id={rereg[0]} ticket_id={rereg[1]}")
    print(f"DUPLICATE_CHECKIN_TEST attendee=attendee-01-demo@example.com ticket_code={tickets[1]['ticket_code']}")
    print(f"LIVE_DEMO_TICKET attendee=attendee-07-demo@example.com ticket_id={tickets[7]['id']} ticket_code={tickets[7]['ticket_code']}")
    print(f"VOID_TICKET_TEST attendee=attendee-08-demo@example.com ticket_id={tickets[8]['id']} ticket_code={tickets[8]['ticket_code']}")


if __name__ == "__main__":
    run()
