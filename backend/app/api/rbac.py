from fastapi import APIRouter, Depends

from app.api.dependencies import require_roles
from app.core.roles import (
    ROLE_ADMIN,
    ROLE_ATTENDEE,
    ROLE_ORGANIZER,
    ROLE_STAFF,
)
from app.models import User

# RBAC verification endpoints. Business endpoints will reuse these dependencies.
router = APIRouter(prefix="/api/rbac", tags=["RBAC Verification"])


@router.get("/admin")
def verify_admin_access(
    _: User = Depends(require_roles(ROLE_ADMIN)),
) -> dict[str, str]:
    return {"status": "ok", "access": "admin"}


@router.get("/organizer")
def verify_organizer_access(
    _: User = Depends(require_roles(ROLE_ADMIN, ROLE_ORGANIZER)),
) -> dict[str, str]:
    return {"status": "ok", "access": "organizer"}


@router.get("/staff")
def verify_staff_access(
    _: User = Depends(require_roles(ROLE_ADMIN, ROLE_ORGANIZER, ROLE_STAFF)),
) -> dict[str, str]:
    return {"status": "ok", "access": "staff"}


@router.get("/authenticated")
def verify_authenticated_access(
    _: User = Depends(
        require_roles(ROLE_ADMIN, ROLE_ORGANIZER, ROLE_STAFF, ROLE_ATTENDEE)
    ),
) -> dict[str, str]:
    return {"status": "ok", "access": "authenticated"}
