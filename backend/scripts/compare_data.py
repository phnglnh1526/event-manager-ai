import sys
import os
import json
import re
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

def parse_sql_dump_table(filename, tablename):
    """Parses a table's INSERT statement from a mysqldump file."""
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Find CREATE TABLE for columns
    create_pattern = rf'CREATE TABLE `{tablename}` \((.+?)\) ENGINE='
    m_create = re.search(create_pattern, content, re.DOTALL)
    columns = []
    if m_create:
        for line in m_create.group(1).splitlines():
            line = line.strip()
            if line.startswith('`'):
                col_name = line.split('`')[1]
                columns.append(col_name)

    # Find INSERT INTO
    insert_pattern = rf'INSERT INTO `{tablename}` VALUES (.+?);(?:\n|$)'
    m_insert = re.search(insert_pattern, content, re.DOTALL)
    rows = []
    if m_insert:
        raw_tuples = m_insert.group(1).split('),(')
        for t in raw_tuples:
            t = t.strip('();\n ')
            # split by comma, respecting quotes
            # simple regex tokenizer for values
            vals = []
            tokens = re.findall(r"(?:'([^']*(?:''[^']*)*)'|NULL|(-?\d+(?:\.\d+)?))", t)
            row_dict = {}
            # Fallback simple split if tokens count matches
            # Let's do token parsing
            row_vals = []
            cur = ""
            in_q = False
            for char in t:
                if char == "'" and not in_q:
                    in_q = True
                elif char == "'" and in_q:
                    in_q = False
                elif char == ',' and not in_q:
                    row_vals.append(cur.strip("' "))
                    cur = ""
                    continue
                cur += char
            row_vals.append(cur.strip("' "))
            if len(columns) == len(row_vals):
                rows.append(dict(zip(columns, row_vals)))
            else:
                rows.append({'raw': row_vals})
    return columns, rows

def get_local_docker_table(tablename):
    cmd = f'docker exec event-manager-db mysql -u root -pchange_root_me event_manager --batch --raw -e "SELECT * FROM `{tablename}`;"'
    out = subprocess.check_output(cmd, shell=True).decode('utf-8', errors='replace')
    lines = [l for l in out.strip().split('\n') if l and not l.startswith('mysql:')]
    if not lines:
        return [], []
    cols = lines[0].split('\t')
    rows = []
    for l in lines[1:]:
        rows.append(dict(zip(cols, l.split('\t'))))
    return cols, rows

TABLES = ['users', 'events', 'speakers', 'schedules', 'registrations', 'tickets', 'checkins', 'feedbacks', 'announcements']

print("==================================================")
print("PRE-MIGRATION DETAILED COMPARISON")
print("==================================================")

# 1. Compare USERS
local_cols, local_users = get_local_docker_table('users')
aiven_cols, aiven_users = parse_sql_dump_table('aiven_before_full_migration.sql', 'users')

# User comparison by email
local_users_by_email = {u['email']: u for u in local_users}
aiven_users_by_email = {u['email']: u for u in aiven_users}

all_emails = set(local_users_by_email.keys()) | set(aiven_users_by_email.keys())

local_only_emails = set(local_users_by_email.keys()) - set(aiven_users_by_email.keys())
aiven_only_emails = set(aiven_users_by_email.keys()) - set(local_users_by_email.keys())
both_emails = set(local_users_by_email.keys()) & set(aiven_users_by_email.keys())

same_users = []
conflict_users = []
for email in both_emails:
    lu = local_users_by_email[email]
    au = aiven_users_by_email[email]
    # Check if role or full_name or id differ
    diffs = {}
    for k in ['id', 'full_name', 'role', 'is_active']:
        if lu.get(k) != au.get(k):
            diffs[k] = {'local': lu.get(k), 'aiven': au.get(k)}
    if diffs:
        conflict_users.append({'email': email, 'diffs': diffs})
    else:
        same_users.append(email)

print(f"\n[USERS] Total Local: {len(local_users)}, Total Aiven Backup: {len(aiven_users)}")
print(f"  - Local only: {len(local_only_emails)}")
print(f"  - Aiven only: {len(aiven_only_emails)}")
print(f"  - Same (all fields match including id): {len(same_users)}")
print(f"  - Conflict/Remap needed: {len(conflict_users)}")
for c in conflict_users[:10]:
    print(f"    * {c['email']}: {c['diffs']}")

# 2. Compare EVENTS
local_cols, local_events = get_local_docker_table('events')
aiven_cols, aiven_events = parse_sql_dump_table('aiven_before_full_migration.sql', 'events')

local_events_by_id = {e['id']: e for e in local_events}
aiven_events_by_id = {e['id']: e for e in aiven_events}

local_only_events = set(local_events_by_id.keys()) - set(aiven_events_by_id.keys())
aiven_only_events = set(aiven_events_by_id.keys()) - set(local_events_by_id.keys())
both_event_ids = set(local_events_by_id.keys()) & set(aiven_events_by_id.keys())

print(f"\n[EVENTS] Total Local: {len(local_events)}, Total Aiven Backup: {len(aiven_events)}")
print(f"  - Local only IDs: {sorted(list(local_only_events), key=int)}")
for eid in sorted(list(local_only_events), key=int):
    ev = local_events_by_id[eid]
    print(f"    * ID={eid}: '{ev['title']}' (status={ev['status']}, owner_id={ev['owner_id']})")

print(f"  - Aiven only IDs: {sorted(list(aiven_only_events), key=int)}")
for eid in sorted(list(aiven_only_events), key=int):
    ev = aiven_events_by_id[eid]
    print(f"    * ID={eid}: '{ev.get('title')}' (owner_id={ev.get('owner_id')})")

print(f"  - Both IDs: {sorted(list(both_event_ids), key=int)}")
for eid in sorted(list(both_event_ids), key=int):
    le = local_events_by_id[eid]
    ae = aiven_events_by_id[eid]
    diff = {k: (le.get(k), ae.get(k)) for k in ['title', 'status', 'owner_id'] if le.get(k) != ae.get(k)}
    if diff:
        print(f"    * ID={eid} DIFFERENCE: {diff}")
    else:
        print(f"    * ID={eid}: IDENTICAL ('{le['title']}')")

# 3. Compare other tables
for t in ['speakers', 'schedules', 'registrations', 'tickets', 'checkins', 'feedbacks', 'announcements']:
    l_cols, l_rows = get_local_docker_table(t)
    a_cols, a_rows = parse_sql_dump_table('aiven_before_full_migration.sql', t)
    l_ids = {r['id'] for r in l_rows if 'id' in r}
    a_ids = {r['id'] for r in a_rows if 'id' in r}
    print(f"\n[{t.upper()}] Local: {len(l_rows)}, Aiven Backup: {len(a_rows)}")
    print(f"  - Local only IDs: {len(l_ids - a_ids)}")
    print(f"  - Aiven only IDs: {len(a_ids - l_ids)}")
    print(f"  - In Both IDs: {len(l_ids & a_ids)}")
