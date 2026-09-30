"""Safe, idempotent demo data seeding for Event Manager AI.

Supports both startup seeding via SEED_DEMO=true and manual CLI execution.
Uses get-or-create patterns: never drops databases, never deletes non-demo data,
and never overwrites existing user passwords.
"""

import logging
import os
from collections import Counter
from datetime import datetime
from typing import Callable

from sqlalchemy import delete, func, inspect, select, text

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.database import SessionLocal, engine
from app.models import (
    Announcement,
    CheckIn,
    Event,
    Feedback,
    Registration,
    Schedule,
    Speaker,
    Ticket,
    User,
)
from app.services.tickets import create_ticket_with_retry

logger = logging.getLogger(__name__)

LEGACY_DEMO_SUFFIX = "@event-demo.local"
MAIN_EVENT_TITLE = "EVENT MANAGER AI — Demo Conference 2026"

USERS = (
    ("admin@example.com", "Admin Demo", "ADMIN", True),
    ("admin-demo@example.com", "Admin Demo", "ADMIN", True),
    ("organizer-a-demo@example.com", "Organizer A Demo", "ORGANIZER", True),
    ("organizer-b-demo@example.com", "Organizer B Demo", "ORGANIZER", True),
    ("staff-a-demo@example.com", "Staff A Demo", "STAFF", True),
    ("staff-b-demo@example.com", "Staff B Demo", "STAFF", True),
    *tuple(
        (f"attendee-{i:02d}-demo@example.com", f"Attendee {i:02d} Demo", "ATTENDEE", True)
        for i in range(1, 9)
    ),
    ("inactive-demo@example.com", "Inactive Demo", "ATTENDEE", False),
)

EVENTS = (
    (
        MAIN_EVENT_TITLE,
        "organizer-a-demo@example.com",
        "A complete demonstration event used to test registration, tickets, QR check-in, feedback, analytics and AI features.",
        "ICTU - Main Hall",
        datetime(2026, 10, 10, 8),
        datetime(2026, 10, 10, 11),
        "PUBLISHED",
        100,
    ),
    (
        "AI Technology Conference 2026",
        "organizer-a-demo@example.com",
        "Hội thảo giới thiệu các xu hướng trí tuệ nhân tạo, ứng dụng AI trong phát triển phần mềm và các bài toán thực tế.",
        "ICTU - Tòa nhà A",
        datetime(2026, 10, 11, 13, 30),
        datetime(2026, 10, 11, 17, 30),
        "PUBLISHED",
        200,
    ),
    (
        "Web Development Workshop 2026",
        "organizer-a-demo@example.com",
        "DEMO dataset: draft Event for registration and visibility tests.",
        "ICTU - Web Lab",
        datetime(2026, 10, 12, 8),
        datetime(2026, 10, 12, 12),
        "DRAFT",
        80,
    ),
    (
        "Cloud Computing Seminar",
        "organizer-a-demo@example.com",
        "DEMO dataset: cancelled Event for lifecycle and error tests.",
        "ICTU - Cloud Lab",
        datetime(2026, 10, 13, 14),
        datetime(2026, 10, 13, 18),
        "CANCELLED",
        100,
    ),
    (
        "Cybersecurity Conference 2026",
        "organizer-b-demo@example.com",
        "DEMO dataset: published Event owned by Organizer B.",
        "ICTU - Security Hall",
        datetime(2026, 10, 14, 8, 30),
        datetime(2026, 10, 14, 16, 30),
        "PUBLISHED",
        120,
    ),
)

