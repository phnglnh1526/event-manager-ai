from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.ticket_status import TICKET_STATUS_ACTIVE
from app.db.base import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    registration_id: Mapped[int] = mapped_column(
        ForeignKey("registrations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    ticket_code: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=TICKET_STATUS_ACTIVE,
        server_default=TICKET_STATUS_ACTIVE,
    )
    issued_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    registration = relationship("Registration", back_populates="ticket")
    checkin = relationship("CheckIn", back_populates="ticket", uselist=False)
