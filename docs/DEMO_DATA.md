# Complete Demo Dataset

The dataset is created manually by `backend/scripts/seed_demo.py`. It is not part of application startup, does not change schema, and only reconciles the fixed demo accounts/Event titles declared in the script.

## Run

Set a local disposable password of 8–72 UTF-8 bytes. Do not commit it.

PowerShell:

```powershell
$env:DEMO_PASSWORD = "<local-demo-password>"
docker cp backend/scripts/seed_demo.py event-manager-backend:/tmp/seed_demo.py
docker compose exec -T -e PYTHONPATH=/app -e DEMO_PASSWORD=$env:DEMO_PASSWORD backend python /tmp/seed_demo.py
Remove-Item Env:DEMO_PASSWORD
```

The script prints the demo Ticket codes to the local terminal for QR/manual check-in testing. Ticket codes are intentionally not stored in this document.

## Accounts

All accounts use the locally configured `DEMO_PASSWORD`.

| Account | Role | Purpose | State |
|---|---|---|---|
| `admin-demo@example.com` | ADMIN | Full management and cross-owner tests | ACTIVE |
| `organizer-a-demo@example.com` | ORGANIZER | Owner of Events 1–4 | ACTIVE |
| `organizer-b-demo@example.com` | ORGANIZER | Ownership isolation/Event 5 | ACTIVE |
| `staff-a-demo@example.com` | STAFF | Check-in operator | ACTIVE |
| `staff-b-demo@example.com` | STAFF | Secondary staff account | ACTIVE |
| `attendee-01-demo@example.com` | ATTENDEE | Checked in + Feedback; duplicate check-in test | ACTIVE |
| `attendee-02-demo@example.com` | ATTENDEE | Checked in + Feedback | ACTIVE |
| `attendee-03-demo@example.com` | ATTENDEE | Checked in + Feedback | ACTIVE |
| `attendee-04-demo@example.com` | ATTENDEE | Checked in + Feedback | ACTIVE |
| `attendee-05-demo@example.com` | ATTENDEE | Checked in + Feedback | ACTIVE |
| `attendee-06-demo@example.com` | ATTENDEE | Checked in, no Feedback | ACTIVE |
| `attendee-07-demo@example.com` | ATTENDEE | Live QR/check-in; ACTIVE Ticket, not checked in | ACTIVE |
| `attendee-08-demo@example.com` | ATTENDEE | CANCELLED Registration + VOID Ticket | ACTIVE |
| `inactive-demo@example.com` | ATTENDEE | Inactive-login test | INACTIVE |

## Events

| Event | Owner | Status | Purpose |
|---|---|---|---|
| `EVENT MANAGER AI — Demo Conference 2026` | Organizer A | PUBLISHED | Full E2E dataset |
| `AI Technology Conference 2026` | Organizer A | PUBLISHED | Second chatbot context + re-registration lifecycle |
| `Web Development Workshop 2026` | Organizer A | DRAFT | Registration/RBAC negative test |
| `Cloud Computing Seminar` | Organizer A | CANCELLED | Lifecycle/error negative test |
| `Cybersecurity Conference 2026` | Organizer B | PUBLISHED | Organizer ownership isolation |

## Main Event target state

- Capacity: 100; active registrations: 7; available: 93.
- Registration rows: 8 (`REGISTERED`: 7, `CANCELLED`: 1).
- Tickets: 7 `ACTIVE`, 1 `VOID`.
- Check-ins: 6; one active attendee remains unchecked for live demo.
- Speakers: 4; Schedule sessions: 6, including one parallel pair and sessions without a Speaker.
- Feedbacks: 5; average 4.2; distribution 5★×2, 4★×2, 3★×1.
- Announcements: 3 `PUBLISHED`, 1 `DRAFT`.
- All three AI features are ready in `AI_MODE=mock` without an OpenAI key.

## Verification

The regression `backend/tests/test_demo_dataset.py` verifies Auth, RBAC, ownership, registration reactivation, Ticket/QR lifecycle, duplicate and VOID check-in rejection, Feedback eligibility, Statistics, Announcement visibility, and all three AI endpoints. It never consumes Attendee 07's live check-in state.

Run it with the same local password used for the seed:

```powershell
docker cp backend/tests/test_demo_dataset.py event-manager-backend:/tmp/test_demo_dataset.py
docker compose exec -T -e PYTHONPATH=/app -e DEMO_PASSWORD=$env:DEMO_PASSWORD backend python /tmp/test_demo_dataset.py
```
