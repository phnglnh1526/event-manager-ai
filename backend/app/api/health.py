from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.database import engine

router = APIRouter(prefix="/api/health", tags=["Health"])
settings = get_settings()


@router.get("")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.app_name,
    }


@router.get("/database")
def database_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "database": "connected",
        }
    except SQLAlchemyError:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "database": "disconnected",
                "detail": "Database connection failed",
            },
        )
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "database": "disconnected",
                "detail": "Unexpected database health-check error",
            },
        )
