import json
from sqlalchemy import text, inspect
from app.db.database import engine

def audit():
    with engine.connect() as conn:
        version = conn.execute(text("SELECT VERSION()")).scalar()
        tx_isolation = conn.execute(text("SELECT @@transaction_isolation")).scalar()
        sql_mode = conn.execute(text("SELECT @@sql_mode")).scalar()
        char_set = conn.execute(text("SELECT @@character_set_database, @@collation_database")).all()

        print(f"MySQL Version: {version}")
        print(f"Transaction Isolation: {tx_isolation}")
        print(f"SQL Mode: {sql_mode}")
        print(f"DB Charset/Collation: {char_set}")

        # Tables info
        print("\n--- TABLES & ENGINES ---")
        tables_res = conn.execute(text("""
            SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, ROW_FORMAT, CREATE_TIME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = 'event_manager'
            ORDER BY TABLE_NAME
        """)).mappings().all()
        for r in tables_res:
            print(f"{r['TABLE_NAME']:18s} | Engine: {r['ENGINE']} | Collation: {r['TABLE_COLLATION']} | Format: {r['ROW_FORMAT']}")

        # Triggers
        print("\n--- TRIGGERS ---")
        triggers = conn.execute(text("SHOW TRIGGERS")).mappings().all()
        print(f"Triggers count: {len(triggers)}")
        for tr in triggers:
            print(f"Trigger: {tr['Trigger']} on {tr['Table']} ({tr['Timing']} {tr['Event']})")

        # Routines
        print("\n--- ROUTINES (PROCEDURES / FUNCTIONS) ---")
        routines = conn.execute(text("""
            SELECT ROUTINE_NAME, ROUTINE_TYPE
            FROM information_schema.ROUTINES
            WHERE ROUTINE_SCHEMA = 'event_manager'
        """)).mappings().all()
        print(f"Routines count: {len(routines)}")
        for ro in routines:
            print(f"Routine: {ro['ROUTINE_NAME']} ({ro['ROUTINE_TYPE']})")

        # Events
        print("\n--- MYSQL EVENTS ---")
        events = conn.execute(text("""
            SELECT EVENT_NAME, STATUS
            FROM information_schema.EVENTS
            WHERE EVENT_SCHEMA = 'event_manager'
        """)).mappings().all()
        print(f"Events count: {len(events)}")
        for ev in events:
            print(f"Event: {ev['EVENT_NAME']} ({ev['STATUS']})")

        # Columns, types & special fields (BLOB, TEXT, etc.)
        print("\n--- SPECIAL COLUMN TYPES (BLOB / TEXT / DATETIME) ---")
        cols = conn.execute(text("""
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = 'event_manager' AND DATA_TYPE IN ('longblob', 'blob', 'text', 'mediumtext', 'datetime')
            ORDER BY TABLE_NAME, COLUMN_NAME
        """)).mappings().all()
        for c in cols:
            print(f"{c['TABLE_NAME']:18s} | {c['COLUMN_NAME']:20s} | {c['COLUMN_TYPE']}")

        # Foreign Keys
        insp = inspect(engine)
        print("\n--- FOREIGN KEYS AND CASCADE RULES ---")
        for tbl in sorted(insp.get_table_names()):
            fks = insp.get_foreign_keys(tbl)
            for fk in fks:
                print(f"{tbl:18s} -> {fk['constrained_columns']} REFERENCES {fk['referred_table']}{fk['referred_columns']} (ON DELETE: {fk.get('options', {}).get('ondelete', 'RESTRICT')})")

        # Unique Constraints
        print("\n--- UNIQUE CONSTRAINTS ---")
        for tbl in sorted(insp.get_table_names()):
            uqs = insp.get_unique_constraints(tbl)
            for uq in uqs:
                print(f"{tbl:18s} -> UQ: {uq['name']} {uq['column_names']}")

if __name__ == "__main__":
    audit()