MAIN_SPEAKERS = (
    ("Nguyễn Minh Anh", "AI Researcher", "ICTU AI Lab", "Nghiên cứu trí tuệ nhân tạo và ứng dụng machine learning."),
    ("Trần Hoàng Nam", "Senior Software Engineer", "TechVision", "Chuyên phát triển hệ thống phần mềm và tích hợp AI."),
    ("Lê Thu Hà", "Data Scientist", "DataNext", "Chuyên phân tích dữ liệu và xây dựng mô hình dữ liệu thực tế."),
    ("Phạm Quốc Huy", "Cloud Engineer", "CloudTech", "Chuyên hệ thống cloud và DevOps."),
)
SECOND_SPEAKERS = (
    ("Vũ Hải Yến", "AI Product Lead", "FutureAI", "Phát triển sản phẩm AI lấy người dùng làm trung tâm."),
    ("Đỗ Thành Long", "Machine Learning Engineer", "VisionWorks", "Triển khai mô hình machine learning trong hệ thống thực tế."),
)
MAIN_SCHEDULES = (
    ("Opening Ceremony", 8, 0, 8, 15, None, "Main Hall"),
    ("AI Fundamentals", 8, 15, 9, 0, "Nguyễn Minh Anh", "Main Hall"),
    ("AI in Software Development", 9, 0, 9, 45, "Trần Hoàng Nam", "Room A"),
    ("Data Science in Practice", 9, 0, 9, 45, "Lê Thu Hà", "Room B"),
    ("Cloud & AI Infrastructure", 9, 45, 10, 30, "Phạm Quốc Huy", "Main Hall"),
    ("Networking & Q&A", 10, 30, 11, 0, None, "Main Hall"),
)
SECOND_SCHEDULES = (
    ("Responsible AI Products", 14, 0, 15, 0, "Vũ Hải Yến", "Hall A"),
    ("Production Machine Learning", 15, 15, 16, 15, "Đỗ Thành Long", "Hall A"),
)
FEEDBACKS = (
    (1, 5, "Chương trình được tổ chức tốt, nội dung AI rất hữu ích."),
    (2, 4, "Diễn giả trình bày rõ ràng, nhưng phần Q&A hơi ngắn."),
    (3, 5, "Lịch trình hợp lý và nội dung thực tế."),
    (4, 4, "Check-in nhanh, nhưng khu vực hội trường hơi đông."),
    (5, 3, "Nội dung tốt nhưng một số phiên bị trùng thời gian."),
)
ANNOUNCEMENTS = (
    ("Welcome to Event Manager AI Demo Conference 2026", "Thông báo chào mừng người tham dự và hướng dẫn đến sớm để check-in.", "PUBLISHED"),
    ("Check-in Instructions", "Vui lòng chuẩn bị mã QR hoặc ticket code trước khi đến khu vực check-in.", "PUBLISHED"),
    ("Schedule Update", "Phiên Networking & Q&A sẽ diễn ra sau phiên Cloud & AI Infrastructure.", "PUBLISHED"),
    ("Post-event Thank You", "Cảm ơn người tham dự đã tham gia sự kiện.", "DRAFT"),
)


def one_or_none(db, model, *criteria):
    rows = list(db.scalars(select(model).where(*criteria)).all())
    if len(rows) > 1:
        raise RuntimeError(f"Duplicate {model.__name__} rows for demo identity")
    return rows[0] if rows else None


def get_or_create_users(
    db,
    password_resolver: Callable[[str, str], str],
    refresh_demo_passwords: bool = False,
):
    result = {}
    for email, full_name, role, is_active in USERS:
        user = one_or_none(db, User, User.email == email)
        pwd = password_resolver(role, email)
        if user is None:
            if not pwd or len(pwd) < 8 or len(pwd.encode("utf-8")) > 72:
                logger.warning(
                    "Skipping user %s; no valid password (8-72 chars) provided for role %s",
                    email,
                    role,
                )
                continue
            user = User(
                email=email,
                full_name=full_name,
                role=role,
                is_active=is_active,
                password_hash=hash_password(pwd),
            )
            db.add(user)
            db.flush()
            logger.info("Created demo user %s with role %s", email, role)
        elif refresh_demo_passwords and pwd and 8 <= len(pwd) <= 72:
            user.password_hash = hash_password(pwd)
            db.flush()
        # Idempotent: preserve existing users without overwriting password or attributes
        result[email] = user
    return result


