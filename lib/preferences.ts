import type { Mood } from './mood.ts';

export const PREFERENCE_STORAGE_KEY = 'moodtune.preferences.v1';
export const MAX_TRACK_FEEDBACK_IDS = 500;
export const MAX_LANGUAGE_PREFERENCES = 30;

export type FeaturePreferences = {
  valence: number | null;
  energy: number | null;
  danceability: number | null;
};

export type LanguagePreference = {
  language: string;
  strength: number;
  interactions: number;
};

export type PreferenceProfile = {
  version: 1;
  likedTrackIds: string[];
  savedTrackIds: string[];
  skippedTrackIds: string[];
  languagePreferences: LanguagePreference[];
  featurePreferences: FeaturePreferences;
  moodPreferences: Record<Mood, number>;
};

export type FeedbackTrack = {
  track_id: string;
  language?: string | null;
  mood?: Mood | null;
  valence?: number | null;
  energy?: number | null;
  danceability?: number | null;
};

export type TrackFeedback = 'like' | 'save' | 'skip';

const moods: Mood[] = ['happy', 'sad', 'energetic', 'chill'];
const features: (keyof FeaturePreferences)[] = ['valence', 'energy', 'danceability'];

export function createDefaultPreferenceProfile(): PreferenceProfile {
  return {
    version: 1,
    likedTrackIds: [],
    savedTrackIds: [],
    skippedTrackIds: [],
    languagePreferences: [],
    featurePreferences: { valence: null, energy: null, danceability: null },
    moodPreferences: { happy: 0.25, sad: 0.25, energetic: 0.25, chill: 0.25 },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedUnit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id.length > 240 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.slice(-MAX_TRACK_FEEDBACK_IDS);
}

function cleanLanguagePreferences(value: unknown): LanguagePreference[] {
  if (!Array.isArray(value)) return [];
  const preferences: LanguagePreference[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.language !== 'string') continue;
    const language = item.language.trim().slice(0, 40);
    const strength = boundedUnit(item.strength);
    if (!language || strength === null || typeof item.interactions !== 'number' ||
      !Number.isInteger(item.interactions) || item.interactions < 0) {
      continue;
    }
    const existing = preferences.findIndex((preference) =>
      preference.language.toLocaleLowerCase() === language.toLocaleLowerCase());
    const preference = {
      language,
      strength,
      interactions: Math.min(item.interactions, MAX_TRACK_FEEDBACK_IDS),
    };
    if (existing >= 0) preferences.splice(existing, 1);
    preferences.push(preference);
  }
  return preferences.slice(-MAX_LANGUAGE_PREFERENCES);
}

function cleanMoodPreferences(value: unknown): Record<Mood, number> {
  const defaults = createDefaultPreferenceProfile().moodPreferences;
  if (!isRecord(value)) return defaults;
  const parsed = Object.fromEntries(
    moods.map((mood) => [mood, boundedUnit(value[mood])]),
  ) as Record<Mood, number | null>;
  if (moods.some((mood) => parsed[mood] === null)) return defaults;
  const total = moods.reduce((sum, mood) => sum + (parsed[mood] ?? 0), 0);
  if (!Number.isFinite(total) || total <= 0) return defaults;
  return Object.fromEntries(moods.map((mood) => [mood, (parsed[mood] ?? 0) / total])) as Record<Mood, number>;
}

export function parsePreferenceProfile(value: unknown): PreferenceProfile {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return createDefaultPreferenceProfile();
    }
  }
  if (!isRecord(candidate) || candidate.version !== 1) return createDefaultPreferenceProfile();

  const featureValues = isRecord(candidate.featurePreferences) ? candidate.featurePreferences : {};
  return {
    version: 1,
    likedTrackIds: cleanIds(candidate.likedTrackIds),
    savedTrackIds: cleanIds(candidate.savedTrackIds),
    skippedTrackIds: cleanIds(candidate.skippedTrackIds),
    languagePreferences: cleanLanguagePreferences(candidate.languagePreferences),
    featurePreferences: {
      valence: boundedUnit(featureValues.valence),
      energy: boundedUnit(featureValues.energy),
      danceability: boundedUnit(featureValues.danceability),
    },
    moodPreferences: cleanMoodPreferences(candidate.moodPreferences),
  };
}

export function loadPreferenceProfile(): PreferenceProfile {
  if (typeof window === 'undefined') return createDefaultPreferenceProfile();
  try {
    return parsePreferenceProfile(window.localStorage.getItem(PREFERENCE_STORAGE_KEY));
  } catch {
    return createDefaultPreferenceProfile();
  }
}

export function savePreferenceProfile(profile: PreferenceProfile): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    PREFERENCE_STORAGE_KEY,
    JSON.stringify(parsePreferenceProfile(profile)),
  );
}

function appendUnique(ids: string[], id: string): string[] {
  return [...ids.filter((existing) => existing !== id), id].slice(-MAX_TRACK_FEEDBACK_IDS);
}

function normalizeMoodPreferences(values: Record<Mood, number>): Record<Mood, number> {
  const bounded = Object.fromEntries(
    moods.map((mood) => [mood, Math.max(0, Math.min(1, values[mood]))]),
  ) as Record<Mood, number>;
  const total = moods.reduce((sum, mood) => sum + bounded[mood], 0);
  return total > 0
    ? Object.fromEntries(moods.map((mood) => [mood, bounded[mood] / total])) as Record<Mood, number>
    : createDefaultPreferenceProfile().moodPreferences;
}

