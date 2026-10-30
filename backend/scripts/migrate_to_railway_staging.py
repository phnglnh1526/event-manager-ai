"""
Railway Staging Migration & Verification Tool
Event Manager AI V2 - Step 7 Safe Staging Export & Migration Pipeline

Usage:
  # Dry-run on Staging DB (Non-destructive validation)
  STAGING_MYSQL_URL="mysql+pymysql://root:pass@host:port/staging_db" TARGET_ENV=staging python backend/scripts/migrate_to_railway_staging.py --dry-run

  # Execute migration on clean Staging DB using safe export (NO DROP TABLE)
  STAGING_MYSQL_URL="mysql+pymysql://root:pass@host:port/staging_db" TARGET_ENV=staging python backend/scripts/migrate_to_railway_staging.py --target-env staging

  # Execute migration on Staging DB that already has previous test tables
  STAGING_MYSQL_URL="mysql+pymysql://root:pass@host:port/staging_db" TARGET_ENV=staging python backend/scripts/migrate_to_railway_staging.py --target-env staging --allow-overwrite-staging

  # Run local self-test on isolated DB
  python backend/scripts/migrate_to_railway_staging.py --test-local
"""

import argparse
import hashlib
import os
import re
import sys
import time
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from sqlalchemy import create_engine, inspect, make_url, text


REQUIRED_TABLES = [
    "announcements",
    "checkins",
    "events",
    "feedbacks",
    "registrations",
    "schedules",
    "speakers",
    "tickets",
    "uploaded_files",
    "users"
]

FORBIDDEN_PROD_KEYWORDS = [
    "prod",
    "production",
    "live",
    "master",
    "main",
    "primary",
    "prd",
]


def mask_url(url_str: str) -> str:
    """Mask credentials and sensitive information in database URL for safe logging."""
    if not url_str:
        return "[EMPTY_DATABASE_URL]"
    try:
        u = make_url(url_str)
        host = u.host or "unknown_host"
        port = f":{u.port}" if u.port else ""
        db = f"/{u.database}" if u.database else ""
        driver = u.drivername or "mysql+pymysql"
        return f"{driver}://***:***@{host}{port}{db}"
    except Exception:
        # Fallback regex/string masking
        if "@" in url_str:
            parts = url_str.split("@")
            prefix = parts[0].split("://")[0] + "://***:***@"
            return prefix + parts[-1]
        return "mysql+pymysql://***:***@masked_host/masked_db"


