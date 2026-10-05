'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Disc3, LoaderCircle, RefreshCw, SlidersHorizontal } from 'lucide-react';

import { MusicCard, type TrackResult } from '@/components/music-card';
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

const moods: Mood[] = ['happy', 'chill', 'energetic', 'sad'];
const languages = [
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
const PAGE_SIZE = 12;

type CatalogResult = {
  tracks: TrackResult[];
};

export function CatalogBrowser({
  recommendationsView = false,
}: {
  recommendationsView?: boolean;
}) {
  const [mood, setMood] = useState<Mood>('happy');
  const [language, setLanguage] = useState('All');
  const [tracks, setTracks] = useState<TrackResult[]>([]);
  const [preferences, setPreferences] = useState<PreferenceProfile>(createDefaultPreferenceProfile);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setPreferences(loadPreferenceProfile());
    setPreferencesReady(true);
  }, []);

  const fetchTracks = useCallback(async (requestedOffset: number, signal?: AbortSignal) => {
    const response = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood, language, limit: PAGE_SIZE, offset: requestedOffset, preferences }),
      signal,
      cache: 'no-store',
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : 'Music discovery is temporarily unavailable. Please try again.';
      throw new Error(message);
    }
    if (!payload || typeof payload !== 'object' || !('tracks' in payload) || !Array.isArray(payload.tracks)) {
      throw new Error('Music discovery returned an unexpected response.');
    }
    return (payload as CatalogResult).tracks;
  }, [language, mood, preferences]);

  useEffect(() => {
    if (!preferencesReady) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setOffset(0);
    fetchTracks(0, controller.signal)
      .then(setTracks)
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name !== 'AbortError') {
          setError(fetchError.message);
          setTracks([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fetchTracks, preferencesReady]);

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
        setTracks((current) => current.filter((candidate) => candidate.track_id !== track.track_id));
      }
      setError('');
    } catch (feedbackError) {
      console.error('Could not save local music preference', feedbackError);
      setError('Your feedback could not be saved on this device. Please try again.');
    }
  }

  async function refreshTracks() {
    if (refreshing || loading) return;
    setRefreshing(true);
    setError('');
    const nextOffset = offset + PAGE_SIZE;
    try {
      const nextTracks = await fetchTracks(nextOffset);
      if (nextTracks.length > 0) {
        setTracks(nextTracks);
        setOffset(nextOffset);
      } else {
        const firstTracks = await fetchTracks(0);
        setTracks(firstTracks);
        setOffset(0);
      }
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Music discovery is temporarily unavailable. Please try again.',
      );
    } finally {
      setRefreshing(false);
    }
  }

  const activeMeta = moodMeta[mood];

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <header className="flex flex-col gap-6 border-b border-white/[0.07] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{recommendationsView ? 'A little more in tune' : 'Made for exploration'}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            {recommendationsView ? 'Your listening, your way.' : 'Follow a feeling.'}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            {recommendationsView
              ? 'Catalog picks blend your selected mood, local listening preferences, and available track features. Choose an intent from Mood discovery for a more tailored set.'
              : 'Browse music by the mood you want to sit with. No analysis needed.'}
          </p>
          {recommendationsView && preferences.likedTrackIds.length + preferences.savedTrackIds.length === 0 ? (
            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
              Starting fresh? Mood and catalog features are enough to get useful picks. Likes and saves will tune future sets.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 sm:self-auto">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Tuned to the catalog
        </div>
      </header>

      <section aria-label="Choose a mood" className="py-8">
        <div className="flex flex-wrap gap-2.5">
          {moods.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMood(item)}
              aria-pressed={mood === item}
              className={`rounded-full border px-4 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
                mood === item
                  ? 'border-violet-200/30 bg-violet-200/[0.12] text-violet-100'
                  : 'border-white/[0.08] bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {moodMeta[item].label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${activeMeta.gradient}`} aria-hidden="true" />
            <div>
              <h2 className="text-lg font-medium text-white">{activeMeta.label}, in sound</h2>
              <p className="mt-0.5 text-xs text-slate-500">{activeMeta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="catalog-language" className="sr-only">
              Filter by language
            </label>
            <select
              id="catalog-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="min-h-10 rounded-xl border border-white/[0.08] bg-[#11111a] px-3 text-xs text-slate-300 outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              {languages.map((item) => (
                <option key={item} value={item}>
                  {item === 'All' ? 'All languages' : item}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={refreshTracks}
              disabled={loading || refreshing}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs text-slate-300 transition hover:border-violet-200/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              More picks
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid min-h-64 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02]"
            role="status"
            aria-live="polite"
          >
            <div className="text-center">
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-violet-200" aria-hidden="true" />
              <p className="mt-3 text-sm text-slate-400">Finding music in the catalog…</p>
            </div>
          </motion.div>
        ) : tracks.length ? (
          <motion.div
            key={`${mood}-${language}-${offset}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6"
          >
            {tracks.map((track, index) => (
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
          </motion.div>
        ) : !error ? (
          <div className="grid min-h-64 place-items-center rounded-3xl border border-white/[0.06] bg-white/[0.02] px-6 text-center">
            <div>
              <Disc3 className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-medium text-white">
                {preferences.skippedTrackIds.length > 0
                  ? 'No fresh picks in this set.'
                  : 'Nothing in this corner just yet.'}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {preferences.skippedTrackIds.length > 0
                  ? 'Tracks you skipped stay out of recommendations on this device. Try another mood or language.'
                  : 'Try another mood or remove the language filter. Your first picks work without any listening history.'}
              </p>
            </div>
          </div>
        ) : null}
      </AnimatePresence>

      {tracks.length > 0 && !loading ? (
        <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-5 text-xs text-slate-500">
          <span>Showing {tracks.length} catalog matches</span>
          <button
            type="button"
            onClick={refreshTracks}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            Find another set <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
