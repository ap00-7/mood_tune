import re
from math import isclose
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from mood_mapping import map_emotion_to_mood


Mood = Literal["happy", "sad", "energetic", "chill"]
ListeningIntentName = Literal["match_mood", "lift_me_up", "calm_me_down", "add_energy"]


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=2000)
    intent: ListeningIntentName | None = None

    @field_validator("text", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("text must be a string")
        normalized = re.sub(r"\s+", " ", value).strip()
        if not normalized:
            raise ValueError("text must not be empty")
        return normalized


class EmotionScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    emotion: str = Field(min_length=1)
    score: float = Field(ge=0, le=1, allow_inf_nan=False)


class MoodAffinities(BaseModel):
    model_config = ConfigDict(extra="forbid")

    happy: float = Field(ge=0, le=1, allow_inf_nan=False)
    sad: float = Field(ge=0, le=1, allow_inf_nan=False)
    energetic: float = Field(ge=0, le=1, allow_inf_nan=False)
    chill: float = Field(ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_total(self) -> "MoodAffinities":
        if not isclose(sum(self.model_dump().values()), 1.0, abs_tol=1e-6):
            raise ValueError("Mood affinities must sum to one.")
        return self


class PredictionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    emotion: str
    emotion_scores: list[EmotionScore] = Field(min_length=1)
    mood: Mood
    mood_affinities: MoodAffinities
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)
    model: str = Field(min_length=1)
    intent: ListeningIntentName | None = None

    @model_validator(mode="after")
    def validate_prediction_distribution(self) -> "PredictionResponse":
        scores = self.emotion_scores
        if any(left.score < right.score for left, right in zip(scores, scores[1:])):
            raise ValueError("Emotion scores must be sorted from highest to lowest.")
        if scores[0].emotion.casefold() != self.emotion.casefold():
            raise ValueError("The primary emotion must be the highest-scoring emotion.")
        if len({item.emotion.casefold() for item in scores}) != len(scores):
            raise ValueError("Emotion labels must be unique.")
        if not isclose(self.confidence, scores[0].score, rel_tol=0, abs_tol=1e-7):
            raise ValueError("Confidence must equal the top emotion score.")
        if not isclose(sum(item.score for item in scores), 1.0, abs_tol=1e-4):
            raise ValueError("Emotion probabilities must sum to one.")
        if map_emotion_to_mood(self.emotion) != self.mood:
            raise ValueError("The primary mood must match the existing emotion mapping.")
        expected_affinities = {"happy": 0.0, "sad": 0.0, "energetic": 0.0, "chill": 0.0}
        for item in scores:
            expected_affinities[map_emotion_to_mood(item.emotion)] += item.score
        total = sum(expected_affinities.values())
        for mood, score in expected_affinities.items():
            if not isclose(getattr(self.mood_affinities, mood), score / total, abs_tol=1e-6):
                raise ValueError("Mood affinities must match the mapped emotion distribution.")
        return self


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_loaded: bool