function updateFeaturePreferences(
  current: FeaturePreferences,
  track: FeedbackTrack,
  action: TrackFeedback,
): FeaturePreferences {
  const next = { ...current };
  const rate = action === 'like' ? 0.2 : action === 'save' ? 0.13 : 0.06;
  for (const feature of features) {
    const observed = boundedUnit(track[feature]);
    const preferred = current[feature];
    if (observed === null) continue;
    if (action === 'skip') {
      if (preferred !== null) {
        const direction = preferred === observed
          ? (preferred >= 0.5 ? 1 : -1)
          : Math.sign(preferred - observed);
        next[feature] = Math.max(
          0,
          Math.min(1, preferred + direction * rate * Math.max(Math.abs(preferred - observed), 0.1)),
        );
      }
    } else {
      next[feature] = preferred === null ? observed : preferred + (observed - preferred) * rate;
    }
  }
  return next;
}

function updateMoodPreferences(
  current: Record<Mood, number>,
  mood: Mood,
  action: TrackFeedback,
): Record<Mood, number> {
  const target = action === 'skip'
    ? Object.fromEntries(moods.map((item) => [item, item === mood ? 0 : 1 / (moods.length - 1)])) as Record<Mood, number>
    : Object.fromEntries(moods.map((item) => [item, item === mood ? 1 : 0])) as Record<Mood, number>;
  const rate = action === 'like' ? 0.2 : action === 'save' ? 0.13 : 0.06;
  return normalizeMoodPreferences(
    Object.fromEntries(moods.map((item) => [
      item,
      current[item] + (target[item] - current[item]) * rate,
    ])) as Record<Mood, number>,
  );
}

function updateLanguagePreferences(
  current: LanguagePreference[],
  language: string | null | undefined,
  action: TrackFeedback,
): LanguagePreference[] {
  const normalized = language?.trim();
  if (!normalized || normalized.length > 40) return current;
  const key = normalized.toLocaleLowerCase();
  const index = current.findIndex((item) => item.language.toLocaleLowerCase() === key);
  if (action === 'skip' && index < 0) return current;

  const previous = index >= 0 ? current[index] : { language: normalized, strength: 0, interactions: 0 };
  const interactions = Math.min(MAX_TRACK_FEEDBACK_IDS, previous.interactions + 1);
  const strength = action === 'skip'
    ? Math.max(0, previous.strength - 0.12)
    : interactions < 2
      ? 0
      : Math.min(1, previous.strength + (action === 'like' ? 0.24 : 0.18) * (1 - previous.strength));
  const updated = current.filter((_, itemIndex) => itemIndex !== index);
  updated.push({ language: previous.language, strength, interactions });
  return updated.slice(-MAX_LANGUAGE_PREFERENCES);
}

export function updateTrackFeedback(
  inputProfile: PreferenceProfile,
  track: FeedbackTrack,
  action: TrackFeedback,
): PreferenceProfile {
  const profile = parsePreferenceProfile(inputProfile);
  const trackId = typeof track.track_id === 'string' ? track.track_id.trim() : '';
  if (!trackId || trackId.length > 240 || (track.mood !== undefined && track.mood !== null && !moods.includes(track.mood))) {
    throw new Error('Track feedback requires a valid track ID and optional supported mood.');
  }
  const ids = action === 'like' ? profile.likedTrackIds
    : action === 'save' ? profile.savedTrackIds
      : profile.skippedTrackIds;
  if (ids.includes(trackId)) return profile;

  const next = { ...profile };
  if (action === 'skip') {
    next.skippedTrackIds = appendUnique(profile.skippedTrackIds, trackId);
    next.likedTrackIds = profile.likedTrackIds.filter((id) => id !== trackId);
    next.savedTrackIds = profile.savedTrackIds.filter((id) => id !== trackId);
  } else {
    if (action === 'like') next.likedTrackIds = appendUnique(profile.likedTrackIds, trackId);
    else next.savedTrackIds = appendUnique(profile.savedTrackIds, trackId);
    next.skippedTrackIds = profile.skippedTrackIds.filter((id) => id !== trackId);
  }

  next.featurePreferences = updateFeaturePreferences(profile.featurePreferences, track, action);
  if (track.mood !== undefined && track.mood !== null) {
    next.moodPreferences = updateMoodPreferences(profile.moodPreferences, track.mood, action);
  }
  next.languagePreferences = updateLanguagePreferences(profile.languagePreferences, track.language, action);
  return next;
}

export function likeTrack(profile: PreferenceProfile, track: FeedbackTrack): PreferenceProfile {
  return updateTrackFeedback(profile, track, 'like');
}

export function saveTrack(profile: PreferenceProfile, track: FeedbackTrack): PreferenceProfile {
  return updateTrackFeedback(profile, track, 'save');
}

export function skipTrack(profile: PreferenceProfile, track: FeedbackTrack): PreferenceProfile {
  return updateTrackFeedback(profile, track, 'skip');
}

export function getPreferenceMaturity(profile: PreferenceProfile): number {
  const feedbackTrackIds = new Set([
    ...profile.likedTrackIds,
    ...profile.savedTrackIds,
    ...profile.skippedTrackIds,
  ]);
  return Math.min(1, feedbackTrackIds.size / 5);
}
