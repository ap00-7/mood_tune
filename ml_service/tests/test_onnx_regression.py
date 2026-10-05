import os
import unittest

from emotion import load_emotion_classifier, predict_emotion


BASELINE = [
    {
        "text": "I had an amazing day with my friends.",
        "top": "joy",
        "scores": [0.0010649324, 0.0005842340, 0.0013936700, 0.9749359488, 0.0039963238, 0.0022937809, 0.0157312248],
    },
    {
        "text": "I feel exhausted and sad today.",
        "top": "sadness",
        "scores": [0.0008958346, 0.0022030352, 0.0010211797, 0.0008290901, 0.0049033365, 0.9881269336, 0.0020205635],
    },
    {
        "text": "I am nervous about tomorrow.",
        "top": "fear",
        "scores": [0.0006082644, 0.0006024617, 0.9941511750, 0.0012911118, 0.0011423343, 0.0014738034, 0.0007308805],
    },
    {
        "text": "Everything feels calm and peaceful.",
        "top": "joy",
        "scores": [0.0124857994, 0.0157425348, 0.0028561407, 0.6963000298, 0.2472532690, 0.0216800496, 0.0036821959],
    },
    {
        "text": "I am extremely angry right now.",
        "top": "anger",
        "scores": [0.9837634563, 0.0032477693, 0.0033485966, 0.0005805248, 0.0048426846, 0.0026377840, 0.0015791107],
    },
]
LABELS = ("anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise")
MAX_ABSOLUTE_PROBABILITY_DIFFERENCE = 0.03


@unittest.skipUnless(
    os.getenv("MOODTUNE_RUN_MODEL_REGRESSION") == "1",
    "Set MOODTUNE_RUN_MODEL_REGRESSION=1 to compare the pinned model artifact.",
)
class OnnxAgainstPyTorchRegressionTests(unittest.TestCase):
    def test_int8_distribution_matches_recorded_pytorch_baseline(self) -> None:
        classifier = load_emotion_classifier("onnx")
        for reference in BASELINE:
            with self.subTest(text=reference["text"]):
                result = predict_emotion(reference["text"], classifier)
                actual = {item["emotion"]: item["score"] for item in result["emotion_scores"]}
                self.assertEqual(set(actual), set(LABELS))
                self.assertEqual(result["emotion"], reference["top"])
                self.assertLessEqual(
                    max(
                        abs(actual[label] - expected)
                        for label, expected in zip(LABELS, reference["scores"])
                    ),
                    MAX_ABSOLUTE_PROBABILITY_DIFFERENCE,
                )


if __name__ == "__main__":
    unittest.main()