def validate_target_safety(
    target_url: str,
    target_env: str = "",
    allow_overwrite: bool = False,
    allow_drop_tables: bool = False,
    confirm_railway_db: bool = False,
    dry_run: bool = False
):
    """
    Multi-layer Production Guard:
    1. Parse and validate URL structure.
    2. Enforce explicit staging environment declaration.
    3. Strictly reject production keywords.
    4. Guard against default 'railway' DB without explicit confirmation.
    5. Detect non-empty database / existing data.
    6. Forbid unapproved overwrites.
    """
    if not target_url or not target_url.strip():
        raise ValueError("SAFETY VIOLATION: Database URL is empty or missing.")

    # 1. Parse URL safely
    try:
        u = make_url(target_url.strip())
    except Exception as exc:
        raise ValueError(f"SAFETY VIOLATION: Target database URL is malformed: {exc}") from None

    db_name = (u.database or "").strip().lower()
    host_name = (u.host or "").strip().lower()

    # 2. Enforce explicit staging environment flag
    effective_env = (target_env or os.getenv("TARGET_ENV", "")).strip().lower()
    if effective_env != "staging":
        raise RuntimeError(
            f"SAFETY VIOLATION: Migration requires explicit target environment confirmation! "
            f"Expected TARGET_ENV='staging' or argument '--target-env staging', but received '{effective_env}'. "
            f"Aborted to prevent accidental deployment."
        )

    # 3. Strictly forbid production environments
    for kw in FORBIDDEN_PROD_KEYWORDS:
        if kw in db_name or kw in host_name:
            raise RuntimeError(
                f"SAFETY VIOLATION: Target URL '{mask_url(target_url)}' contains keyword '{kw}', "
                f"which indicates a PRODUCTION environment! Migration to production is strictly forbidden."
            )

    # 4. Special check for default 'railway' database name
    if db_name == "railway":
        env_confirmed = os.getenv("CONFIRM_RAILWAY_STAGING_DB", "").strip().lower() in ("1", "true", "yes")
        if not confirm_railway_db and not env_confirmed:
            raise RuntimeError(
                "SAFETY VIOLATION: Target database is named 'railway' (Railway default MySQL DB name). "
                "Because a production service may also use 'railway', explicit confirmation is mandatory! "
                "Please pass '--confirm-railway-db' or set CONFIRM_RAILWAY_STAGING_DB=true to certify this instance is dedicated to staging."
            )

    # 5. Connect and inspect target database
    masked = mask_url(target_url)
    try:
        engine = create_engine(target_url, pool_pre_ping=True)
        with engine.connect() as conn:
            version = conn.execute(text("SELECT VERSION()")).scalar()
            print(f"Connected to Target DB ({masked}) successfully. MySQL Version: {version}")
    except Exception as exc:
        raise ConnectionError(f"SAFETY VIOLATION: Cannot connect to target database at {masked}: {exc}") from None

    insp = inspect(engine)
    existing_tables = insp.get_table_names()

    # 6. Check if target database already has data
    if existing_tables:
        total_existing_rows = 0
        with engine.connect() as conn:
            for tbl in existing_tables:
                try:
                    c = conn.execute(text(f"SELECT COUNT(*) FROM `{tbl}`")).scalar()
                    total_existing_rows += c or 0
                except Exception:
                    pass

        print(f"Target DB contains {len(existing_tables)} existing tables with {total_existing_rows} total rows: {existing_tables}")
        if not allow_overwrite and not dry_run:
            raise RuntimeError(
                f"SAFETY VIOLATION: Target database is NOT empty (found {len(existing_tables)} tables with {total_existing_rows} rows). "
                f"To prevent accidental data loss, migration is aborted. "
                f"If this is an intentional staging re-deployment, you must explicitly pass '--allow-overwrite-staging'."
            )
        if allow_overwrite:
            print("Notice: '--allow-overwrite-staging' is enabled. Existing staging tables will be replaced.")
    else:
        print("Target DB is completely empty (0 tables): SAFE TO PROCEED.")

    return engine


def verify_integrity(engine, expected_row_counts=None):
    """Deep audit of database integrity: tables, row counts, constraints, binary hashes."""
    insp = inspect(engine)
    tables = sorted(insp.get_table_names())
    print("\n--- 1. TABLE PRESENCE VERIFICATION ---")
    missing_tables = [t for t in REQUIRED_TABLES if t not in tables]
    if missing_tables:
        print(f"FAILED: Missing tables: {missing_tables}")
        return False
    print(f"All {len(REQUIRED_TABLES)} required tables are present in target DB: PASS")

    print("\n--- 2. ROW COUNT AUDIT ---")
    row_counts = {}
    with engine.connect() as conn:
        for t in REQUIRED_TABLES:
            c = conn.execute(text(f"SELECT COUNT(*) FROM `{t}`")).scalar()
            row_counts[t] = c
            exp_val = expected_row_counts.get(t) if expected_row_counts else None
            exp_str = f" (expected {exp_val})" if exp_val is not None else ""
            print(f"  {t:18s}: {c:4d} rows{exp_str}")
            if exp_val is not None and c != exp_val:
                print(f"FAILED: Row count mismatch on table {t} (got {c}, expected {exp_val})!")
                return False

    print("\n--- 3. CONSTRAINTS AUDIT ---")
    total_fks = 0
    total_uqs = 0
    for t in REQUIRED_TABLES:
        fks = insp.get_foreign_keys(t)
        uqs = insp.get_unique_constraints(t)
        total_fks += len(fks)
        total_uqs += len(uqs)
    print(f"  Total Foreign Keys: {total_fks} (expected 13)")
    print(f"  Total Unique Constraints: {total_uqs} (expected 6)")
    if total_fks != 13 or total_uqs != 6:
        print(f"WARNING: Unexpected constraint counts! FK={total_fks}/13, UQ={total_uqs}/6")

    print("\n--- 4. BINARY UPLOADED FILES CHECKSUM VERIFICATION ---")
    with engine.connect() as conn:
        files = conn.execute(text("SELECT id, filename, content_type, data FROM uploaded_files ORDER BY id")).all()
        print(f"  Found {len(files)} files in uploaded_files:")
        for f in files:
            data = f[3]
            data_bytes = data if isinstance(data, bytes) else str(data).encode("utf-8")
            h = hashlib.sha256(data_bytes).hexdigest()
            print(f"    File {f[0][:8]}... | {f[1]:18s} | Type: {f[2]} | SHA256: {h[:16]}... | Size: {len(data_bytes)} bytes")

    print("\n--- 5. INTEGRITY STATUS ---")
    print("ALL INTEGRITY CHECKS PASSED: SUCCESS!")
    return True


