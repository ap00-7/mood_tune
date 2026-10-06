import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

import type { Mood } from './mood.ts';
import type { EmotionScore, MoodAffinities } from './ml-contract.ts';
import type { ListeningIntent } from './listening-intent.ts';
import {
  getPreferenceMaturity,
  type PreferenceProfile,
} from './preferences.ts';
import { getIntentAudioProfile } from './listening-intent.ts';

export type RecommendationContext = {
  emotion?: string;
  emotionScores?: EmotionScore[];
  moodAffinities?: MoodAffinities;
  intent?: ListeningIntent;
  allowCrossMood?: boolean;
};

export type Track = {
  track_id: string;
  track_name: string;
  artist_name: string;
  valence: number | null;
  energy: number | null;
  danceability: number | null;
  artwork_url: string;
  track_url: string;
  language: string;
  mood: Mood | null;
  popularity: number | null;
};

export type RecommendationRequest = {
  mood: Mood;
  language?: string;
  limit?: number;
  offset?: number;
  excludeTrackIds?: string[];
  context?: RecommendationContext;
  preferences?: PreferenceProfile;
};

export type RecommendationScoreComponent =
  | 'emotionContext'
  | 'intent'
  | 'userPreference'
  | 'languagePreference'
  | 'content'
  | 'popularity';

export type RecommendationScoreBreakdown = {
  emotionContext: number | null;
  intent: number | null;
  userPreference: number | null;
  languagePreference: number | null;
  content: number | null;
  popularity: number | null;
  weights: Partial<Record<RecommendationScoreComponent, number>>;
  total: number;
};

export type RecommendedTrack = Track & {
  score: RecommendationScoreBreakdown;
};

const DEFAULT_ARTWORK =
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80';
const moods: Mood[] = ['happy', 'sad', 'energetic', 'chill'];

let cache: Track[] | null = null;

