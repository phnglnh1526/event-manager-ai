from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

Rating = Annotated[int, Field(strict=True, ge=1, le=5)]


class FeedbackFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("comment", check_fields=False)
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class FeedbackCreate(FeedbackFields):
    rating: Rating
    comment: str | None = Field(default=None, max_length=2000)


class FeedbackUpdate(FeedbackFields):
    rating: Rating | None = None
    comment: str | None = Field(default=None, max_length=2000)


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    user_id: int
    rating: int
    comment: str | None
    created_at: datetime
    updated_at: datetime
