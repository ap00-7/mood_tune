import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np

from emotion import (
    EXPECTED_LABELS,
    ONNX_MODEL_FILE,
    ONNX_MODEL_ID,
    ONNX_MODEL_REVISION,
    OnnxEmotionClassifier,
    load_emotion_classifier,
    predict_emotion,
)


class FakeTokenizer:
    def __init__(self) -> None:
        self.no_padding_called = False
        self.truncation_length: int | None = None

    def no_padding(self) -> None:
        self.no_padding_called = True

    def enable_truncation(self, *, max_length: int) -> None:
        self.truncation_length = max_length

    def encode(self, _text: str) -> object:
        return type("Encoding", (), {"ids": [0, 7, 2], "attention_mask": [1, 1, 1]})()


class FakeSession:
    def __init__(self, logits: np.ndarray | None = None) -> None:
        self.logits = np.asarray(
            logits if logits is not None else [[0, 0, 0, 4, 0, 0, 0]],
            dtype=np.float32,
        )
        self.input_values = [
            type("Input", (), {"name": "input_ids", "type": "tensor(int64)"})(),
            type("Input", (), {"name": "attention_mask", "type": "tensor(int64)"})(),
        ]
        self.output_values = [
            type(
                "Output",
                (),
                {"name": "logits", "type": "tensor(float)", "shape": ["batch_size", 7]},
            )()
        ]
        self.seen_inputs: dict[str, np.ndarray] | None = None

    def get_inputs(self) -> list[object]:
        return self.input_values

    def get_outputs(self) -> list[object]:
        return self.output_values

    def get_providers(self) -> list[str]:
        return ["CPUExecutionProvider"]

    def run(self, _outputs: list[str], inputs: dict[str, np.ndarray]) -> list[np.ndarray]:
        self.seen_inputs = inputs
        return [self.logits]


class OnnxBackendTests(unittest.TestCase):
    labels = {
        0: "anger",
        1: "disgust",
        2: "fear",
        3: "joy",
        4: "neutral",
        5: "sadness",
        6: "surprise",
    }

    def create_classifier(self, logits: np.ndarray | None = None) -> tuple[OnnxEmotionClassifier, FakeSession]:
        session = FakeSession(logits)
        tokenizer = FakeTokenizer()
        return OnnxEmotionClassifier(session, tokenizer, self.labels), session

    def test_onnx_outputs_all_seven_sorted_probabilities_and_existing_mood_signals(self) -> None:
        classifier, session = self.create_classifier()
        result = predict_emotion("I feel good", classifier)

        self.assertEqual(result["emotion"], "joy")
        self.assertEqual(result["mood"], "happy")
        self.assertEqual(len(result["emotion_scores"]), 7)
        self.assertEqual(
            {item["emotion"] for item in result["emotion_scores"]},
            EXPECTED_LABELS,
        )
        self.assertEqual(result["confidence"], result["emotion_scores"][0]["score"])
        self.assertAlmostEqual(sum(item["score"] for item in result["emotion_scores"]), 1.0)
        self.assertTrue(
            all(0 <= item["score"] <= 1 for item in result["emotion_scores"])
        )
        self.assertEqual(session.seen_inputs["input_ids"].dtype, np.int64)
        self.assertEqual(session.seen_inputs["attention_mask"].tolist(), [[1, 1, 1]])

    def test_onnx_loader_pins_candidate_and_uses_dynamic_token_length_and_cpu(self) -> None:
        tokenizer = FakeTokenizer()
        session = FakeSession()
        with TemporaryDirectory() as folder:
            config_path = f"{folder}/config.json"
            with open(config_path, "w", encoding="utf-8") as config_file:
                json.dump(
                    {
                        "_name_or_path": "j-hartmann/emotion-english-distilroberta-base",
                        "architectures": ["RobertaForSequenceClassification"],
                        "model_type": "roberta",
                        "id2label": {str(key): value for key, value in self.labels.items()},
                    },
                    config_file,
                )
            with (
                patch("emotion.hf_hub_download", side_effect=[
                    config_path,
                    "tokenizer.json",
                    "model_int8.onnx",
                ]) as download,
                patch("emotion.Tokenizer.from_file", return_value=tokenizer),
                patch("emotion.ort.InferenceSession", return_value=session) as create_session,
            ):
                classifier = load_emotion_classifier("onnx")

        self.assertIsInstance(classifier, OnnxEmotionClassifier)
        self.assertTrue(tokenizer.no_padding_called)
        self.assertEqual(tokenizer.truncation_length, 512)
        self.assertEqual([call.kwargs["filename"] for call in download.call_args_list], [
            "config.json",
            "tokenizer.json",
            ONNX_MODEL_FILE,
        ])
        self.assertTrue(
            all(call.kwargs["repo_id"] == ONNX_MODEL_ID for call in download.call_args_list)
        )
        self.assertTrue(
            all(call.kwargs["revision"] == ONNX_MODEL_REVISION for call in download.call_args_list)
        )
        self.assertEqual(create_session.call_args.kwargs["providers"], ["CPUExecutionProvider"])
        self.assertEqual(classifier.id2label, self.labels)

    def test_onnx_rejects_malformed_logits_and_model_io(self) -> None:
        wrong_shape, _ = self.create_classifier(np.zeros((1, 6), dtype=np.float32))
        with self.assertRaisesRegex(ValueError, "malformed logits"):
            wrong_shape.predict("text")

        nonfinite, _ = self.create_classifier(
            np.asarray([[0, 0, 0, np.nan, 0, 0, 0]], dtype=np.float32)
        )
        with self.assertRaisesRegex(ValueError, "malformed logits"):
            nonfinite.predict("text")

        wrong_inputs = FakeSession()
        wrong_inputs.input_values = [
            type("Input", (), {"name": "input_ids", "type": "tensor(float)"})()
        ]
        with self.assertRaisesRegex(RuntimeError, "unsupported input contract"):
            OnnxEmotionClassifier(wrong_inputs, FakeTokenizer(), self.labels)

        wrong_output_type = FakeSession()
        wrong_output_type.output_values[0].type = "tensor(int64)"
        with self.assertRaisesRegex(RuntimeError, "output does not match"):
            OnnxEmotionClassifier(wrong_output_type, FakeTokenizer(), self.labels)

    def test_onnx_config_rejects_missing_expected_labels(self) -> None:
        from emotion import _validated_id2label

        with self.assertRaisesRegex(RuntimeError, "original seven emotion labels"):
            _validated_id2label({0: "anger"}, require_expected=True)


if __name__ == "__main__":
    unittest.main()
