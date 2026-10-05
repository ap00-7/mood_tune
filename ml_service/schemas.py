import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Mood = Literal["happy", "sad", "energetic", "chill"]


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=2000)

    @field_validator("text", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("text must be a string")
        normalized = re.sub(r"\s+", " ", value).strip()
        if not normalized:
            raise ValueError("text must not be empty")
        return normalized


class PredictionResponse(BaseModel):
    emotion: str
    mood: Mood
    confidence: float = Field(ge=0, le=1)
    model: str


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_loaded: bool
