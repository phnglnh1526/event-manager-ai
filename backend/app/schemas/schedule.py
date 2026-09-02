from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_time: datetime
    end_time: datetime
    location: str | None = Field(default=None, max_length=255)
    speaker_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ScheduleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    start_time: datetime | None = None
    end_time: datetime | None = None
    location: str | None = Field(default=None, max_length=255)
    speaker_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_fields(self):
        nullable_fields = {"description", "location", "speaker_id"}
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


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    speaker_id: int | None
    title: str
    description: str | None
    start_time: datetime
    end_time: datetime
    location: str | None
    created_at: datetime
    updated_at: datetime
