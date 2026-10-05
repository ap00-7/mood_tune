import assert from 'node:assert/strict';
import test from 'node:test';

import type { Mood } from '../lib/mood.ts';
import {
  diversifyByArtist,
  loadTracks,
  rankRecommendations,
  scoreRecommendation,
  type Track,
} from '../lib/recommendations.ts';
import {
  createDefaultPreferenceProfile,
  updateTrackFeedback,
} from '../lib/preferences.ts';

function makeTrack(
  trackId: string,
  artist: string,
  mood: Mood,
  features: { valence: number | null; energy: number | null; danceability: number | null },
  language = 'Hindi',
): Track {
  return {
    track_id: trackId,
    track_name: trackId,
    artist_name: artist,
    ...features,
    artwork_url: '',
    track_url: `https://example.test/${trackId}`,
    language,
    mood,
    popularity: null,
  };
}

const energeticTrack = makeTrack('energetic', 'Artist E', 'energetic', {
  valence: 0.8,
  energy: 0.95,
  danceability: 0.9,
});
const calmTrack = makeTrack('calm', 'Artist C', 'chill', {
  valence: 0.45,
  energy: 0.2,
  danceability: 0.2,
});
const context = {
  moodAffinities: { happy: 0, sad: 0, energetic: 1, chill: 0 },
  intent: 'add_energy' as const,
  allowCrossMood: true,
};

test('cold-start profile still returns ranked recommendations', () => {
  const ranked = rankRecommendations(
    [calmTrack, energeticTrack],
    { mood: 'chill', context, preferences: createDefaultPreferenceProfile(), limit: 2 },
  );
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].track_id, 'energetic');
  assert.ok(ranked.every((track) => Number.isFinite(track.score.total)));
});

test('emotion distribution affects ranking through mood affinities', () => {
  const joyful = scoreRecommendation(
    makeTrack('joyful', 'Artist J', 'happy', { valence: 0.8, energy: 0.8, danceability: 0.8 }),
    'happy',
    { moodAffinities: { happy: 0.9, sad: 0, energetic: 0.1, chill: 0 } },
  );
  const reflective = scoreRecommendation(
    makeTrack('reflective', 'Artist R', 'sad', { valence: 0.2, energy: 0.2, danceability: 0.2 }),
    'happy',
    { moodAffinities: { happy: 0.9, sad: 0, energetic: 0.1, chill: 0 } },
  );
  assert.ok((joyful.emotionContext ?? 0) > (reflective.emotionContext ?? 0));
});

test('intent changes the normalized score for the same track', () => {
  const calmIntent = scoreRecommendation(
    energeticTrack,
    'energetic',
    { intent: 'calm_me_down' },
  );
  const energyIntent = scoreRecommendation(
    energeticTrack,
    'energetic',
    { intent: 'add_energy' },
  );
  assert.ok((energyIntent.intent ?? 0) > (calmIntent.intent ?? 0));
});

test('calm and energy intents produce different recommendation ordering', () => {
  const neutralMoodAffinities = { happy: 0.25, sad: 0.25, energetic: 0.25, chill: 0.25 };
  const calmRanked = rankRecommendations(
    [energeticTrack, calmTrack],
    {
      mood: 'chill',
      context: { moodAffinities: neutralMoodAffinities, intent: 'calm_me_down', allowCrossMood: true },
      limit: 2,
    },
  );
  const energyRanked = rankRecommendations(
    [energeticTrack, calmTrack],
    {
      mood: 'chill',
      context: { moodAffinities: neutralMoodAffinities, intent: 'add_energy', allowCrossMood: true },
      limit: 2,
    },
  );
  assert.equal(calmRanked[0].track_id, 'calm');
  assert.equal(energyRanked[0].track_id, 'energetic');
});

test('repeated high-energy likes raise personalized feature preference scores', () => {
  let profile = createDefaultPreferenceProfile();
  for (let index = 0; index < 5; index += 1) {
    profile = updateTrackFeedback(profile, {
      ...energeticTrack,
      track_id: `liked-${index}`,
    }, 'like');
  }
  const favored = scoreRecommendation(energeticTrack, 'energetic', context, profile);
  const disfavored = scoreRecommendation(calmTrack, 'energetic', context, profile);
  assert.ok((favored.userPreference ?? 0) > (disfavored.userPreference ?? 0));
});

