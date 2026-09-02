from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registration_id: int
    ticket_code: str
    status: str
    issued_at: datetime
    updated_at: datetime
