import json
import os
from math import isfinite
from pathlib import Path
from typing import Any, Mapping, Protocol, Sequence

import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from tokenizers import Tokenizer

from mood_mapping import map_emotion_to_mood

MODEL_ID = "j-hartmann/emotion-english-distilroberta-base"
ONNX_MODEL_ID = "onnx-community/emotion-english-distilroberta-base-ONNX"
ONNX_MODEL_REVISION = "f4407dc20b99ae081ab2e4f089595e70c1609f59"
ONNX_MODEL_FILE = "onnx/model_int8.onnx"
MODEL_MAX_LENGTH = 512
EXPECTED_LABELS = frozenset(
    {"anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"}
)
MOODS = ("happy", "sad", "energetic", "chill")


class EmotionClassifier(Protocol):
    id2label: Mapping[int, str]

    def predict(self, text: str) -> list[dict[str, Any]]: ...


def _validated_id2label(value: object, *, require_expected: bool = False) -> dict[int, str]:
    if not isinstance(value, Mapping) or not value:
        raise RuntimeError("The emotion model configuration has no id2label mapping.")

    labels: dict[int, str] = {}
    for raw_index, label in value.items():
        try:
            index = int(raw_index)
        except (TypeError, ValueError) as error:
            raise RuntimeError("The emotion model configuration has an invalid label index.") from error
        if not isinstance(label, str) or not label.strip() or index in labels:
            raise RuntimeError("The emotion model configuration contains an invalid emotion label.")
        labels[index] = label

    if sorted(labels) != list(range(len(labels))):
        raise RuntimeError("The emotion model label indices must be contiguous from zero.")
    if require_expected and {label.casefold() for label in labels.values()} != EXPECTED_LABELS:
        raise RuntimeError("The ONNX model must contain the original seven emotion labels.")
    return dict(sorted(labels.items()))


class TransformersEmotionClassifier:
    def __init__(self, classifier: Any) -> None:
        config = getattr(getattr(classifier, "model", None), "config", None)
        self.id2label = _validated_id2label(getattr(config, "id2label", None))
        self.classifier = classifier

    def predict(self, text: str) -> list[dict[str, Any]]:
        predictions = self.classifier(
            text,
            truncation=True,
            max_length=MODEL_MAX_LENGTH,
            top_k=None,
        )
        return _flatten_predictions(predictions)


