from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.announcement_status import (
    ALL_ANNOUNCEMENT_STATUSES,
    ANNOUNCEMENT_STATUS_DRAFT,
)


class AnnouncementFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("status", check_fields=False)
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in ALL_ANNOUNCEMENT_STATUSES:
            raise ValueError("Invalid announcement status")
        return value


class AnnouncementCreate(AnnouncementFields):
    title: str = Field(min_length=3, max_length=200)
    content: str = Field(min_length=1, max_length=5000)
    status: str = ANNOUNCEMENT_STATUS_DRAFT


class AnnouncementUpdate(AnnouncementFields):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    status: str | None = None

    @field_validator("status")
    @classmethod
    def validate_optional_status(cls, value: str | None) -> str | None:
        if value is not None and value not in ALL_ANNOUNCEMENT_STATUSES:
            raise ValueError("Invalid announcement status")
        return value

    @model_validator(mode="after")
    def reject_explicit_nulls(self):
        for field_name in self.model_fields_set:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    created_by_user_id: int | None
    title: str
    content: str
    status: str
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
