from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CheckInRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticket_code: str = Field(min_length=1, max_length=64)

    @field_validator("ticket_code")
    @classmethod
    def normalize_ticket_code(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("ticket_code must not be empty")
        return normalized


class CheckInResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    checked_in_by_user_id: int | None
    checked_in_at: datetime

class CheckInEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    location: str
    start_time: datetime
    end_time: datetime
    status: str