def upsert_events(db, users):
    result = {}
    for title, owner_email, description, location, start, end, status, capacity in EVENTS:
        if owner_email not in users:
            continue
        event = one_or_none(db, Event, Event.title == title)
        if event is None:
            event = Event(
                title=title,
                owner_id=users[owner_email].id,
                description=description,
                location=location,
                start_time=start,
                end_time=end,
                status=status,
                max_attendees=capacity,
            )
            db.add(event)
            db.flush()
            logger.info("Created demo event: %s", title)
        else:
            current_owner_email = (
                db.scalar(select(User.email).where(User.id == event.owner_id)) or ""
            )
            is_demo_owned = current_owner_email.endswith(
                "-demo@example.com"
            ) or current_owner_email in ("admin@example.com", "organizer@example.com")
            is_legacy_main = (
                title == MAIN_EVENT_TITLE and current_owner_email.endswith(LEGACY_DEMO_SUFFIX)
            )
            if not (is_demo_owned or is_legacy_main):
                raise RuntimeError(f"Event title already belongs to non-demo data: {title}")
        event.description, event.location = description, location
        event.start_time, event.end_time = start, end
        event.status, event.max_attendees = status, capacity
        event.owner_id = users[owner_email].id
        result[title] = event
    return result


def reconcile_speakers(db, event, specs):
    desired = {spec[0] for spec in specs}
    result = {}
    for full_name, title, organization, bio in specs:
        speaker = one_or_none(
            db, Speaker, Speaker.event_id == event.id, Speaker.full_name == full_name
        )
        if speaker is None:
            speaker = Speaker(event_id=event.id, full_name=full_name)
            db.add(speaker)
            db.flush()
        speaker.title, speaker.organization, speaker.bio, speaker.email = (
            title,
            organization,
            bio,
            None,
        )
        result[full_name] = speaker
    extras = list(
        db.scalars(
            select(Speaker).where(
                Speaker.event_id == event.id, Speaker.full_name.not_in(desired)
            )
        ).all()
    )
    for extra in extras:
        db.execute(
            delete(Schedule).where(
                Schedule.event_id == event.id, Schedule.speaker_id == extra.id
            )
        )
        db.delete(extra)
    return result


def reconcile_schedules(db, event, speakers, specs):
    desired = {spec[0] for spec in specs}
    date = event.start_time
    for title, sh, sm, eh, em, speaker_name, location in specs:
        schedule = one_or_none(
            db, Schedule, Schedule.event_id == event.id, Schedule.title == title
        )
        if schedule is None:
            schedule = Schedule(event_id=event.id, title=title)
            db.add(schedule)
        schedule.start_time = datetime(date.year, date.month, date.day, sh, sm)
        schedule.end_time = datetime(date.year, date.month, date.day, eh, em)
        schedule.location = location
        schedule.description = f"DEMO session: {title}."
        schedule.speaker_id = speakers[speaker_name].id if speaker_name else None
        if schedule.start_time < event.start_time or schedule.end_time > event.end_time:
            raise RuntimeError(f"Schedule outside Event range: {title}")
    db.execute(
        delete(Schedule).where(
            Schedule.event_id == event.id, Schedule.title.not_in(desired)
        )
    )


def remove_legacy_main_rows(db, main_event, target_user_ids):
    for feedback in list(
        db.scalars(select(Feedback).where(Feedback.event_id == main_event.id)).all()
    ):
        if feedback.user_id not in target_user_ids:
            email = db.scalar(select(User.email).where(User.id == feedback.user_id)) or ""
            is_legacy = (
                email.endswith(LEGACY_DEMO_SUFFIX)
                or email.endswith("@gmail.com")
                or email.endswith("@example.com")
            )
            if not is_legacy:
                raise RuntimeError(
                    "Main demo Event contains non-demo Feedback; refusing cleanup"
                )
            db.delete(feedback)
    for registration in list(
        db.scalars(
            select(Registration).where(Registration.event_id == main_event.id)
        ).all()
    ):
        if registration.user_id not in target_user_ids:
            email = (
                db.scalar(select(User.email).where(User.id == registration.user_id)) or ""
            )
            is_legacy = (
                email.endswith(LEGACY_DEMO_SUFFIX)
                or email.endswith("@gmail.com")
                or email.endswith("@example.com")
            )
            if not is_legacy:
                raise RuntimeError(
                    "Main demo Event contains non-demo Registration; refusing cleanup"
                )
            db.execute(delete(Registration).where(Registration.id == registration.id))
    db.flush()


