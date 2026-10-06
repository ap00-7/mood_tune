'use client';

import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Check,
  CircleAlert,
  Disc3,
  LoaderCircle,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Zap,
} from 'lucide-react';

import { MusicCard, type TrackResult } from '@/components/music-card';
import {
  listeningIntentLabels,
  listeningIntents,
  type ListeningIntent,
} from '@/lib/listening-intent';
import { moodMeta, type Mood } from '@/lib/mood';
import {
  createDefaultPreferenceProfile,
  likeTrack,
  loadPreferenceProfile,
  saveTrack,
  savePreferenceProfile,
  skipTrack,
  type PreferenceProfile,
  type TrackFeedback,
} from '@/lib/preferences';

const MAX_TEXT_LENGTH = 2000;
const languageOptions = [
  'All',
  'Assamese',
  'Bengali',
  'Bhojpuri',
  'English',
  'Gujarati',
  'Haryanvi',
  'Hindi',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Odia',
  'Punjabi',
  'Rajasthani',
  'Tamil',
  'Telugu',
  'Urdu',
];
const analysisStages = ['Reading the emotional signal…', 'Checking the model distribution…'];
const moodIcons: Record<Mood, typeof Sun> = {
  happy: Sun,
  sad: Moon,
  energetic: Zap,
  chill: AudioLines,
};

type MoodResponse = {
  emotion: string;
  emotion_scores: { emotion: string; score: number }[];
  mood: Mood;
  mood_affinities: Record<Mood, number>;
  label: string;
  explanation: string;
  confidence: number;
  model: string;
  intent: ListeningIntent | null;
  recommendations?: TrackResult[];
};

