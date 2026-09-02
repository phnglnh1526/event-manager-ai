import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api.auth import router as auth_router
from app.api.ai_feedback import router as ai_feedback_router
from app.api.ai_announcements import router as ai_announcements_router
from app.api.announcements import router as announcements_router
from app.api.attendee_events import router as attendee_events_router
from app.api.checkins import router as checkins_router
from app.api.events import router as events_router
from app.api.feedbacks import router as feedbacks_router
from app.api.health import router as health_router
from app.api.rbac import router as rbac_router
from app.api.registrations import router as registrations_router
from app.api.schedules import router as schedules_router
from app.api.speakers import router as speakers_router
from app.api.statistics import router as statistics_router
from app.api.tickets import router as tickets_router
from app.core.config import get_settings
from app.db.init_db import init_db

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        init_db()
    except SQLAlchemyError:
        logger.exception("Database initialization failed")
    yield

app = FastAPI(
    title="Event Manager AI V2 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(rbac_router)
app.include_router(events_router)
app.include_router(speakers_router)
app.include_router(schedules_router)
app.include_router(registrations_router)
app.include_router(tickets_router)
app.include_router(checkins_router)
app.include_router(feedbacks_router)
app.include_router(statistics_router)
app.include_router(ai_feedback_router)
app.include_router(ai_announcements_router)
app.include_router(announcements_router)
app.include_router(attendee_events_router)