def ensure_registration(db, event, attendee, status):
    registration = one_or_none(
        db,
        Registration,
        Registration.event_id == event.id,
        Registration.user_id == attendee.id,
    )
    if registration is None:
        registration = Registration(
            event_id=event.id, user_id=attendee.id, status=status
        )
        db.add(registration)
        db.flush()
    ticket = one_or_none(db, Ticket, Ticket.registration_id == registration.id)
    if ticket is None:
        ticket = create_ticket_with_retry(
            db, registration.id, "ACTIVE" if status == "REGISTERED" else "VOID"
        )
        db.flush()
    registration.status = status
    ticket.status = "ACTIVE" if status == "REGISTERED" else "VOID"
    return registration, ticket


def reconcile_main_lifecycle(db, main_event, users):
    attendees = [users[f"attendee-{i:02d}-demo@example.com"] for i in range(1, 9)]
    remove_legacy_main_rows(db, main_event, {user.id for user in attendees})
    tickets = {}
    for index, attendee in enumerate(attendees, start=1):
        _, tickets[index] = ensure_registration(
            db, main_event, attendee, "CANCELLED" if index == 8 else "REGISTERED"
        )
    staff = users["staff-a-demo@example.com"]
    for index, ticket in tickets.items():
        checkin = one_or_none(db, CheckIn, CheckIn.ticket_id == ticket.id)
        if index <= 6:
            if checkin is None:
                db.add(CheckIn(ticket_id=ticket.id, checked_in_by_user_id=staff.id))
            else:
                checkin.checked_in_by_user_id = staff.id
        elif checkin is not None:
            db.delete(checkin)
    desired_feedback_users = set()
    for index, rating, comment in FEEDBACKS:
        attendee = attendees[index - 1]
        desired_feedback_users.add(attendee.id)
        feedback = one_or_none(
            db,
            Feedback,
            Feedback.event_id == main_event.id,
            Feedback.user_id == attendee.id,
        )
        if feedback is None:
            feedback = Feedback(event_id=main_event.id, user_id=attendee.id)
            db.add(feedback)
        feedback.rating, feedback.comment = rating, comment
    db.execute(
        delete(Feedback).where(
            Feedback.event_id == main_event.id,
            Feedback.user_id.not_in(desired_feedback_users),
        )
    )
    return attendees, tickets


def verify_reregistration(db, second_event, attendee):
    registration, ticket = ensure_registration(db, second_event, attendee, "REGISTERED")
    original = registration.id, ticket.id, ticket.ticket_code
    registration.status, ticket.status = "CANCELLED", "VOID"
    db.flush()
    registration.status, ticket.status = "REGISTERED", "ACTIVE"
    db.flush()
    if (registration.id, ticket.id, ticket.ticket_code) != original:
        raise RuntimeError("Re-registration did not preserve Registration/Ticket identity")
    return original


def reconcile_announcements(db, event, creator):
    desired = {item[0] for item in ANNOUNCEMENTS}
    for title, content, status in ANNOUNCEMENTS:
        announcement = one_or_none(
            db, Announcement, Announcement.event_id == event.id, Announcement.title == title
        )
        if announcement is None:
            announcement = Announcement(event_id=event.id, title=title)
            db.add(announcement)
        announcement.content, announcement.status = content, status
        announcement.created_by_user_id = creator.id
        if status == "PUBLISHED" and announcement.published_at is None:
            announcement.published_at = datetime.now()
        elif status == "DRAFT":
            announcement.published_at = None
    db.execute(
        delete(Announcement).where(
            Announcement.event_id == event.id, Announcement.title.not_in(desired)
        )
    )