export function MoodDiscovery() {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('All');
  const [intent, setIntent] = useState<ListeningIntent>('match_mood');
  const [preferences, setPreferences] = useState<PreferenceProfile>(createDefaultPreferenceProfile);
  const [loading, setLoading] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<MoodResponse | null>(null);
  const [error, setError] = useState('');
  const reduceMotion = useReducedMotion();
  const remaining = MAX_TEXT_LENGTH - text.length;
  const visual = result ? moodMeta[result.mood] : null;
  const MoodIcon = result ? moodIcons[result.mood] : Sparkles;

  useEffect(() => {
    setPreferences(loadPreferenceProfile());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedText = text.trim();
    if (!normalizedText || normalizedText.length > MAX_TEXT_LENGTH || loading) return;

    setLoading(true);
    setStage(0);
    setError('');
    setResult(null);
    setRecommendationsLoading(false);
    setIntent('match_mood');
    const stageTimer = window.setTimeout(() => setStage(1), 650);

    try {
      const response = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: normalizedText }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'We couldn’t read your mood right now. Please try again in a moment.';
        throw new Error(message);
      }

      if (
        !payload ||
        typeof payload !== 'object' ||
        !('mood' in payload) ||
        !('emotion' in payload) ||
        !('confidence' in payload) ||
        !('emotion_scores' in payload) ||
        !('mood_affinities' in payload)
      ) {
        throw new Error('We couldn’t read your mood right now. Please try again in a moment.');
      }

      setResult(payload as MoodResponse);
    } catch (submissionError) {
      const isExpectedServiceError =
        submissionError instanceof Error &&
        submissionError.name !== 'TypeError' &&
        submissionError.name !== 'SyntaxError';
      setError(
        isExpectedServiceError
          ? submissionError.message
          : 'Mood analysis is temporarily unavailable. Please try again in a moment.',
      );
    } finally {
      window.clearTimeout(stageTimer);
      setLoading(false);
    }
  }

  async function generateRecommendations({ refresh = false }: { refresh?: boolean } = {}) {
    if (!result || recommendationsLoading) return;
    const excludedTrackIds = refresh
      ? result.recommendations?.map((track) => track.track_id) ?? []
      : [];

    setRecommendationsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: result.mood,
          language,
          limit: 8,
          offset: 0,
          intent,
          prediction: {
            emotion: result.emotion,
            emotion_scores: result.emotion_scores,
            mood: result.mood,
            mood_affinities: result.mood_affinities,
            confidence: result.confidence,
            model: result.model,
          },
          preferences,
          excludeTrackIds: excludedTrackIds,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Recommendations are temporarily unavailable. Please try again.';
        throw new Error(message);
      }
      if (!payload || typeof payload !== 'object' || !('tracks' in payload) || !Array.isArray(payload.tracks)) {
        throw new Error('Recommendations returned an unexpected response.');
      }
      setResult((current) =>
        current
          ? { ...current, intent, recommendations: payload.tracks as TrackResult[] }
          : current,
      );
    } catch (recommendationError) {
      console.error('Recommendation request failed', recommendationError);
      setError(
        recommendationError instanceof Error
          ? recommendationError.message
          : 'Recommendations are temporarily unavailable. Please try again.',
      );
    } finally {
      setRecommendationsLoading(false);
    }
  }

  function handleFeedback(track: TrackResult, action: TrackFeedback) {
    try {
      const nextProfile = action === 'like'
        ? likeTrack(preferences, track)
        : action === 'save'
          ? saveTrack(preferences, track)
          : skipTrack(preferences, track);
      savePreferenceProfile(nextProfile);
      setPreferences(nextProfile);
      if (action === 'skip') {
        setResult((current) =>
          current
            ? {
                ...current,
                recommendations: (current.recommendations ?? []).filter(
                  (candidate) => candidate.track_id !== track.track_id,
                ),
              }
            : current,
        );
      }
      setError('');
    } catch (feedbackError) {
      console.error('Could not save local music preference', feedbackError);
      setError('Your feedback could not be saved on this device. Please try again.');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
      <header className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">A moment, understood</p>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
          Start with how
          <span className="block text-gradient">you feel.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-7 text-slate-400 sm:text-base">
          A few words are all it takes. We’ll find the music that belongs in this moment.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-3xl">
        <div className="input-shell rounded-[1.6rem] border border-white/[0.09] bg-[#101019] p-3 shadow-2xl shadow-black/30 transition focus-within:border-violet-300/35 focus-within:shadow-violet-950/20 sm:p-5">
          <label htmlFor="mood-text" className="mb-3 block px-2 text-xs font-medium text-slate-300 sm:px-3">
            HOW ARE YOU FEELING?
          </label>
          <textarea
            id="mood-text"
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
            onKeyDown={handleKeyDown}
            rows={5}
            maxLength={MAX_TEXT_LENGTH}
            aria-describedby="mood-guidance mood-count"
            placeholder="Tell MoodTune what’s on your mind…"
            className="min-h-36 w-full resize-y bg-transparent px-2 py-1 text-base leading-7 text-white outline-none placeholder:text-slate-600 focus-visible:outline-none sm:min-h-40 sm:px-3 sm:text-lg"
          />
          <div className="flex flex-col gap-4 border-t border-white/[0.07] px-2 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label htmlFor="language" className="sr-only">
                Recommendation language
              </label>
              <select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="max-w-full rounded-lg border border-white/[0.08] bg-[#171721] px-3 py-2 text-xs text-slate-300 outline-none transition focus-visible:ring-2 focus-visible:ring-violet-300/70"
              >
                {languageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'All' ? 'All languages' : option}
                  </option>
                ))}
              </select>
              <span id="mood-guidance" className="text-xs text-slate-500">
                A sentence or two works best · Ctrl + Enter to analyze
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span id="mood-count" aria-live="polite" className="text-xs tabular-nums text-slate-600">
                {remaining} left
              </span>
              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-indigo-400 px-5 text-sm font-medium text-[#100e19] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101019] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Reading the moment
                  </>
                ) : (
                  <>
                    Analyze my mood <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.section
            key="analysis"
            role="status"
            aria-live="polite"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-auto mt-12 flex max-w-3xl items-center gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-7"
          >
            <div className="analysis-orb flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
              <AudioLines className="h-6 w-6 text-violet-100" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-medium text-white">{analysisStages[stage]}</p>
              <p className="mt-1 text-sm text-slate-500">An AI-generated signal for music discovery, not a diagnosis.</p>
              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {analysisStages.map((item, index) => (
                  <span
                    key={item}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      index <= stage ? 'w-8 bg-violet-300/80' : 'w-4 bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {error ? (
        <div
          role="alert"
          className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4 text-sm text-rose-100"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {result ? 'We couldn’t find recommendations right now.' : 'We couldn’t read your mood right now.'}
            </p>
            <p className="mt-1 text-rose-100/70">{error}</p>
          </div>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {result && visual ? (
          <motion.section
            key={`${result.emotion}-${result.mood}`}
            id="mood-result"
            aria-live="polite"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="mx-auto mt-14 max-w-5xl scroll-mt-24"
          >
            <div className="relative isolate overflow-hidden rounded-[1.8rem] border border-white/[0.08] bg-[#101019] p-6 sm:p-9 lg:p-11">
              <div className={`mood-aura absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-gradient-to-br ${visual.gradient} opacity-[0.13] blur-[90px]`} />
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <p className="eyebrow">Your mood, in this moment</p>
                  <div className="mt-6 flex items-center gap-4 sm:gap-5">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${visual.gradient} bg-opacity-10 sm:h-16 sm:w-16`}>
                      <MoodIcon className="h-7 w-7 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                        {result.label}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Your words leaned <span className="text-slate-200">{result.emotion}</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-5 max-w-lg text-sm leading-6 text-slate-400">{result.explanation}</p>
                  <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">
                    This is an AI interpretation to help shape music picks, not a psychological assessment.
                  </p>
                </div>

                <div className="min-w-52 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Model confidence · not accuracy</span>
                    <span className="font-medium tabular-nums text-slate-200">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                    role="progressbar"
                    aria-label="Model confidence"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(result.confidence * 100)}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(result.confidence * 100)}%` }}
                      transition={{ duration: 0.65, delay: 0.15 }}
                      className={`h-full rounded-full bg-gradient-to-r ${visual.gradient}`}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-white/[0.07] pt-6" aria-live="polite">
                <h3 className="text-sm font-medium text-white">Choose what you want from the music</h3>
                <p className="mt-1 text-xs text-slate-500">Your intent is separate from the emotion signal.</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {listeningIntents.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setIntent(option);
                        setResult((current) =>
                          current ? { ...current, recommendations: undefined } : current,
                        );
                      }}
                      aria-pressed={intent === option}
                      className={`min-h-11 rounded-xl border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
                        intent === option
                          ? 'border-violet-200/30 bg-violet-200/[0.12] text-violet-100'
                          : 'border-white/[0.08] bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {listeningIntentLabels[option]}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="recommendation-language" className="sr-only">
                    Recommendation language
                  </label>
                  <select
                    id="recommendation-language"
                    value={language}
                    onChange={(event) => {
                      setLanguage(event.target.value);
                      setResult((current) =>
                        current ? { ...current, recommendations: undefined } : current,
                      );
                    }}
                    className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#171721] px-3 text-xs text-slate-300 outline-none transition focus-visible:ring-2 focus-visible:ring-violet-300/70 sm:w-auto"
                  >
                    {languageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === 'All' ? 'All languages' : option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => generateRecommendations({ refresh: false })}
                    disabled={recommendationsLoading || !result}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-indigo-400 px-5 text-sm font-medium text-[#100e19] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101019] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {recommendationsLoading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    )}
                    {recommendationsLoading ? 'Finding your picks' : 'Find my music'}
                  </button>
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-white/[0.06] bg-black/15 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-medium text-slate-300">Emotional profile</h3>
                  <span className="text-[10px] text-slate-500">Model signal, not a diagnosis</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
                  {(['happy', 'sad', 'energetic', 'chill'] as const).map((mood) => (
                    <div key={mood}>
                      <div className="mb-1.5 flex justify-between text-[10px] text-slate-400">
                        <span>{moodMeta[mood].label}</span>
                        <span>{Math.round(result.mood_affinities[mood] * 100)}%</span>
                      </div>
                      <div
                        className="h-1 overflow-hidden rounded-full bg-white/[0.08]"
                        role="img"
                        aria-label={`${moodMeta[mood].label} affinity ${Math.round(result.mood_affinities[mood] * 100)} percent`}
                      >
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${moodMeta[mood].gradient}`}
                          style={{ width: `${Math.round(result.mood_affinities[mood] * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {recommendationsLoading && result?.recommendations ? (
                <div className="mt-9 border-t border-white/[0.07] pt-6">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">Music for your mood</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Shaped by your mood, intent, and listening preferences.
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">Refreshing your picks…</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, skeletonIndex) => (
                      <div
                        key={`recommendation-skeleton-${skeletonIndex}`}
                        className="animate-pulse overflow-hidden rounded-[1.1rem] border border-white/[0.06] bg-white/[0.03]"
                      >
                        <div className="h-48 w-full bg-white/[0.05]" />
                        <div className="space-y-3 p-3">
                          <div className="h-3 w-3/4 rounded bg-white/[0.08]" />
                          <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
                          <div className="flex gap-2 pt-2">
                            <div className="h-8 w-8 rounded-full bg-white/[0.08]" />
                            <div className="h-8 flex-1 rounded-full bg-white/[0.08]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!recommendationsLoading && result?.recommendations && result.recommendations.length > 0 ? (
                <div className="mt-9 border-t border-white/[0.07] pt-6">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">Music for your mood</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Shaped by your mood, intent, and listening preferences.
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {result.recommendations.length} tracks
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {result.recommendations.map((track, index) => (
                      <MusicCard
                        key={track.track_id}
                        track={track}
                        index={index}
                        onFeedback={handleFeedback}
                        feedback={{
                          liked: preferences.likedTrackIds.includes(track.track_id),
                          saved: preferences.savedTrackIds.includes(track.track_id),
                          skipped: preferences.skippedTrackIds.includes(track.track_id),
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => generateRecommendations({ refresh: true })}
                      disabled={recommendationsLoading}
                      className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.025] px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-violet-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101019] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {recommendationsLoading ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Get new picks
                    </button>
                  </div>
                </div>
              ) : !recommendationsLoading && result?.recommendations && result.recommendations.length === 0 ? (
                <div className="mt-9 rounded-2xl border border-white/[0.07] bg-black/20 p-6 text-center">
                  <Disc3 className="mx-auto h-7 w-7 text-slate-500" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-white">No fresh picks in this set.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Try another language, choose a different intent, or refresh for another set.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => generateRecommendations({ refresh: true })}
                      disabled={recommendationsLoading}
                      className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.025] px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-violet-300/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101019] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {recommendationsLoading ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Get new picks
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {!result && !loading && !error ? (
        <p className="mx-auto mt-9 flex max-w-max items-center gap-2 text-xs text-slate-600">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          No profile needed. Just music for this moment.
          <ArrowDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </p>
      ) : null}
    </div>
  );
}
