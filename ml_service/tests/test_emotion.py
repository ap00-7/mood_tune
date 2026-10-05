import unittest

from emotion import MODEL_ID, predict_emotion
from mood_mapping import EMOTION_TO_MOOD, map_emotion_to_mood
from schemas import PredictionRequest


class EmotionServiceTests(unittest.TestCase):
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

    def test_prediction_uses_model_label_and_score(self) -> None:
        calls: list[tuple[str, dict[str, object]]] = []

        def classifier(text: str, **kwargs: object) -> list[list[dict[str, str | float]]]:
            calls.append((text, kwargs))
            return [[{"label": "JOY", "score": 0.937}]]

        result = predict_emotion("I feel good", classifier)

        self.assertEqual(result["emotion"], "joy")
        self.assertEqual(result["mood"], "happy")
        self.assertEqual(result["confidence"], 0.937)
        self.assertEqual(result["model"], MODEL_ID)
        self.assertEqual(calls, [("I feel good", {"truncation": True, "max_length": 512})])


if __name__ == "__main__":
    unittest.main()
