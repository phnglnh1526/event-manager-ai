from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.registration_status import REGISTRATION_STATUS_REGISTERED
from app.db.base import Base


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "user_id",
            name="uq_registrations_event_user",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=REGISTRATION_STATUS_REGISTERED,
        server_default=REGISTRATION_STATUS_REGISTERED,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    event = relationship("Event")
    user = relationship("User")
    ticket = relationship("Ticket", back_populates="registration", uselist=False)
