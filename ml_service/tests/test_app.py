import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app
from emotion import MODEL_ID


class FakeClassifier:
    def __init__(self, label: str = "joy") -> None:
        self.label = label
        self.id2label = {
            0: "anger",
            1: "disgust",
            2: "fear",
            3: "joy",
            4: "neutral",
            5: "sadness",
            6: "surprise",
        }

    def predict(self, _text: str) -> list[dict[str, str | float]]:
        return [
            {"label": self.label, "score": 0.72},
            {"label": "disgust", "score": 0.01},
            {"label": "fear", "score": 0.04},
            {"label": "neutral", "score": 0.08},
            {"label": "sadness", "score": 0.06},
            {"label": "surprise", "score": 0.04},
            {"label": "anger", "score": 0.05},
        ]


class PredictionEndpointTests(unittest.TestCase):
    def test_health_reports_loaded_model(self) -> None:
        with patch("app.load_emotion_classifier", return_value=FakeClassifier()):
            with TestClient(app) as client:
                response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "model_loaded": True})

    def test_predict_returns_full_distribution_and_explicit_intent(self) -> None:
        with patch("app.load_emotion_classifier", return_value=FakeClassifier()):
            with TestClient(app) as client:
                response = client.post(
                    "/predict",
                    json={"text": "I feel good", "intent": "lift_me_up"},
                )

        self.assertEqual(response.status_code, 200)
        prediction = response.json()
        self.assertEqual(prediction["emotion"], "joy")
        self.assertEqual(len(prediction["emotion_scores"]), 7)
        self.assertEqual(prediction["emotion_scores"][0], {"emotion": "joy", "score": 0.72})
        self.assertEqual(prediction["confidence"], prediction["emotion_scores"][0]["score"])
        self.assertEqual(prediction["mood"], "happy")
        self.assertEqual(prediction["model"], MODEL_ID)
        self.assertEqual(prediction["intent"], "lift_me_up")

    def test_predict_rejects_malformed_model_distribution_as_unavailable(self) -> None:
        with patch("app.load_emotion_classifier", return_value=FakeClassifier("unconfigured")):
            with TestClient(app) as client:
                response = client.post("/predict", json={"text": "I feel good"})

        self.assertEqual(response.status_code, 503)
        self.assertIn("temporarily unavailable", response.json()["detail"])

    def test_predict_preserves_request_validation_error_handling(self) -> None:
        with patch("app.load_emotion_classifier", return_value=FakeClassifier()):
            with TestClient(app) as client:
                response = client.post(
                    "/predict",
                    json={"text": "I feel good", "intent": "infer_from_text"},
                )

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
