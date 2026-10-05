import Image from 'next/image';
import { ArrowUpRight, Bookmark, Disc3, Heart, SkipForward } from 'lucide-react';

import type { Mood } from '@/lib/mood';
import type { TrackFeedback } from '@/lib/preferences';

export type TrackResult = {
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
  score?: {
    total: number;
    weights: Record<string, number>;
  };
};

export function MusicCard({
  track,
  index,
  feedback,
  onFeedback,
}: {
  track: TrackResult;
  index: number;
  feedback?: { liked: boolean; saved: boolean; skipped: boolean };
  onFeedback?: (track: TrackResult, action: TrackFeedback) => void;
}) {
  const hasLanguage = track.language && !['unknown', 'global'].includes(track.language.toLowerCase());

  return (
    <article
      className="music-card group rounded-2xl border border-white/[0.07] bg-[#11111a] p-3 transition duration-300 hover:-translate-y-1 hover:border-violet-200/20 hover:bg-[#151521] sm:rounded-[1.35rem] sm:p-3.5"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <a
        href={track.track_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${track.track_name} by ${track.artist_name} in Spotify`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <div className="relative aspect-square overflow-hidden rounded-xl bg-[#20202c]">
          {track.artwork_url ? (
            <Image
              src={track.artwork_url}
              alt={`${track.track_name} artwork`}
              fill
              sizes="(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 220px"
              priority={index === 0}
              className="object-cover transition duration-700 group-hover:scale-[1.045]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-950 to-indigo-950">
              <Disc3 className="h-12 w-12 text-violet-200/60" aria-hidden="true" />
            </div>
          )}
          <span className="absolute bottom-2.5 right-2.5 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-white text-[#11111a] opacity-0 shadow-xl transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="px-1 pb-1 pt-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium text-white sm:text-[15px]">{track.track_name}</h3>
              <p className="mt-1 truncate text-xs text-slate-400 sm:text-[13px]">{track.artist_name}</p>
            </div>
            {hasLanguage ? (
              <span className="mt-0.5 shrink-0 text-[10px] text-slate-500">{track.language}</span>
            ) : null}
          </div>
        </div>
      </a>
      {onFeedback ? (
        <div className="mt-2 flex items-center justify-end gap-1 border-t border-white/[0.06] pt-2">
          <button
            type="button"
            onClick={() => onFeedback(track, 'like')}
            aria-label={`Like ${track.track_name}`}
            aria-pressed={feedback?.liked ?? false}
            className={`rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              feedback?.liked ? 'text-rose-300' : 'text-slate-500 hover:text-rose-300'
            }`}
          >
            <Heart className="h-4 w-4" fill={feedback?.liked ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onFeedback(track, 'save')}
            aria-label={`Save ${track.track_name}`}
            aria-pressed={feedback?.saved ?? false}
            className={`rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              feedback?.saved ? 'text-violet-200' : 'text-slate-500 hover:text-violet-200'
            }`}
          >
            <Bookmark className="h-4 w-4" fill={feedback?.saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onFeedback(track, 'skip')}
            aria-label={`Skip ${track.track_name}`}
            aria-pressed={feedback?.skipped ?? false}
            className="rounded-lg p-2 text-slate-500 transition hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </article>
  );
}
