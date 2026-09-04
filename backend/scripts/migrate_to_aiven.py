"""Audit and verification tool for Event Manager AI V2 Local to Aiven migration.

Runs inside the backend container or locally with Python.
Connects to local MySQL via SQLAlchemy and to Aiven MySQL via PyMySQL with SSL.
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend root to sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import pymysql
from sqlalchemy import inspect, text

from app.db.database import SessionLocal, engine

AIVEN_HOST = "event-manager-db-event-manager-db.b.aivencloud.com"
AIVEN_PORT = 19211
AIVEN_USER = "avnadmin"
AIVEN_DATABASE = "defaultdb"
CA_PATH = "/tmp/ca.pem" if os.path.exists("/tmp/ca.pem") else str(backend_root.parent / "ca.pem")

TABLES = [
    "users",
    "events",
    "speakers",
    "schedules",
    "registrations",
    "tickets",
    "checkins",
    "feedbacks",
    "announcements",
]


def get_aiven_connection(password: str):
    if not password:
        raise ValueError("Aiven MySQL password is required.")
    return pymysql.connect(
        host=AIVEN_HOST,
        port=AIVEN_PORT,
        user=AIVEN_USER,
        password=password,
        database=AIVEN_DATABASE,
        ssl={"ca": CA_PATH},
        cursorclass=pymysql.cursors.DictCursor,
    )


def audit_local() -> dict:
    db = SessionLocal()
    try:
        insp = inspect(engine)
        tables = sorted(insp.get_table_names())
        counts = {t: db.scalar(text(f"SELECT COUNT(*) FROM `{t}`")) for t in tables if t in TABLES}
        total = sum(counts.values())

        diemly = db.execute(
            text(
                "SELECT id, email, full_name, role, is_active FROM users "
                "WHERE email LIKE '%diemly206%' OR full_name LIKE '%diemly206%'"
            )
        ).fetchone()

        admins = db.execute(
            text("SELECT id, email, full_name, role FROM users WHERE role = 'ADMIN'")
        ).fetchall()

        return {
            "tables": tables,
            "counts": counts,
            "total_records": total,
            "diemly_exists": diemly is not None,
            "diemly_user": (
                {
                    "id": diemly[0],
                    "email": diemly[1],
                    "full_name": diemly[2],
                    "role": diemly[3],
                    "is_active": bool(diemly[4]),
                }
                if diemly
                else None
            ),
            "admin_count": len(admins),
            "admins": [(a[0], a[1], a[2], a[3]) for a in admins],
        }
    finally:
        db.close()


def audit_aiven(password: str) -> dict:
    conn = get_aiven_connection(password)
    try:
        with conn.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = sorted(
                row[f"Tables_in_{AIVEN_DATABASE}"] for row in cursor.fetchall()
            )

            counts = {}
            for t in TABLES:
                if t in tables:
                    cursor.execute(f"SELECT COUNT(*) as c FROM `{t}`")
                    counts[t] = cursor.fetchone()["c"]
                else:
                    counts[t] = 0

            cursor.execute(
                "SELECT id, email, full_name, role, is_active FROM users WHERE email LIKE '%diemly206%'"
            )
            diemly = cursor.fetchone()

            cursor.execute(
                "SELECT id, email, full_name, role FROM users WHERE role = 'ADMIN'"
            )
            admins = cursor.fetchall()

            return {
                "tables": tables,
                "counts": counts,
                "total_records": sum(counts.values()),
                "diemly_exists": diemly is not None,
                "diemly_user": diemly,
                "admin_count": len(admins),
                "admins": [(a["id"], a["email"], a["full_name"], a["role"]) for a in admins],
            }
    finally:
        conn.close()


def verify_integrity(password: str) -> dict:
    conn = get_aiven_connection(password)
    try:
        with conn.cursor() as cursor:
            integrity_queries = {
                "orphan_event_owner": "SELECT COUNT(*) as c FROM events e LEFT JOIN users u ON u.id = e.owner_id WHERE u.id IS NULL",
                "orphan_speaker": "SELECT COUNT(*) as c FROM speakers s LEFT JOIN events e ON e.id = s.event_id WHERE e.id IS NULL",
                "orphan_schedule_event": "SELECT COUNT(*) as c FROM schedules s LEFT JOIN events e ON e.id = s.event_id WHERE e.id IS NULL",
                "orphan_schedule_speaker": "SELECT COUNT(*) as c FROM schedules s LEFT JOIN speakers p ON p.id = s.speaker_id WHERE s.speaker_id IS NOT NULL AND p.id IS NULL",
                "orphan_registration_user": "SELECT COUNT(*) as c FROM registrations r LEFT JOIN users u ON u.id = r.user_id WHERE u.id IS NULL",
                "orphan_registration_event": "SELECT COUNT(*) as c FROM registrations r LEFT JOIN events e ON e.id = r.event_id WHERE e.id IS NULL",
                "orphan_ticket": "SELECT COUNT(*) as c FROM tickets t LEFT JOIN registrations r ON r.id = t.registration_id WHERE r.id IS NULL",
                "orphan_checkin_ticket": "SELECT COUNT(*) as c FROM checkins c LEFT JOIN tickets t ON t.id = c.ticket_id WHERE t.id IS NULL",
                "orphan_feedback_user": "SELECT COUNT(*) as c FROM feedbacks f LEFT JOIN users u ON u.id = f.user_id WHERE u.id IS NULL",
                "orphan_feedback_event": "SELECT COUNT(*) as c FROM feedbacks f LEFT JOIN events e ON e.id = f.event_id WHERE e.id IS NULL",
                "orphan_announcement": "SELECT COUNT(*) as c FROM announcements a LEFT JOIN events e ON e.id = a.event_id WHERE e.id IS NULL",
            }
            fk_violations = {}
            for name, query in integrity_queries.items():
                cursor.execute(query)
                res = cursor.fetchone()["c"]
                if res > 0:
                    fk_violations[name] = res

            ai_status = {}
            for t in TABLES:
                cursor.execute(
                    "SELECT AUTO_INCREMENT FROM information_schema.tables "
                    f"WHERE table_schema = '{AIVEN_DATABASE}' AND table_name = '{t}'"
                )
                row = cursor.fetchone()
                ai_val = row["AUTO_INCREMENT"] if row and row["AUTO_INCREMENT"] is not None else 1
                cursor.execute(f"SELECT MAX(id) as m FROM `{t}`")
                max_id = cursor.fetchone()["m"] or 0
                ai_status[t] = {
                    "auto_increment": ai_val,
                    "max_id": max_id,
                    "valid": ai_val > max_id if max_id > 0 else True,
                }

            return {
                "fk_passed": len(fk_violations) == 0,
                "fk_violations": fk_violations,
                "ai_passed": all(s["valid"] for s in ai_status.values()),
                "ai_status": ai_status,
            }
    finally:
        conn.close()


def print_comparison(local_data: dict, aiven_data: dict):
    print("\n--------------------------------------------------")
    print(f"{'Table':<18} {'Local':<12} {'Aiven':<12} {'Match':<8}")
    print("-" * 50)
    all_matched = True
    for t in TABLES:
        l_cnt = local_data["counts"].get(t, 0)
        a_cnt = aiven_data["counts"].get(t, 0)
        matched = l_cnt == a_cnt
        if not matched:
            all_matched = False
        print(f"{t:<18} {l_cnt:<12} {a_cnt:<12} {'YES' if matched else 'NO'}")
    print("-" * 50)
    print(
        f"{'TOTAL':<18} {local_data['total_records']:<12} {aiven_data['total_records']:<12} {'YES' if all_matched else 'NO'}\n"
    )


def main():
    parser = argparse.ArgumentParser(description="Audit and verify Event Manager AI database")
    parser.add_argument("--audit", action="store_true", help="Audit local and Aiven databases")
    parser.add_argument("--verify", action="store_true", help="Verify integrity after migration")
    args = parser.parse_args()

    password = os.getenv("AIVEN_PASSWORD", "").strip()

    print("==================================================")
    print("LOCAL DATABASE AUDIT")
    print("==================================================")
    local_data = audit_local()
    print(f"Database: event_manager")
    print(f"Tables ({len(local_data['tables'])}): {', '.join(local_data['tables'])}")
    print(f"Total records: {local_data['total_records']}")
    print(f"diemly206 exists: {'YES' if local_data['diemly_exists'] else 'NO'}")
    if local_data["diemly_user"]:
        u = local_data["diemly_user"]
        print(f"  User ID: {u['id']}, Email: {u['email']}, Full Name: {u['full_name']}, Role: {u['role']}")
    print(f"Admin accounts ({local_data['admin_count']}): {', '.join(a[1] for a in local_data['admins'])}")

    if not password:
        print("\n[NOTE] Set environment variable AIVEN_PASSWORD to audit/verify Aiven production database.")
        return

    print("\n==================================================")
    print("AIVEN PRODUCTION AUDIT")
    print("==================================================")
    aiven_data = audit_aiven(password)
    print(f"Database: {AIVEN_DATABASE} on {AIVEN_HOST}")
    print(f"Tables ({len(aiven_data['tables'])}): {', '.join(aiven_data['tables'])}")
    print(f"Total records: {aiven_data['total_records']}")
    print(f"diemly206 exists: {'YES' if aiven_data['diemly_exists'] else 'NO'}")
    print(f"Admin accounts ({aiven_data['admin_count']}): {', '.join(a[1] for a in aiven_data['admins'])}")

    print_comparison(local_data, aiven_data)

    if args.verify:
        print("==================================================")
        print("INTEGRITY & FOREIGN KEY CHECKS (AIVEN)")
        print("==================================================")
        integ = verify_integrity(password)
        print(f"Foreign Key Integrity: {'PASS' if integ['fk_passed'] else 'FAIL'}")
        if not integ["fk_passed"]:
            print("  Violations:", integ["fk_violations"])
        print(f"Auto Increment Validity: {'PASS' if integ['ai_passed'] else 'FAIL'}")
        for t, s in integ["ai_status"].items():
            print(f"  {t:<15}: AUTO_INCREMENT={s['auto_increment']}, MAX(id)={s['max_id']}, Status={'OK' if s['valid'] else 'INVALID'}")


if __name__ == "__main__":
    main()
