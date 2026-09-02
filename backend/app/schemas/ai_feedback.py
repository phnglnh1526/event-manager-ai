from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AIInsightContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=2000)
    strengths: list[str] = Field(max_length=5)
    issues: list[str] = Field(max_length=5)
    suggestions: list[str] = Field(max_length=5)

    @field_validator("summary")
    @classmethod
    def normalize_summary(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("summary cannot be empty")
        return normalized

    @field_validator("strengths", "issues", "suggestions")
    @classmethod
    def normalize_items(cls, values: list[str]) -> list[str]:
        normalized = [" ".join(item.split()) for item in values]
        if any(not item for item in normalized):
            raise ValueError("list items cannot be empty")
        return normalized


class AIFeedbackSummaryResponse(AIInsightContent):
    event_id: int
    feedback_count: int
    analyzed_comment_count: int
    average_rating: float
    source: Literal["mock", "openai"]
