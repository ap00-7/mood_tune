from math import isfinite
from typing import Any, Callable

from transformers import pipeline

from mood_mapping import map_emotion_to_mood

MODEL_ID = "j-hartmann/emotion-english-distilroberta-base"


def load_emotion_classifier() -> Callable[..., Any]:
    return pipeline(
        "text-classification",
        model=MODEL_ID,
        top_k=1,
    )


def predict_emotion(text: str, classifier: Callable[..., Any]) -> dict[str, str | float]:
    predictions = classifier(text, truncation=True, max_length=512)
    if predictions and isinstance(predictions[0], list):
        predictions = predictions[0]
    if not predictions or not isinstance(predictions[0], dict):
        raise ValueError("The emotion model returned no predictions.")

    prediction = predictions[0]
    emotion = prediction.get("label")
    confidence = prediction.get("score")
    if not isinstance(emotion, str) or not emotion.strip():
        raise ValueError("The emotion model returned an invalid label.")
    if not isinstance(confidence, (int, float)) or not isfinite(confidence):
        raise ValueError("The emotion model returned an invalid confidence score.")
    if confidence < 0 or confidence > 1:
        raise ValueError("The emotion model returned a confidence score outside [0, 1].")

    normalized_emotion = emotion.lower()
    return {
        "emotion": normalized_emotion,
        "mood": map_emotion_to_mood(normalized_emotion),
        "confidence": float(confidence),
        "model": MODEL_ID,
    }