class OnnxEmotionClassifier:
    def __init__(
        self,
        session: Any,
        tokenizer: Tokenizer,
        id2label: Mapping[int, str],
    ) -> None:
        self.session = session
        self.tokenizer = tokenizer
        self.id2label = dict(id2label)

        inputs = {item.name: item for item in session.get_inputs()}
        if set(inputs) != {"input_ids", "attention_mask"}:
            raise RuntimeError("The ONNX model has an unsupported input contract.")
        if any(item.type != "tensor(int64)" for item in inputs.values()):
            raise RuntimeError("The ONNX model inputs must use int64 tensors.")

        outputs = session.get_outputs()
        if len(outputs) != 1 or outputs[0].name != "logits":
            raise RuntimeError("The ONNX model has an unsupported output contract.")
        if (
            outputs[0].type != "tensor(float)"
            or len(outputs[0].shape) != 2
            or outputs[0].shape[-1] != len(self.id2label)
        ):
            raise RuntimeError("The ONNX model output does not match its emotion labels.")
        self.logits_name = outputs[0].name

    @classmethod
    def from_pretrained(cls) -> "OnnxEmotionClassifier":
        config_path = hf_hub_download(
            repo_id=ONNX_MODEL_ID,
            filename="config.json",
            revision=ONNX_MODEL_REVISION,
        )
        tokenizer_path = hf_hub_download(
            repo_id=ONNX_MODEL_ID,
            filename="tokenizer.json",
            revision=ONNX_MODEL_REVISION,
        )
        model_path = hf_hub_download(
            repo_id=ONNX_MODEL_ID,
            filename=ONNX_MODEL_FILE,
            revision=ONNX_MODEL_REVISION,
        )

        with Path(config_path).open(encoding="utf-8") as config_file:
            config = json.load(config_file)
        if (
            config.get("_name_or_path") != MODEL_ID
            or config.get("model_type") != "roberta"
            or "RobertaForSequenceClassification" not in config.get("architectures", [])
        ):
            raise RuntimeError("The ONNX artifact is not the expected source model architecture.")
        id2label = _validated_id2label(config.get("id2label"), require_expected=True)

        tokenizer = Tokenizer.from_file(tokenizer_path)
        tokenizer.no_padding()
        tokenizer.enable_truncation(max_length=MODEL_MAX_LENGTH)

        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(
            model_path,
            sess_options=options,
            providers=["CPUExecutionProvider"],
        )
        if session.get_providers() != ["CPUExecutionProvider"]:
            raise RuntimeError("The ONNX model did not initialize with the CPU provider only.")
        return cls(session, tokenizer, id2label)

    def predict(self, text: str) -> list[dict[str, Any]]:
        encoding = self.tokenizer.encode(text)
        input_ids = np.asarray([encoding.ids], dtype=np.int64)
        attention_mask = np.asarray([encoding.attention_mask], dtype=np.int64)
        logits = np.asarray(
            self.session.run(
                [self.logits_name],
                {"input_ids": input_ids, "attention_mask": attention_mask},
            )[0],
            dtype=np.float64,
        )
        if logits.shape != (1, len(self.id2label)) or not np.isfinite(logits).all():
            raise ValueError("The ONNX model returned malformed logits.")

        shifted = logits[0] - np.max(logits[0])
        exponentials = np.exp(shifted)
        total = float(np.sum(exponentials))
        if not isfinite(total) or total <= 0:
            raise ValueError("The ONNX model returned logits that cannot be normalized.")
        probabilities = exponentials / total
        if not np.isfinite(probabilities).all() or np.any(probabilities < 0) or np.any(probabilities > 1):
            raise ValueError("The ONNX model returned invalid probabilities.")

        return [
            {"label": self.id2label[index], "score": float(probabilities[index])}
            for index in range(len(self.id2label))
        ]


def load_emotion_classifier(backend: str | None = None) -> EmotionClassifier:
    selected_backend = (backend or os.getenv("ML_INFERENCE_BACKEND", "onnx")).strip().casefold()
    if selected_backend == "onnx":
        return OnnxEmotionClassifier.from_pretrained()
    if selected_backend == "pytorch":
        from transformers import pipeline

        return TransformersEmotionClassifier(
            pipeline("text-classification", model=MODEL_ID, top_k=None)
        )
    raise RuntimeError("ML_INFERENCE_BACKEND must be either 'onnx' or 'pytorch'.")


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


def _flatten_predictions(predictions: Any) -> list[dict[str, Any]]:
    if not isinstance(predictions, list):
        raise ValueError("The emotion model returned no predictions.")
    if len(predictions) == 1 and isinstance(predictions[0], list):
        predictions = predictions[0]
    if not predictions or any(not isinstance(item, dict) for item in predictions):
        raise ValueError("The emotion model returned an invalid prediction distribution.")
    return predictions


def _model_labels(classifier: EmotionClassifier) -> dict[str, str]:
    labels = _validated_id2label(classifier.id2label)
    return {label.casefold(): label for label in labels.values()}


def predict_emotion(text: str, classifier: EmotionClassifier) -> dict[str, Any]:
    predictions = _flatten_predictions(classifier.predict(text))
    expected = _model_labels(classifier)
    emotion_scores: list[dict[str, str | float]] = []

    for prediction in predictions:
        label = prediction.get("label")
        score = prediction.get("score")
        if not isinstance(label, str) or label.casefold() not in expected:
            raise ValueError("The emotion model returned a label absent from its id2label configuration.")
        if not isinstance(score, (int, float)) or not isfinite(score) or not 0 <= score <= 1:
            raise ValueError("The emotion model returned a probability outside [0, 1].")
        emotion_scores.append({"emotion": expected[label.casefold()], "score": float(score)})

    if len(emotion_scores) != len(expected):
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
