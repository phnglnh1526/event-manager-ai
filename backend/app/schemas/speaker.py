from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SpeakerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str = Field(min_length=2, max_length=150)
    title: str | None = Field(default=None, max_length=150)
    organization: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=5000)
    email: EmailStr | None = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


class SpeakerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    title: str | None = Field(default=None, max_length=150)
    organization: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=5000)
    email: EmailStr | None = None

    @field_validator("full_name")
    @classmethod
    def full_name_cannot_be_null(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("full_name cannot be null")
        return value

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


class SpeakerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    full_name: str
    title: str | None
    organization: str | None
    bio: str | None
    email: EmailStr | None
    created_at: datetime
    updated_at: datetime
