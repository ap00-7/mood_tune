import unittest
import sys
from types import ModuleType
from unittest.mock import Mock, patch

from emotion import MODEL_ID, aggregate_mood_affinities, load_emotion_classifier, predict_emotion
from mood_mapping import EMOTION_TO_MOOD, map_emotion_to_mood
from schemas import PredictionRequest, PredictionResponse


class EmotionServiceTests(unittest.TestCase):
    labels = {
        0: "anger",
        1: "disgust",
        2: "fear",
        3: "joy",
        4: "neutral",
        5: "sadness",
        6: "surprise",
    }

    class Classifier:
        def __init__(self, predictions: list[dict[str, str | float]], labels: dict[int, str] | None = None):
            self.predictions = predictions
            self.id2label = labels or EmotionServiceTests.labels

        def predict(self, _text: str) -> list[dict[str, str | float]]:
            return self.predictions

    def full_distribution(self) -> list[dict[str, str | float]]:
        return [
            {"label": "anger", "score": 0.05},
            {"label": "disgust", "score": 0.01},
            {"label": "fear", "score": 0.04},
            {"label": "joy", "score": 0.72},
            {"label": "neutral", "score": 0.08},
            {"label": "sadness", "score": 0.06},
            {"label": "surprise", "score": 0.04},
        ]

    def test_original_mapping_is_preserved(self) -> None:
        self.assertEqual(len(EMOTION_TO_MOOD), 110)
        self.assertEqual(map_emotion_to_mood("joy"), "happy")
        self.assertEqual(map_emotion_to_mood("panic attack"), "sad")
        self.assertEqual(map_emotion_to_mood("unrecognized"), "chill")

    def test_request_normalizes_whitespace(self) -> None:
        request = PredictionRequest(text=" \tI feel   amazing\n today ")
        self.assertEqual(request.text, "I feel amazing today")

    def test_request_rejects_blank_or_oversized_text(self) -> None:
        with self.assertRaises(ValueError):
            PredictionRequest(text="   \n\t")
        with self.assertRaises(ValueError):
            PredictionRequest(text="a" * 2001)

    def test_intent_is_optional_and_invalid_intent_is_rejected(self) -> None:
        self.assertIsNone(PredictionRequest(text="I feel good").intent)
        self.assertEqual(PredictionRequest(text="I feel good", intent="lift_me_up").intent, "lift_me_up")
        with self.assertRaises(ValueError):
            PredictionRequest(text="I feel good", intent="infer_it")

    def test_full_model_distribution_is_valid_sorted_and_uses_configured_labels(self) -> None:
        classifier = self.Classifier(self.full_distribution())
        result = predict_emotion("I feel good", classifier)

        self.assertEqual(result["emotion"], "joy")
        self.assertEqual(result["mood"], "happy")
        self.assertEqual(result["confidence"], 0.72)
        self.assertEqual(result["model"], MODEL_ID)
        self.assertEqual(result["emotion_scores"][0], {"emotion": "joy", "score": 0.72})
        self.assertEqual({item["emotion"] for item in result["emotion_scores"]}, set(self.labels.values()))
        self.assertEqual(result["mood_affinities"]["happy"], 0.72)
        self.assertAlmostEqual(sum(result["mood_affinities"].values()), 1.0)
        self.assertEqual(
            [item["score"] for item in result["emotion_scores"]],
            sorted((item["score"] for item in result["emotion_scores"]), reverse=True),
        )
        self.assertTrue(all(0 <= item["score"] <= 1 for item in result["emotion_scores"]))
        self.assertEqual(result["confidence"], result["emotion_scores"][0]["score"])

    def test_prediction_rejects_unknown_labels_instead_of_guessing(self) -> None:
        classifier = self.Classifier(
            [{"label": "new-label", "score": 1.0}],
        )
        with self.assertRaisesRegex(ValueError, "absent from its id2label"):
            predict_emotion("text", classifier)

    def test_prediction_rejects_invalid_and_incomplete_distributions(self) -> None:
        invalid = self.full_distribution()
        invalid[0] = {"label": "anger", "score": float("nan")}
        with self.assertRaisesRegex(ValueError, "probability"):
            predict_emotion("text", self.Classifier(invalid))

        with self.assertRaisesRegex(ValueError, "complete configured"):
            predict_emotion("text", self.Classifier(self.full_distribution()[:-1]))

    def test_unmapped_configured_emotion_uses_existing_chill_fallback(self) -> None:
        result = predict_emotion(
            "text",
            self.Classifier(
                [{"label": "unrecognized", "score": 1.0}],
                labels={0: "unrecognized"},
            ),
        )
        self.assertEqual(result["mood"], "chill")
        self.assertEqual(result["mood_affinities"], {"happy": 0, "sad": 0, "energetic": 0, "chill": 1})

    def test_mood_affinities_aggregate_and_normalize_mapped_scores(self) -> None:
        affinities = aggregate_mood_affinities(
            [{"emotion": "joy", "score": 0.6}, {"emotion": "surprise", "score": 0.4}]
        )
        self.assertEqual(affinities["happy"], 0.6)
        self.assertEqual(affinities["energetic"], 0.4)
        self.assertAlmostEqual(sum(affinities.values()), 1.0)

    def test_prediction_response_enforces_top_score_order_and_confidence(self) -> None:
        result = predict_emotion("text", self.Classifier(self.full_distribution()))
        PredictionResponse(**result)
        result["confidence"] = 0.1
        with self.assertRaises(ValueError):
            PredictionResponse(**result)

    def test_classifier_load_uses_full_distribution_and_configured_model_labels(self) -> None:
        classifier = self.Classifier(self.full_distribution())
        fake_transformers = ModuleType("transformers")
        mocked_pipeline = Mock(return_value=type(
            "Pipeline",
            (),
            {
                "model": type(
                    "Model",
                    (),
                    {"config": type("Config", (), {"id2label": self.labels})()},
                )(),
                "__call__": lambda _self, _text, **kwargs: (
                    setattr(classifier, "pipeline_kwargs", kwargs) or classifier.predictions
                ),
            },
        )())
        fake_transformers.pipeline = mocked_pipeline  # type: ignore[attr-defined]
        with patch.dict(sys.modules, {"transformers": fake_transformers}):
            loaded = load_emotion_classifier("pytorch")
            result = predict_emotion("I feel good", loaded)

        mocked_pipeline.assert_called_once_with(
            "text-classification",
            model=MODEL_ID,
            top_k=None,
        )
        self.assertEqual(result["emotion"], "joy")
        self.assertEqual(
            classifier.pipeline_kwargs,
            {"truncation": True, "max_length": 512, "top_k": None},
        )

    def test_invalid_backend_is_rejected(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "ML_INFERENCE_BACKEND"):
            load_emotion_classifier("keyword")


if __name__ == "__main__":
    unittest.main()
