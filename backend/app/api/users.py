import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.core.roles import ROLE_ADMIN
from app.core.security import hash_password
from app.db.database import get_db
from app.models import User
from app.schemas.user import AdminPasswordReset, AdminUserCreate, AdminUserUpdate, PasswordResetResponse, UserResponse

router = APIRouter(prefix="/api/admin/users", tags=["Admin Users"])
logger = logging.getLogger(__name__)
admin_only = require_roles(ROLE_ADMIN)


def _database_error(db: Session, operation: str) -> HTTPException:
    db.rollback()
    logger.exception("User administration database operation failed: %s", operation)
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User administration database operation failed")


@router.get("", response_model=list[UserResponse])
def list_users(_: User = Depends(admin_only), db: Session = Depends(get_db)) -> list[User]:
    try:
        return list(db.scalars(select(User).order_by(User.created_at.desc(), User.id.desc())).all())
    except SQLAlchemyError:
        raise _database_error(db, "list") from None


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: AdminUserCreate, _: User = Depends(admin_only), db: Session = Depends(get_db)) -> User:
    user = User(full_name=payload.full_name, email=str(payload.email), password_hash=hash_password(payload.password), role=payload.role, is_active=payload.is_active)
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from None
    except SQLAlchemyError:
        raise _database_error(db, "create") from None


@router.post("/{user_id}/reset-password", response_model=PasswordResetResponse)
def reset_user_password(
    user_id: int,
    payload: AdminPasswordReset,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> PasswordResetResponse:
    try:
        user = db.scalar(select(User).where(User.id == user_id).with_for_update())
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.password_hash = hash_password(payload.new_password)
        db.commit()
        return PasswordResetResponse(message="Password updated successfully")
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        raise _database_error(db, "reset password") from None


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, payload: AdminUserUpdate, current_user: User = Depends(admin_only), db: Session = Depends(get_db)) -> User:
    try:
        user = db.scalar(select(User).where(User.id == user_id).with_for_update())
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        changes = payload.model_dump(exclude_unset=True)
        if user.id == current_user.id:
            if changes.get("is_active") is False:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot deactivate your own account")
            if changes.get("role", user.role) != ROLE_ADMIN:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot remove your own ADMIN role")
        resulting_role = changes.get("role", user.role)
        resulting_active = changes.get("is_active", user.is_active)
        if user.role == ROLE_ADMIN and user.is_active and (resulting_role != ROLE_ADMIN or not resulting_active):
            active_admin_ids = db.scalars(
                select(User.id)
                .where(User.role == ROLE_ADMIN, User.is_active.is_(True))
                .order_by(User.id)
                .with_for_update()
            ).all()
            if len(active_admin_ids) <= 1:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The last active ADMIN cannot be deactivated or demoted")
        for field_name, value in changes.items():
            setattr(user, field_name, str(value) if field_name == "email" else value)
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from None
    except SQLAlchemyError:
        raise _database_error(db, "update") from None
