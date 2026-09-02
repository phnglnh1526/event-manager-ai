from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.event_status import ALL_EVENT_STATUSES, EVENT_STATUS_DRAFT


class EventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    location: str = Field(min_length=2, max_length=255)
    start_time: datetime
    end_time: datetime
    status: str = EVENT_STATUS_DRAFT
    max_attendees: int = Field(default=100, gt=0, le=100000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in ALL_EVENT_STATUSES:
            raise ValueError("Invalid event status")
        return value

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    location: str | None = Field(default=None, min_length=2, max_length=255)
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = None
    max_attendees: int | None = Field(default=None, gt=0, le=100000)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is not None and value not in ALL_EVENT_STATUSES:
            raise ValueError("Invalid event status")
        return value

    @model_validator(mode="after")
    def validate_fields(self):
        nullable_fields = {"description"}
        for field_name in self.model_fields_set - nullable_fields:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")

        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    location: str
    start_time: datetime
    end_time: datetime
    status: str
    max_attendees: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

class AttendeeEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str | None
    location: str
    start_time: datetime
    end_time: datetime
    status: str
    max_attendees: int
