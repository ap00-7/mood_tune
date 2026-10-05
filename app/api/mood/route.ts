import { NextResponse } from 'next/server';

import { moodMeta } from '@/lib/mood';
import { isMlPrediction } from '@/lib/ml-contract';
import { isListeningIntent } from '@/lib/listening-intent';

const MAX_TEXT_LENGTH = 2000;
const ML_TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Please share how you are feeling.' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const text = typeof input.text === 'string' ? input.text.trim().replace(/\s+/g, ' ') : '';
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text must be between 1 and ${MAX_TEXT_LENGTH} characters.` },
      { status: 400 },
    );
  }

  if (input.intent !== undefined && input.intent !== null && !isListeningIntent(input.intent)) {
    return NextResponse.json({ error: 'Choose one of the supported listening intents.' }, { status: 400 });
  }
  const intent = input.intent === undefined || input.intent === null ? null : input.intent;
  const mlApiUrl = process.env.ML_API_URL?.trim();

  if (!mlApiUrl) {
    console.error('ML_API_URL is not configured');
    return NextResponse.json(
      { error: 'Mood analysis is temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }

  let predictionResponse: Response;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.ML_API_KEY) {
      headers.Authorization = `Bearer ${process.env.ML_API_KEY}`;
    }

    predictionResponse = await fetch(`${mlApiUrl.replace(/\/+$/, '')}/predict`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, intent }),
      signal: AbortSignal.timeout(ML_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Mood analysis is taking too long. Please try again.' },
        { status: 504 },
      );
    }
    console.error('ML service request failed', error);
    return NextResponse.json(
      { error: 'Mood analysis is temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }

  if (!predictionResponse.ok) {
    console.error(`ML service returned HTTP ${predictionResponse.status}`);
    return NextResponse.json(
      { error: 'Mood analysis is temporarily unavailable. Please try again.' },
      { status: predictionResponse.status === 400 ? 400 : 503 },
    );
  }

  let prediction: unknown;
  try {
    prediction = await predictionResponse.json();
  } catch {
    return NextResponse.json(
      { error: 'Mood analysis is temporarily unavailable. Please try again.' },
      { status: 502 },
    );
  }

  if (!isMlPrediction(prediction, intent)) {
    console.error('ML service returned an invalid prediction response');
    return NextResponse.json(
      { error: 'Mood analysis is temporarily unavailable. Please try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ...prediction,
    label: moodMeta[prediction.mood].label,
    explanation: moodMeta[prediction.mood].description,
  });
}
