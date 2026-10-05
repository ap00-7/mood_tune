import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_TRACK_FEEDBACK_IDS,
  createDefaultPreferenceProfile,
  getPreferenceMaturity,
  likeTrack,
  parsePreferenceProfile,
  saveTrack,
  skipTrack,
  updateTrackFeedback,
} from '../lib/preferences.ts';

const sampleTrack = {
  track_id: 'track-1',
  language: 'Hindi',
  mood: 'energetic' as const,
  valence: 0.7,
  energy: 0.9,
  danceability: 0.8,
};

test('default profile has clean bounded preferences and no history', () => {
  const profile = createDefaultPreferenceProfile();
  assert.equal(profile.version, 1);
  assert.deepEqual(profile.likedTrackIds, []);
  assert.deepEqual(profile.savedTrackIds, []);
  assert.deepEqual(profile.skippedTrackIds, []);
  assert.deepEqual(profile.featurePreferences, { valence: null, energy: null, danceability: null });
  assert.deepEqual(profile.moodPreferences, { happy: 0.25, sad: 0.25, energetic: 0.25, chill: 0.25 });
  assert.equal(getPreferenceMaturity(profile), 0);
});

test('malformed data and unsupported versions recover to the default profile', () => {
  const defaults = createDefaultPreferenceProfile();
  assert.deepEqual(parsePreferenceProfile('{not-json'), defaults);
  assert.deepEqual(parsePreferenceProfile({ version: 2, likedTrackIds: ['x'] }), defaults);
});

test('profile loading sanitizes values and caps feedback arrays', () => {
  const ids = Array.from({ length: MAX_TRACK_FEEDBACK_IDS + 5 }, (_, index) => `id-${index}`);
  const profile = parsePreferenceProfile({
    version: 1,
    likedTrackIds: ids,
    savedTrackIds: ['duplicate', 'duplicate', 2, ''],
    skippedTrackIds: ['skip-1'],
    featurePreferences: { valence: 0.7, energy: 5, danceability: Number.NaN },
    moodPreferences: { happy: 0.4, sad: 0.2, energetic: 0.3, chill: 0.1 },
    languagePreferences: [{ language: 'Hindi', strength: 2, interactions: 1 }],
  });
  assert.equal(profile.likedTrackIds.length, MAX_TRACK_FEEDBACK_IDS);
  assert.equal(profile.likedTrackIds[0], 'id-5');
  assert.deepEqual(profile.savedTrackIds, ['duplicate']);
  assert.deepEqual(profile.featurePreferences, { valence: 0.7, energy: null, danceability: null });
  assert.ok(Math.abs(profile.moodPreferences.happy - 0.4) < 1e-12);
  assert.ok(Math.abs(profile.moodPreferences.sad - 0.2) < 1e-12);
  assert.ok(Math.abs(profile.moodPreferences.energetic - 0.3) < 1e-12);
  assert.ok(Math.abs(profile.moodPreferences.chill - 0.1) < 1e-12);
  assert.deepEqual(profile.languagePreferences, []);
});

test('like feedback is positive, idempotent, and clears a prior skip', () => {
  const skipped = skipTrack(createDefaultPreferenceProfile(), sampleTrack);
  const liked = likeTrack(skipped, sampleTrack);
  const repeated = likeTrack(liked, sampleTrack);
  assert.deepEqual(liked.likedTrackIds, ['track-1']);
  assert.deepEqual(liked.skippedTrackIds, []);
  assert.ok(liked.featurePreferences.energy !== null && liked.featurePreferences.energy > 0.5);
  assert.ok(liked.moodPreferences.energetic > 0.25);
  assert.deepEqual(repeated, liked);
});

test('save feedback remains distinct and uses a smaller bounded feature update', () => {
  const seeded = {
    ...createDefaultPreferenceProfile(),
    featurePreferences: { valence: 0.2, energy: 0.2, danceability: 0.2 },
  };
  const liked = likeTrack(seeded, sampleTrack);
  const saved = saveTrack(seeded, sampleTrack);
  assert.deepEqual(liked.likedTrackIds, ['track-1']);
  assert.deepEqual(saved.savedTrackIds, ['track-1']);
  assert.equal(liked.savedTrackIds.length, 0);
  assert.ok((saved.featurePreferences.energy ?? 0) < (liked.featurePreferences.energy ?? 0));
  assert.ok((saved.featurePreferences.energy ?? 0) <= 1);
});

test('skip feedback is negative, removes positive membership, and ignores duplicates', () => {
  const saved = saveTrack(createDefaultPreferenceProfile(), sampleTrack);
  const skipped = skipTrack(saved, sampleTrack);
  const repeated = skipTrack(skipped, sampleTrack);
  assert.deepEqual(skipped.savedTrackIds, []);
  assert.deepEqual(skipped.skippedTrackIds, ['track-1']);
  assert.deepEqual(repeated, skipped);
  assert.ok(skipped.moodPreferences.energetic < saved.moodPreferences.energetic);
});

test('missing track features are ignored and language preference takes repeated positive feedback', () => {
  const missingFeatures = { ...sampleTrack, track_id: 'track-missing', energy: null, valence: null, danceability: null };
  let profile = updateTrackFeedback(createDefaultPreferenceProfile(), missingFeatures, 'like');
  assert.deepEqual(profile.featurePreferences, { valence: null, energy: null, danceability: null });
  assert.equal(profile.languagePreferences[0].strength, 0);

  profile = updateTrackFeedback(profile, { ...missingFeatures, track_id: 'track-next' }, 'save');
  assert.ok(profile.languagePreferences[0].strength > 0);
  assert.ok(profile.languagePreferences[0].strength <= 1);
});

test('feature and mood preference updates remain bounded after repeated unique feedback', () => {
  let profile = {
    ...createDefaultPreferenceProfile(),
    featurePreferences: { valence: 0.5, energy: 0.5, danceability: 0.5 },
  };
  for (let index = 0; index < 40; index += 1) {
    profile = updateTrackFeedback(profile, { ...sampleTrack, track_id: `bounded-${index}` }, 'like');
  }
  for (const value of Object.values(profile.featurePreferences)) {
    assert.ok(value !== null && value >= 0 && value <= 1);
  }
  for (const value of Object.values(profile.moodPreferences)) {
    assert.ok(value >= 0 && value <= 1);
  }
  assert.ok(Math.abs(Object.values(profile.moodPreferences).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
});