def verify_dataset(db, main, users):
    tables = sorted(inspect(engine).get_table_names())
    expected_tables = sorted(
        (
            "users",
            "events",
            "speakers",
            "schedules",
            "registrations",
            "tickets",
            "checkins",
            "feedbacks",
            "announcements",
        )
    )
    if not set(expected_tables).issubset(set(tables)):
        raise RuntimeError(f"Missing required tables in schema: {set(expected_tables) - set(tables)}")
    counts = {
        "speakers": db.scalar(
            select(func.count(Speaker.id)).where(Speaker.event_id == main.id)
        ),
        "schedules": db.scalar(
            select(func.count(Schedule.id)).where(Schedule.event_id == main.id)
        ),
        "registrations": db.scalar(
            select(func.count(Registration.id)).where(Registration.event_id == main.id)
        ),
        "registered": db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == main.id, Registration.status == "REGISTERED"
            )
        ),
        "cancelled": db.scalar(
            select(func.count(Registration.id)).where(
                Registration.event_id == main.id, Registration.status == "CANCELLED"
            )
        ),
        "checkins": db.scalar(
            select(func.count(CheckIn.id))
            .join(Ticket)
            .join(Registration)
            .where(Registration.event_id == main.id)
        ),
        "feedbacks": db.scalar(
            select(func.count(Feedback.id)).where(Feedback.event_id == main.id)
        ),
        "announcements": db.scalar(
            select(func.count(Announcement.id)).where(Announcement.event_id == main.id)
        ),
    }
    expected = {
        "speakers": 4,
        "schedules": 6,
        "registrations": 8,
        "registered": 7,
        "cancelled": 1,
        "checkins": 6,
        "feedbacks": 5,
        "announcements": 4,
    }
    if counts != expected:
        raise RuntimeError(f"Demo invariant mismatch: {counts}")
    ratings = Counter(
        db.scalars(select(Feedback.rating).where(Feedback.event_id == main.id)).all()
    )
    average = float(
        db.scalar(select(func.avg(Feedback.rating)).where(Feedback.event_id == main.id))
        or 0
    )
    if ratings != Counter({5: 2, 4: 2, 3: 1}) or round(average, 1) != 4.2:
        raise RuntimeError(
            f"Feedback metrics mismatch: ratings={ratings}, average={average}"
        )
    roles = Counter(user.role for user in users.values())
    integrity_queries = {
        "duplicate_user_email": "SELECT COUNT(*) FROM (SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1) x",
        "duplicate_registration": "SELECT COUNT(*) FROM (SELECT event_id, user_id FROM registrations GROUP BY event_id, user_id HAVING COUNT(*) > 1) x",
        "duplicate_ticket_registration": "SELECT COUNT(*) FROM (SELECT registration_id FROM tickets GROUP BY registration_id HAVING COUNT(*) > 1) x",
        "duplicate_ticket_code": "SELECT COUNT(*) FROM (SELECT ticket_code FROM tickets GROUP BY ticket_code HAVING COUNT(*) > 1) x",
        "duplicate_checkin": "SELECT COUNT(*) FROM (SELECT ticket_id FROM checkins GROUP BY ticket_id HAVING COUNT(*) > 1) x",
        "duplicate_feedback": "SELECT COUNT(*) FROM (SELECT event_id, user_id FROM feedbacks GROUP BY event_id, user_id HAVING COUNT(*) > 1) x",
        "orphan_speaker": "SELECT COUNT(*) FROM speakers s LEFT JOIN events e ON e.id=s.event_id WHERE e.id IS NULL",
        "orphan_schedule_event": "SELECT COUNT(*) FROM schedules s LEFT JOIN events e ON e.id=s.event_id WHERE e.id IS NULL",
        "orphan_schedule_speaker": "SELECT COUNT(*) FROM schedules s LEFT JOIN speakers p ON p.id=s.speaker_id WHERE s.speaker_id IS NOT NULL AND p.id IS NULL",
        "orphan_registration": "SELECT COUNT(*) FROM registrations r LEFT JOIN events e ON e.id=r.event_id LEFT JOIN users u ON u.id=r.user_id WHERE e.id IS NULL OR u.id IS NULL",
        "orphan_ticket": "SELECT COUNT(*) FROM tickets t LEFT JOIN registrations r ON r.id=t.registration_id WHERE r.id IS NULL",
        "orphan_checkin": "SELECT COUNT(*) FROM checkins c LEFT JOIN tickets t ON t.id=c.ticket_id WHERE t.id IS NULL",
        "orphan_feedback": "SELECT COUNT(*) FROM feedbacks f LEFT JOIN events e ON e.id=f.event_id LEFT JOIN users u ON u.id=f.user_id WHERE e.id IS NULL OR u.id IS NULL",
        "orphan_announcement": "SELECT COUNT(*) FROM announcements a LEFT JOIN events e ON e.id=a.event_id WHERE e.id IS NULL",
    }
    failures = {
        name: db.scalar(text(query)) for name, query in integrity_queries.items()
    }
    failures = {name: count for name, count in failures.items() if count}
    if failures:
        raise RuntimeError(f"Database integrity mismatch: {failures}")
    return tables, counts, ratings, average, roles


