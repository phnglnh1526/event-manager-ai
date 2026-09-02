import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.core.roles import ALL_ROLES
from app.db.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def _invalid_token_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except (ExpiredSignatureError, InvalidTokenError):
        raise _invalid_token_error() from None

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise _invalid_token_error() from None

    try:
        user = db.scalar(select(User).where(User.id == user_id))
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Failed to load current user")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not authenticate user",
        ) from None

    if user is None:
        raise _invalid_token_error()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


def require_roles(*allowed_roles: str):
    allowed = set(allowed_roles)

    def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in ALL_ROLES:
            logger.warning("Invalid user role encountered")

        if current_user.role not in ALL_ROLES or current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return current_user

    return dependency
