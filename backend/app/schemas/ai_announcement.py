from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AIAnnouncementTone = Literal["PROFESSIONAL", "FRIENDLY", "URGENT"]


class AIAnnouncementDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    purpose: str = Field(min_length=5, max_length=500)
    key_points: list[str] = Field(default_factory=list, max_length=10)
    tone: AIAnnouncementTone = "PROFESSIONAL"

    @field_validator("key_points")
    @classmethod
    def validate_key_points(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            item = value.strip()
            if not item:
                raise ValueError("key points cannot be empty")
            if len(item) > 300:
                raise ValueError("each key point must be at most 300 characters")
            normalized.append(item)
        return normalized


class AIAnnouncementContent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=200)
    content: str = Field(min_length=1, max_length=5000)

    @field_validator("title", "content")
    @classmethod
    def require_plain_text(cls, value: str) -> str:
        if "<" in value or ">" in value:
            raise ValueError("AI announcement output must be plain text")
        return value


class AIAnnouncementDraftResponse(AIAnnouncementContent):
    event_id: int
    tone: AIAnnouncementTone
    source: Literal["mock", "openai"]
