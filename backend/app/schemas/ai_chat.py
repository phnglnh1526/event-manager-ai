from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    question: str = Field(min_length=3, max_length=500)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("question must contain at least 3 characters")
        return normalized


class EventChatContent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    answer: str = Field(min_length=1, max_length=5000)

    @field_validator("answer")
    @classmethod
    def require_plain_text(cls, value: str) -> str:
        if "<" in value or ">" in value:
            raise ValueError("AI chat output must be plain text")
        return value


class EventChatResponse(EventChatContent):
    event_id: int = Field(gt=0)
    source: Literal["mock", "openai"]
