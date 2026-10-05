import assert from 'node:assert/strict';
import test from 'node:test';

import { getIntentAudioProfile, isListeningIntent, listeningIntents } from '../lib/listening-intent.ts';
import { isMlPrediction } from '../lib/ml-contract.ts';

test('all supported intents have bounded audio targets and weights', () => {
  assert.deepEqual(listeningIntents, ['match_mood', 'lift_me_up', 'calm_me_down', 'add_energy']);
  for (const intent of listeningIntents) {
    const profile = getIntentAudioProfile(intent);
    for (const feature of ['valence', 'energy', 'danceability'] as const) {
      assert.ok(profile[feature] >= 0 && profile[feature] <= 1);
      assert.ok(profile.weights[feature] >= 0 && profile.weights[feature] <= 1);
    }
  }
});

test('only the fixed intent set is accepted', () => {
  assert.equal(isListeningIntent('add_energy'), true);
  assert.equal(isListeningIntent(undefined), false);
  assert.equal(isListeningIntent('infer_from_text'), false);
});

const validPrediction = {
  emotion: 'joy',
  emotion_scores: [
    { emotion: 'joy', score: 0.75 },
    { emotion: 'sadness', score: 0.25 },
  ],
  mood: 'happy',
  mood_affinities: { happy: 0.75, sad: 0.25, energetic: 0, chill: 0 },
  confidence: 0.75,
  model: 'j-hartmann/emotion-english-distilroberta-base',
  intent: 'match_mood',
};

test('ML response validator preserves a complete and consistent prediction', () => {
  assert.equal(isMlPrediction(validPrediction, 'match_mood'), true);
});

test('analysis responses with no intent are valid before the explicit selection step', () => {
  const { intent: _intent, ...analysis } = validPrediction;
  assert.equal(isMlPrediction({ ...analysis, intent: null }, null), true);
  assert.equal(isMlPrediction({ ...analysis, intent: null }, 'match_mood'), false);
});

test('ML response validator rejects malformed distributions and mismatched intent', () => {
  assert.equal(isMlPrediction({ ...validPrediction, confidence: 0.5 }, 'match_mood'), false);
  assert.equal(
    isMlPrediction(
      { ...validPrediction, emotion_scores: [...validPrediction.emotion_scores].reverse() },
      'match_mood',
    ),
    false,
  );
  assert.equal(
    isMlPrediction(
      { ...validPrediction, emotion_scores: [{ emotion: 'joy', score: Number.NaN }, { emotion: 'sadness', score: 0.25 }] },
      'match_mood',
    ),
    false,
  );
  assert.equal(isMlPrediction(validPrediction, 'lift_me_up'), false);
});