def run_seed(
    password_resolver: Callable[[str, str], str],
    refresh_demo_passwords: bool = False,
) -> dict:
    db = SessionLocal()
    try:
        users = get_or_create_users(
            db, password_resolver, refresh_demo_passwords=refresh_demo_passwords
        )
        if "organizer-a-demo@example.com" not in users:
            logger.warning("Organizer A demo user not available; skipping event seeding")
            db.commit()
            return {"users": users}
        events = upsert_events(db, users)
        main = events[MAIN_EVENT_TITLE]
        second = events["AI Technology Conference 2026"]
        main_speakers = reconcile_speakers(db, main, MAIN_SPEAKERS)
        second_speakers = reconcile_speakers(db, second, SECOND_SPEAKERS)
        reconcile_schedules(db, main, main_speakers, MAIN_SCHEDULES)
        reconcile_schedules(db, second, second_speakers, SECOND_SCHEDULES)
        attendees, tickets = reconcile_main_lifecycle(db, main, users)
        rereg = verify_reregistration(db, second, attendees[6])
        reconcile_announcements(db, main, users["organizer-a-demo@example.com"])
        db.flush()
        after_tables, counts, ratings, average, roles = verify_dataset(db, main, users)
        ticket_info = {
            index: {"id": ticket.id, "ticket_code": ticket.ticket_code}
            for index, ticket in tickets.items()
        }
        main_id = main.id
        db.commit()
        logger.info(
            "Demo seed completed successfully. Tables: %d, Main event ID: %s, Roles: %s",
            len(after_tables),
            main_id,
            dict(roles),
        )
        return {
            "users": users,
            "events": events,
            "main_id": main_id,
            "tickets": ticket_info,
            "counts": counts,
            "ratings": ratings,
            "average": average,
            "roles": roles,
            "rereg": rereg,
            "after_tables": after_tables,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def seed_demo_if_enabled() -> None:
    settings = get_settings()
    if not settings.seed_demo:
        return

    logger.info("SEED_DEMO is enabled. Preparing to seed demo accounts...")

    def resolve_password(role: str, email: str) -> str:
        if role == "ADMIN" and settings.demo_admin_password:
            return settings.demo_admin_password
        if role == "ORGANIZER" and settings.demo_organizer_password:
            return settings.demo_organizer_password
        if role == "STAFF" and settings.demo_staff_password:
            return settings.demo_staff_password
        if role == "ATTENDEE" and settings.demo_attendee_password:
            return settings.demo_attendee_password
        if settings.demo_password:
            return settings.demo_password
        return os.getenv("DEMO_PASSWORD", "").strip()

    admin_pwd = resolve_password("ADMIN", "admin@example.com")
    if not admin_pwd or len(admin_pwd) < 8 or len(admin_pwd.encode("utf-8")) > 72:
        logger.error(
            "SEED_DEMO=true but DEMO_PASSWORD or DEMO_ADMIN_PASSWORD is missing or invalid (<8 chars). Cannot seed demo accounts."
        )
        return

    try:
        run_seed(resolve_password)
        logger.info("SEED_DEMO finished successfully.")
    except Exception:
        logger.exception("SEED_DEMO encountered an error during execution.")