test('repeated language feedback provides a bounded language ranking component', () => {
  let profile = createDefaultPreferenceProfile();
  profile = updateTrackFeedback(profile, { ...energeticTrack, track_id: 'hi-1', language: 'Hindi' }, 'like');
  profile = updateTrackFeedback(profile, { ...energeticTrack, track_id: 'hi-2', language: 'Hindi' }, 'save');
  const hindi = scoreRecommendation(energeticTrack, 'energetic', undefined, profile);
  const english = scoreRecommendation(
    { ...energeticTrack, language: 'English' },
    'energetic',
    undefined,
    profile,
  );
  assert.ok((hindi.languagePreference ?? 0) > (english.languagePreference ?? 0));
  assert.ok((hindi.languagePreference ?? 0) <= 1);

  const ranked = rankRecommendations(
    [
      { ...energeticTrack, track_id: 'english', language: 'English' },
      { ...energeticTrack, track_id: 'hindi', language: 'Hindi' },
    ],
    { mood: 'energetic', preferences: profile, limit: 2 },
  );
  assert.equal(ranked[0].track_id, 'hindi');
});

test('skipped tracks are excluded and stable IDs deduplicate candidates', () => {
  const profile = updateTrackFeedback(createDefaultPreferenceProfile(), energeticTrack, 'skip');
  const ranked = rankRecommendations(
    [energeticTrack, { ...energeticTrack }, calmTrack],
    { mood: 'chill', context, preferences: profile, limit: 10 },
  );
  assert.deepEqual(ranked.map((track) => track.track_id), ['calm']);
});

test('artist diversity caps repeats when alternatives are available', () => {
  const ranked = diversifyByArtist(
    [
      { artist_name: 'Same', id: 1 },
      { artist_name: 'Same', id: 2 },
      { artist_name: 'Same', id: 3 },
      { artist_name: 'Different', id: 4 },
      { artist_name: 'Another', id: 5 },
    ],
    4,
  );
  assert.deepEqual(ranked.map((item) => item.id), [1, 2, 4, 5]);
});

test('unavailable scoring components are omitted and remaining weights renormalized', () => {
  const scored = scoreRecommendation(energeticTrack, 'energetic', context);
  const weightTotal = Object.values(scored.weights).reduce((sum, weight) => sum + (weight ?? 0), 0);
  assert.ok(Math.abs(weightTotal - 1) < 1e-12);
  assert.equal(scored.userPreference, null);
  assert.equal(scored.languagePreference, null);
  assert.equal(scored.popularity, null);
  assert.ok(Math.abs((scored.weights.emotionContext ?? 0) - 0.3 / 0.6) < 1e-12);
});

test('missing features are not fabricated for intent or preference updates', () => {
  const missing = makeTrack('missing', 'Artist M', 'chill', {
    valence: null,
    energy: null,
    danceability: null,
  });
  assert.equal(scoreRecommendation(missing, 'chill', { intent: 'add_energy' }).intent, null);
  const profile = updateTrackFeedback(createDefaultPreferenceProfile(), missing, 'like');
  assert.deepEqual(profile.featurePreferences, { valence: null, energy: null, danceability: null });
});

test('existing catalog loading returns stable track records and bounded metadata', async () => {
  const tracks = await loadTracks();
  assert.ok(tracks.length > 0);
  assert.equal(new Set(tracks.map((track) => track.track_id)).size, tracks.length);
  assert.ok(tracks.some((track) => track.valence !== null && track.energy !== null));
  assert.ok(tracks.every((track) =>
    track.popularity === null || (track.popularity >= 0 && track.popularity <= 100)));
});

test('legacy mood-filtered recommendations preserve deterministic content ordering', () => {
  const ranked = rankRecommendations(
    [energeticTrack, calmTrack],
    { mood: 'energetic', limit: 5 },
  );
  assert.deepEqual(ranked.map((track) => track.track_id), ['energetic']);
  assert.ok(ranked[0].score.weights.content === 1);
});
