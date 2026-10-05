import { NextResponse } from 'next/server';

import { getRecommendations } from '@/lib/recommendations';
import type { Mood } from '@/lib/mood';

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