function parseFeature(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function parsePopularity(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function createTrackId(
  row: Record<string, string>,
  trackName: string,
  artistName: string,
  language: string,
): string {
  const catalogId = row.track_id?.trim();
  if (catalogId && catalogId.length <= 240) return `catalog:${catalogId}`;
  return `catalog:${[trackName, artistName, language]
    .map((part) => encodeURIComponent(part.trim().toLocaleLowerCase()))
    .join('|')}`;
}

export async function loadTracks(): Promise<Track[]> {
  if (cache) return cache;

  const datasetDir = path.join(process.cwd(), 'mood_recommender', 'datasets');
  const files = fs.readdirSync(datasetDir).filter((file) => file.endsWith('.csv'));
  const records: Track[] = [];
  const seenTracks = new Set<string>();

  for (const file of files) {
    const fullPath = path.join(datasetDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const parsed = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];

    for (const row of parsed) {
      const trackName = (row.song_name ?? row.track_name ?? '').trim();
      const artistName = (row.singer ?? row.artist_name ?? '').trim();
      const language = (row.language ?? file.replace(/_songs\.csv$/i, '').replace(/\.csv$/i, '') ?? 'Global').trim();
      if (!trackName || !artistName) continue;

      const trackId = createTrackId(row, trackName, artistName, language || 'Global');
      if (seenTracks.has(trackId)) continue;
      seenTracks.add(trackId);

      const valence = parseFeature(row.Valence ?? row.valence);
      const energy = parseFeature(row.energy);
      const danceability = parseFeature(row.danceability);
      records.push({
        track_id: trackId,
        track_name: trackName,
        artist_name: artistName,
        valence,
        energy,
        danceability,
        artwork_url: row.artwork_url || row.image_url || DEFAULT_ARTWORK,
        track_url:
          row.track_url ||
          `https://open.spotify.com/search/${encodeURIComponent(`${trackName} ${artistName}`)}`,
        language: language || 'Global',
        mood: valence === null || energy === null ? null : inferMoodFromFeatures(valence, energy),
        popularity: parsePopularity(row.popularity),
      });
    }
  }

  cache = records;
  return records;
}

export function inferMoodFromFeatures(valence: number, energy: number): Mood {
  if (valence > 0.6 && energy > 0.6) return 'happy';
  if (valence < 0.4 && energy < 0.5) return 'sad';
  if (energy > 0.7 && valence < 0.6) return 'energetic';
  return 'chill';
}

function baselineContentScore(track: Track, targetMood: Mood): number | null {
  const hasMood = track.mood !== null;
  const hasFeature = track.valence !== null || track.energy !== null || track.danceability !== null;
  if (!hasMood && !hasFeature) return null;

  let originalScore = hasMood && track.mood === targetMood ? 2 : 0;
  if (track.energy !== null) originalScore += track.energy * 1.5;
  if (track.danceability !== null) originalScore += track.danceability * 1.4;
  if (track.valence !== null) {
    const targetValence =
      targetMood === 'happy'
        ? 0.75
        : targetMood === 'sad'
          ? 0.25
          : targetMood === 'energetic'
            ? 0.52
            : 0.6;
    originalScore -= Math.abs(track.valence - targetValence);
  }
  return Math.max(0, Math.min(1, (originalScore + 0.75) / 5.65));
}

function emotionContextScore(track: Track, context?: RecommendationContext): number | null {
  const affinities = context?.moodAffinities;
  if (!affinities || track.mood === null) return null;
  return affinities[track.mood];
}

function intentScore(track: Track, context?: RecommendationContext): number | null {
  if (!context?.intent) return null;
  const profile = getIntentAudioProfile(context.intent);
  const comparisons = (['valence', 'energy', 'danceability'] as const)
    .flatMap((feature) => {
      const value = track[feature];
      const weight = profile.weights[feature];
      return value === null || weight <= 0
        ? []
        : [{ score: 1 - Math.abs(value - profile[feature]), weight }];
    });
  const weightTotal = comparisons.reduce((sum, item) => sum + item.weight, 0);
  return weightTotal > 0
    ? comparisons.reduce((sum, item) => sum + item.score * item.weight, 0) / weightTotal
    : null;
}

function userPreferenceScore(
  track: Track,
  preferences?: PreferenceProfile,
): number | null {
  if (!preferences || getPreferenceMaturity(preferences) === 0) return null;

  const featureScores = (['valence', 'energy', 'danceability'] as const)
    .flatMap((feature) => {
      const observed = track[feature];
      const preferred = preferences.featurePreferences[feature];
      return observed === null || preferred === null
        ? []
        : [1 - Math.abs(observed - preferred)];
    });
  const moodScore = track.mood === null
    ? null
    : Math.max(
        0,
        Math.min(
          1,
          preferences.moodPreferences[track.mood] /
            Math.max(...moods.map((mood) => preferences.moodPreferences[mood])),
        ),
      );

  if (!featureScores.length && moodScore === null) return null;
  if (!featureScores.length) return moodScore;
  const featureScore = featureScores.reduce((sum, score) => sum + score, 0) / featureScores.length;
  return moodScore === null ? featureScore : featureScore * 0.75 + moodScore * 0.25;
}

function languagePreferenceScore(
  track: Track,
  preferences?: PreferenceProfile,
): number | null {
  const entries = preferences?.languagePreferences.filter((item) => item.strength > 0) ?? [];
  if (!entries.length) return null;
  const preference = entries.find(
    (item) => item.language.toLocaleLowerCase() === track.language.toLocaleLowerCase(),
  );
  return preference?.strength ?? 0;
}

const componentWeights = {
  emotionContext: 0.3,
  intent: 0.25,
  userPreference: 0.25,
  languagePreference: 0.1,
  content: 0.05,
  popularity: 0.05,
} as const;

export function scoreRecommendation(
  track: Track,
  targetMood: Mood,
  context?: RecommendationContext,
  preferences?: PreferenceProfile,
): RecommendationScoreBreakdown {
  const hasHybridSignals = Boolean(context || preferences);
  const components = {
    emotionContext: emotionContextScore(track, context),
    intent: intentScore(track, context),
    userPreference: userPreferenceScore(track, preferences),
    languagePreference: languagePreferenceScore(track, preferences),
    content: baselineContentScore(track, targetMood),
    popularity: !hasHybridSignals || track.popularity === null ? null : track.popularity / 100,
  };
  const maturity = preferences ? getPreferenceMaturity(preferences) : 0;
  const weights = {
    emotionContext: components.emotionContext === null ? 0 : componentWeights.emotionContext,
    intent: components.intent === null ? 0 : componentWeights.intent,
    userPreference: components.userPreference === null ? 0 : componentWeights.userPreference * maturity,
    languagePreference: components.languagePreference === null ? 0 : componentWeights.languagePreference,
    content: components.content === null ? 0 : componentWeights.content,
    popularity: components.popularity === null ? 0 : componentWeights.popularity,
  };
  const availableWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const total = availableWeight > 0
    ? (Object.keys(components) as (keyof typeof components)[]).reduce(
        (sum, key) => sum + (components[key] ?? 0) * (weights[key] / availableWeight),
        0,
      )
    : 0;
  return {
    ...components,
    weights: Object.fromEntries(
      Object.entries(weights)
        .filter(([, weight]) => weight > 0)
        .map(([key, weight]) => [key, weight / availableWeight]),
    ),
    total,
  };
}

export function diversifyByArtist<T extends { artist_name: string }>(
  ranked: T[],
  limit: number,
  artistCap = 2,
): T[] {
  const selected: T[] = [];
  const deferred: T[] = [];
  const artistCounts = new Map<string, number>();

  for (const item of ranked) {
    const key = item.artist_name.trim().toLocaleLowerCase();
    const count = artistCounts.get(key) ?? 0;
    if (count < artistCap) {
      selected.push(item);
      artistCounts.set(key, count + 1);
    } else {
      deferred.push(item);
    }
  }

  return [...selected, ...deferred].slice(0, limit);
}

export function rankRecommendations(
  tracks: Track[],
  request: RecommendationRequest,
): RecommendedTrack[] {
  const { mood, language = 'All', limit = 5, offset = 0, excludeTrackIds = [], context, preferences } = request;
  const skipped = new Set(preferences?.skippedTrackIds ?? []);
  const excluded = new Set(excludeTrackIds.filter((trackId) => typeof trackId === 'string' && trackId.trim().length > 0));

  const filterCandidates = (trackIdsToExclude: Set<string>) => {
    const seen = new Set<string>();
    return tracks.filter((track) => {
      if (seen.has(track.track_id) || skipped.has(track.track_id) || trackIdsToExclude.has(track.track_id)) return false;
      const matchesMood = context?.allowCrossMood === true || track.mood === mood;
      const matchesLanguage = language === 'All' || track.language.toLocaleLowerCase() === language.toLocaleLowerCase();
      if (!matchesMood || !matchesLanguage) return false;
      seen.add(track.track_id);
      return true;
    });
  };

  const candidates = filterCandidates(excluded);
  const fallbackCandidates = excluded.size > 0 ? filterCandidates(new Set()) : candidates;
  const ranked = (candidates.length > 0 ? candidates : fallbackCandidates)
    .map((track, index) => ({
      track,
      index,
      score: scoreRecommendation(track, mood, context, preferences),
    }))
    .sort((left, right) => right.score.total - left.score.total || left.index - right.index)
    .map(({ track, score }) => ({ ...track, score }));

  return diversifyByArtist(ranked, Math.max(0, offset) + Math.max(1, limit))
    .slice(Math.max(0, offset));
}

export async function getRecommendations(request: RecommendationRequest): Promise<RecommendedTrack[]> {
  return rankRecommendations(await loadTracks(), request);
}