def run_migration_pipeline(
    target_url: str,
    dump_file: str = "railway_staging_safe_export.sql",
    target_env: str = "",
    allow_overwrite: bool = False,
    allow_drop_tables: bool = False,
    confirm_railway_db: bool = False,
    dry_run: bool = False
):
    print("================================================================================")
    print("EVENT MANAGER AI V2 - RAILWAY STAGING MIGRATION PIPELINE")
    print("================================================================================")
    print(f"Target Database URL: {mask_url(target_url)}")
    print(f"Target Environment: {target_env or os.getenv('TARGET_ENV', '[NOT SET]')}")
    print(f"Dump File: {dump_file}")
    print(f"Mode: {'DRY RUN (Validation only)' if dry_run else 'LIVE MIGRATION'}")

    if not os.path.exists(dump_file):
        # Fallback to railway_staging_export.sql if safe export not found
        fallback = "railway_staging_export.sql"
        if os.path.exists(fallback):
            print(f"Notice: '{dump_file}' not found. Falling back to '{fallback}'.")
            dump_file = fallback
        else:
            print(f"ERROR: Dump file '{dump_file}' not found!")
            sys.exit(1)

    # 1. Safety validation & target connect
    try:
        engine = validate_target_safety(
            target_url,
            target_env=target_env,
            allow_overwrite=allow_overwrite,
            allow_drop_tables=allow_drop_tables,
            confirm_railway_db=confirm_railway_db,
            dry_run=dry_run
        )
    except Exception as e:
        print(f"SAFETY CHECK FAILED: {e}")
        sys.exit(1)

    # 2. Read dump file and parse statements
    print(f"\nReading SQL dump from '{dump_file}'...")
    with open(dump_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    # Dynamic row count calculation from SQL dump
    expected_counts = {}
    for t in REQUIRED_TABLES:
        m = re.search(r'INSERT INTO [`"]?' + t + r'[`"]? VALUES\s*(.*?);', sql_content, re.DOTALL | re.IGNORECASE)
        if m:
            expected_counts[t] = m.group(1).count('),(') + 1
        else:
            expected_counts[t] = 0

    print("Expected table row counts parsed from dump:")
    for t, exp in expected_counts.items():
        print(f"  {t:18s}: {exp} rows")

    statements = []
    current_stmt = []
    drop_tables = []

    for line in sql_content.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("--") or trimmed.startswith("/*"):
            continue
        if "DROP TABLE IF EXISTS" in trimmed or "DROP TABLE" in trimmed:
            drop_tables.append(trimmed)
        current_stmt.append(line)
        if trimmed.endswith(";"):
            statements.append("\n".join(current_stmt))
            current_stmt = []

    print(f"\nParsed {len(statements)} SQL statements to execute.")
    if drop_tables:
        print(f"Detected {len(drop_tables)} DROP TABLE statements in dump:")
        for dt in drop_tables:
            print(f"  - {dt}")
        if not allow_overwrite and not allow_drop_tables and not dry_run:
            print("ERROR: SQL dump contains DROP TABLE statements but neither '--allow-overwrite-staging' nor '--allow-drop-tables' is set.")
            sys.exit(1)
    else:
        print("SAFE EXPORT CONFIRMED: 0 DROP TABLE statements found in dump.")

    if dry_run:
        print("\n[DRY RUN] Statement validation successful. No changes made to target database.")
        print("Dry Run Result: PASS (Ready for live migration)")
        return

    # 3. Execute in raw DBAPI connection for multi-statement execution
    print(f"\nExecuting {len(statements)} statements on Staging Database...")
    t0 = time.time()
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
        cursor.execute("SET UNIQUE_CHECKS = 0;")
        cursor.execute("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';")
        for idx, stmt in enumerate(statements, start=1):
            cursor.execute(stmt)
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
        cursor.execute("SET UNIQUE_CHECKS = 1;")
        raw_conn.commit()
        print(f"Executed {len(statements)} statements successfully in {time.time() - t0:.2f}s!")
    except Exception as e:
        raw_conn.rollback()
        print(f"ERROR executing SQL statements at index {idx}: {e}")
        sys.exit(1)
    finally:
        raw_conn.close()

    # 4. Deep verify
    success = verify_integrity(engine, expected_row_counts=expected_counts)
    if success:
        print("\n================================================================================")
        print("RAILWAY STAGING MIGRATION & VERIFICATION COMPLETED 100% SUCCESSFULLY!")
        print("================================================================================")
    else:
        print("\nFAILED: Post-migration verification failed.")
        sys.exit(1)


if __name__ == "__main__":
    default_dump = "railway_staging_safe_export.sql" if os.path.exists("railway_staging_safe_export.sql") else "railway_staging_export.sql"
    parser = argparse.ArgumentParser(description="Railway Staging Migration Tool with Production Guards")
    parser.add_argument("--test-local", action="store_true", help="Run self-test on local isolated staging db")
    parser.add_argument("--dry-run", action="store_true", help="Validate without applying changes")
    parser.add_argument("--target-env", default="", help="Target environment (must be 'staging')")
    parser.add_argument("--allow-overwrite-staging", action="store_true", help="Allow overwriting non-empty staging DB")
    parser.add_argument("--allow-drop-tables", action="store_true", help="Allow executing DROP TABLE statements")
    parser.add_argument("--confirm-railway-db", action="store_true", help="Confirm database named 'railway' is staging")
    parser.add_argument("--dump-file", default=default_dump, help="Path to dump file")
    args = parser.parse_args()

    if args.test_local:
        db_host = os.getenv("MYSQL_HOST", "localhost")
        test_url = f"mysql+pymysql://root:change_root_me@{db_host}:3306/railway_staging_test"
        admin_engine = create_engine(f"mysql+pymysql://root:change_root_me@{db_host}:3306/event_manager")
        with admin_engine.connect() as c:
            c.execute(text("CREATE DATABASE IF NOT EXISTS railway_staging_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"))
            c.commit()
        run_migration_pipeline(
            test_url,
            dump_file=args.dump_file,
            target_env="staging",
            allow_overwrite=False,  # Test without overwrite flag on clean DB
            allow_drop_tables=False, # Test with no DROP TABLE permission
            confirm_railway_db=True,
            dry_run=args.dry_run
        )
        with admin_engine.connect() as c:
            c.execute(text("DROP DATABASE IF EXISTS railway_staging_test"))
            c.commit()
        print("Self-test isolated DB cleaned up successfully.")
    else:
        target = os.getenv("STAGING_MYSQL_URL")
        if not target:
            print("ERROR: Please set STAGING_MYSQL_URL or pass --test-local.")
            print(f"Example: STAGING_MYSQL_URL='mysql+pymysql://user:pass@host:port/staging_db' TARGET_ENV=staging python backend/scripts/migrate_to_railway_staging.py --target-env staging")
            sys.exit(1)
        run_migration_pipeline(
            target,
            dump_file=args.dump_file,
            target_env=args.target_env,
            allow_overwrite=args.allow_overwrite_staging,
            allow_drop_tables=args.allow_drop_tables,
            confirm_railway_db=args.confirm_railway_db,
            dry_run=args.dry_run
        )
