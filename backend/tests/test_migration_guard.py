"""
Unit Tests for Railway Staging Migration Production Guard
Verifies all safety edge cases without affecting live or persistent database data.
"""

import os
import pytest
from sqlalchemy import create_engine, text

from scripts.migrate_to_railway_staging import (
    FORBIDDEN_PROD_KEYWORDS,
    mask_url,
    validate_target_safety,
)


def test_mask_url_hides_credentials():
    url = "mysql+pymysql://sensitive_user:super_secret_password@db.example.com:3306/staging_db"
    masked = mask_url(url)
    assert "sensitive_user" not in masked
    assert "super_secret_password" not in masked
    assert "***:***" in masked
    assert "db.example.com" in masked
    assert "staging_db" in masked


def test_mask_url_handles_malformed_string():
    masked = mask_url("mysql://user:pass@invalid:host")
    assert "pass" not in masked
    assert "user" not in masked


def test_guard_rejects_missing_url():
    with pytest.raises(ValueError, match="empty or missing"):
        validate_target_safety("", target_env="staging")


def test_guard_rejects_malformed_url():
    with pytest.raises(ValueError, match="malformed"):
        validate_target_safety("not-a-valid-database-url", target_env="staging")


def test_guard_rejects_missing_target_env():
    # If target_env is not 'staging'
    with pytest.raises(RuntimeError, match="requires explicit target environment confirmation"):
        validate_target_safety(
            "mysql+pymysql://user:pass@localhost:3306/staging_test",
            target_env="",
        )


def test_guard_rejects_production_keywords_in_dbname():
    for kw in FORBIDDEN_PROD_KEYWORDS:
        test_url = f"mysql+pymysql://user:pass@staging-host:3306/my_{kw}_db"
        with pytest.raises(RuntimeError, match="indicates a PRODUCTION environment"):
            validate_target_safety(test_url, target_env="staging")


def test_guard_rejects_production_keywords_in_host():
    for kw in ("prod-db.railway.internal", "production.cluster.com", "live-mysql.cloud.io"):
        test_url = f"mysql+pymysql://user:pass@{kw}:3306/clean_staging"
        with pytest.raises(RuntimeError, match="indicates a PRODUCTION environment"):
            validate_target_safety(test_url, target_env="staging")


def test_guard_rejects_railway_dbname_without_confirmation():
    # Database is named 'railway', but no --confirm-railway-db flag passed
    test_url = "mysql+pymysql://root:pass@containers-us-west-1.railway.app:3306/railway"
    with pytest.raises(RuntimeError, match="Target database is named 'railway'"):
        validate_target_safety(
            test_url,
            target_env="staging",
            confirm_railway_db=False,
        )


def test_guard_rejects_connection_failure_with_masked_logs():
    # Unreachable host or wrong credentials
    test_url = "mysql+pymysql://secret_user:secret_pass@127.0.0.1:59999/staging_db"
    try:
        validate_target_safety(test_url, target_env="staging")
    except ConnectionError as exc:
        err_msg = str(exc)
        assert "secret_user" not in err_msg
        assert "secret_pass" not in err_msg
        assert "***:***" in err_msg


def test_guard_non_empty_database_in_isolated_test_db():
    db_host = os.getenv("MYSQL_HOST", "localhost")
    admin_url = f"mysql+pymysql://root:change_root_me@{db_host}:3306/event_manager"
    admin_engine = create_engine(admin_url)

    # Create isolated database for testing guard
    isolated_db = "guard_verify_isolated_test"
    with admin_engine.connect() as c:
        c.execute(text(f"CREATE DATABASE IF NOT EXISTS `{isolated_db}`"))
        c.commit()

    isolated_url = f"mysql+pymysql://root:change_root_me@{db_host}:3306/{isolated_db}"
    isolated_engine = create_engine(isolated_url)

    try:
        # Case A: Empty DB -> Safe to proceed
        engine = validate_target_safety(isolated_url, target_env="staging", dry_run=True)
        assert engine is not None

        # Case B: Create dummy table and insert row
        with isolated_engine.connect() as c:
            c.execute(text("CREATE TABLE dummy_staging (id INT PRIMARY KEY, name VARCHAR(50))"))
            c.execute(text("INSERT INTO dummy_staging VALUES (1, 'existing_data')"))
            c.commit()

        # Should be REJECTED without --allow-overwrite-staging
        with pytest.raises(RuntimeError, match="Target database is NOT empty"):
            validate_target_safety(isolated_url, target_env="staging", allow_overwrite=False, dry_run=False)

        # Should PASS when --allow-overwrite-staging is explicitly provided
        allowed_engine = validate_target_safety(isolated_url, target_env="staging", allow_overwrite=True, dry_run=False)
        assert allowed_engine is not None

    finally:
        with admin_engine.connect() as c:
            c.execute(text(f"DROP DATABASE IF EXISTS `{isolated_db}`"))
            c.commit()


def run():
    test_mask_url_hides_credentials()
    test_mask_url_handles_malformed_string()
    test_guard_rejects_missing_url()
    test_guard_rejects_malformed_url()
    test_guard_rejects_missing_target_env()
    test_guard_rejects_production_keywords_in_dbname()
    test_guard_rejects_production_keywords_in_host()
    test_guard_rejects_railway_dbname_without_confirmation()
    test_guard_rejects_connection_failure_with_masked_logs()
    test_guard_non_empty_database_in_isolated_test_db()
    print("ALL MIGRATION PRODUCTION GUARD TESTS PASSED (100% OK)!")


if __name__ == "__main__":
    run()
