from math import isfinite
from typing import Any, Callable, Mapping, Sequence

from transformers import pipeline

from mood_mapping import map_emotion_to_mood

MODEL_ID = "j-hartmann/emotion-english-distilroberta-base"
MOODS = ("happy", "sad", "energetic", "chill")


def load_emotion_classifier() -> Callable[..., Any]:
    classifier = pipeline(
        "text-classification",
        model=MODEL_ID,
        top_k=None,
    )
    model_config = getattr(getattr(classifier, "model", None), "config", None)
    id2label = getattr(model_config, "id2label", None)
    if not isinstance(id2label, Mapping) or not id2label:
        raise RuntimeError("The emotion model configuration has no id2label mapping.")
    if any(not isinstance(label, str) or not label.strip() for label in id2label.values()):
        raise RuntimeError("The emotion model configuration contains an invalid emotion label.")
    return classifier


def aggregate_mood_affinities(
    emotion_scores: Sequence[Mapping[str, str | float]],
) -> dict[str, float]:
    affinities = {mood: 0.0 for mood in MOODS}
    for item in emotion_scores:
        emotion = item.get("emotion")
        score = item.get("score")
        if not isinstance(emotion, str) or not emotion.strip():
            raise ValueError("Emotion scores contain an invalid label.")
        if not isinstance(score, (int, float)) or not isfinite(score) or not 0 <= score <= 1:
            raise ValueError("Emotion scores contain an invalid probability.")
        affinities[map_emotion_to_mood(emotion)] += float(score)

    total = sum(affinities.values())
    if not isfinite(total) or total <= 0:
        raise ValueError("Emotion scores cannot produce mood affinities.")
    return {mood: score / total for mood, score in affinities.items()}


def _model_labels(classifier: Callable[..., Any]) -> set[str]:
    config = getattr(getattr(classifier, "model", None), "config", None)
    id2label = getattr(config, "id2label", None)
    if not isinstance(id2label, Mapping) or not id2label:
        raise ValueError("The loaded emotion model has no id2label mapping.")
    labels = {label for label in id2label.values() if isinstance(label, str) and label.strip()}
    if len(labels) != len(id2label):
        raise ValueError("The loaded emotion model has invalid id2label entries.")
    return labels


def _flatten_predictions(predictions: Any) -> list[dict[str, Any]]:
    if not isinstance(predictions, list):
        raise ValueError("The emotion model returned no predictions.")
    if len(predictions) == 1 and isinstance(predictions[0], list):
        predictions = predictions[0]
    if not predictions or any(not isinstance(item, dict) for item in predictions):
        raise ValueError("The emotion model returned an invalid prediction distribution.")
    return predictions


def predict_emotion(text: str, classifier: Callable[..., Any]) -> dict[str, Any]:
    predictions = _flatten_predictions(classifier(text, truncation=True, max_length=512, top_k=None))
    configured_labels = _model_labels(classifier)
    expected = {label.casefold(): label for label in configured_labels}
    emotion_scores: list[dict[str, str | float]] = []

    for prediction in predictions:
        label = prediction.get("label")
        score = prediction.get("score")
        if not isinstance(label, str) or label.casefold() not in expected:
            raise ValueError("The emotion model returned a label absent from its id2label configuration.")
        if not isinstance(score, (int, float)) or not isfinite(score) or not 0 <= score <= 1:
            raise ValueError("The emotion model returned a probability outside [0, 1].")
        emotion_scores.append({"emotion": expected[label.casefold()], "score": float(score)})

    if len(emotion_scores) != len(configured_labels):
        raise ValueError("The emotion model did not return its complete configured label distribution.")
    if len({item["emotion"].casefold() for item in emotion_scores}) != len(emotion_scores):
        raise ValueError("The emotion model returned duplicate labels.")
    if abs(sum(float(item["score"]) for item in emotion_scores) - 1.0) > 1e-4:
        raise ValueError("The emotion model returned probabilities that do not sum to one.")

    emotion_scores.sort(key=lambda item: float(item["score"]), reverse=True)
    emotion = str(emotion_scores[0]["emotion"])
    confidence = float(emotion_scores[0]["score"])
    return {
        "emotion": emotion,
        "emotion_scores": emotion_scores,
        "mood": map_emotion_to_mood(emotion),
        "mood_affinities": aggregate_mood_affinities(emotion_scores),
        "confidence": confidence,
        "model": MODEL_ID,
    }
