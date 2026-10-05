import { NextResponse } from 'next/server';

import { getRecommendations } from '@/lib/recommendations';
import type { Mood } from '@/lib/mood';
import { isMlPrediction, type MlPrediction } from '@/lib/ml-contract';
import { isListeningIntent } from '@/lib/listening-intent';
import { parsePreferenceProfile } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

const moods: Mood[] = ['happy', 'sad', 'energetic', 'chill'];

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const mood = searchParams.get('mood');
  const language = searchParams.get('language')?.trim() || 'All';
  const rawLimit = Number(searchParams.get('limit') ?? 12);
  const rawOffset = Number(searchParams.get('offset') ?? 0);

  if (!mood || !moods.includes(mood as Mood)) {
    return NextResponse.json({ error: 'Choose one of the supported moods.' }, { status: 400 });
  }
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 24) {
    return NextResponse.json({ error: 'Limit must be an integer between 1 and 24.' }, { status: 400 });
  }
  if (!Number.isInteger(rawOffset) || rawOffset < 0 || rawOffset > 100_000) {
    return NextResponse.json({ error: 'Offset must be a non-negative integer.' }, { status: 400 });
  }
  if (language.length > 40) {
    return NextResponse.json({ error: 'Language filter is too long.' }, { status: 400 });
  }

  try {
    const tracks = await getRecommendations({
      mood: mood as Mood,
      language,
      limit: rawLimit,
      offset: rawOffset,
    });
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('Catalog recommendation request failed', error);
    return NextResponse.json(
      { error: 'Music discovery is temporarily unavailable. Please try again.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Choose a mood to browse.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const mood = input.mood;
  const language = typeof input.language === 'string' ? input.language.trim() : 'All';
  const limit = input.limit;
  const offset = input.offset;
  if (typeof mood !== 'string' || !moods.includes(mood as Mood)) {
    return NextResponse.json({ error: 'Choose one of the supported moods.' }, { status: 400 });
  }
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 24) {
    return NextResponse.json({ error: 'Limit must be an integer between 1 and 24.' }, { status: 400 });
  }
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || offset > 100_000) {
    return NextResponse.json({ error: 'Offset must be a non-negative integer.' }, { status: 400 });
  }
  if (language.length > 40) {
    return NextResponse.json({ error: 'Language filter is too long.' }, { status: 400 });
  }

  const selectedMood = mood as Mood;
  const contextual = input.prediction;
  let prediction: MlPrediction | null = null;
  if (
    contextual !== undefined
  ) {
    if (
      !contextual ||
      typeof contextual !== 'object' ||
      Array.isArray(contextual) ||
      !isListeningIntent(input.intent)
    ) {
      return NextResponse.json({ error: 'The emotional recommendation context is invalid.' }, { status: 400 });
    }
    const predictionWithIntent: unknown = {
      ...(contextual as Record<string, unknown>),
      intent: input.intent,
    };
    if (!isMlPrediction(predictionWithIntent, input.intent)) {
      return NextResponse.json({ error: 'The emotional recommendation context is invalid.' }, { status: 400 });
    }
    prediction = predictionWithIntent;
    if (prediction.mood !== selectedMood) {
      return NextResponse.json({ error: 'The selected mood does not match the emotional context.' }, { status: 400 });
    }
  }
  if (contextual === undefined && input.intent !== undefined) {
    return NextResponse.json({ error: 'An emotional context is required when selecting an intent.' }, { status: 400 });
  }

  try {
    const tracks = await getRecommendations({
      mood: selectedMood,
      language,
      limit,
      offset,
      preferences: parsePreferenceProfile(input.preferences),
      context: prediction === null
        ? {
            moodAffinities: {
              happy: Number(selectedMood === 'happy'),
              sad: Number(selectedMood === 'sad'),
              energetic: Number(selectedMood === 'energetic'),
              chill: Number(selectedMood === 'chill'),
            },
          }
        : {
            emotion: prediction.emotion,
            emotionScores: prediction.emotion_scores,
            moodAffinities: prediction.mood_affinities,
            intent: prediction.intent ?? undefined,
            allowCrossMood: true,
          },
    });
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('Personalized catalog recommendation request failed', error);
    return NextResponse.json(
      { error: 'Music discovery is temporarily unavailable. Please try again.' },
      { status: 500 },
    );
  }
}
