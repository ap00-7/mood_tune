import type { Mood } from './mood.ts';
import { isListeningIntent, type ListeningIntent } from './listening-intent.ts';

export type EmotionScore = {
  emotion: string;
  score: number;
};

export type MoodAffinities = Record<Mood, number>;

export type MlPrediction = {
  emotion: string;
  emotion_scores: EmotionScore[];
  mood: Mood;
  mood_affinities: MoodAffinities;
  confidence: number;
  model: 'j-hartmann/emotion-english-distilroberta-base';
  intent: ListeningIntent | null;
};

const moods: Mood[] = ['happy', 'sad', 'energetic', 'chill'];

export function isMlPrediction(
  value: unknown,
  expectedIntent: ListeningIntent | null,
): value is MlPrediction {
  if (!value || typeof value !== 'object') return false;
  const prediction = value as Record<string, unknown>;
  const scores = prediction.emotion_scores;
  const affinities = prediction.mood_affinities;

  if (
    typeof prediction.emotion !== 'string' ||
    !prediction.emotion.trim() ||
    typeof prediction.mood !== 'string' ||
    !moods.includes(prediction.mood as Mood) ||
    typeof prediction.confidence !== 'number' ||
    !Number.isFinite(prediction.confidence) ||
    prediction.confidence < 0 ||
    prediction.confidence > 1 ||
    prediction.model !== 'j-hartmann/emotion-english-distilroberta-base' ||
    prediction.intent !== expectedIntent ||
    !Array.isArray(scores) ||
    scores.length === 0 ||
    !affinities ||
    typeof affinities !== 'object' ||
    Array.isArray(affinities)
  ) {
    return false;
  }

  const labels = new Set<string>();
  let scoreTotal = 0;
  for (let index = 0; index < scores.length; index += 1) {
    const item: unknown = scores[index];
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as Record<string, unknown>).emotion !== 'string' ||
      !(item as Record<string, unknown>).emotion ||
      typeof (item as Record<string, unknown>).score !== 'number' ||
      !Number.isFinite((item as Record<string, unknown>).score) ||
      ((item as Record<string, unknown>).score as number) < 0 ||
      ((item as Record<string, unknown>).score as number) > 1
    ) {
      return false;
    }

    const emotion = (item as EmotionScore).emotion;
    const score = (item as EmotionScore).score;
    const normalizedLabel = emotion.toLocaleLowerCase();
    if (labels.has(normalizedLabel)) return false;
    labels.add(normalizedLabel);
    if (index > 0 && score > (scores[index - 1] as EmotionScore).score) return false;
    scoreTotal += score;
  }

  if (
    (scores[0] as EmotionScore).emotion.toLocaleLowerCase() !== prediction.emotion.toLocaleLowerCase() ||
    Math.abs(scoreTotal - 1) > 1e-4 ||
    Math.abs(prediction.confidence - (scores[0] as EmotionScore).score) > 1e-7
  ) {
    return false;
  }

  const affinityValues: number[] = [];
  for (const mood of moods) {
    const affinity = (affinities as Record<string, unknown>)[mood];
    if (typeof affinity !== 'number' || !Number.isFinite(affinity) || affinity < 0 || affinity > 1) {
      return false;
    }
    affinityValues.push(affinity);
  }
  if (Object.keys(affinities).length !== moods.length || Math.abs(affinityValues.reduce((a, b) => a + b, 0) - 1) > 1e-6) {
    return false;
  }

  return expectedIntent === null
    ? prediction.intent === null
    : isListeningIntent(prediction.intent);
}
