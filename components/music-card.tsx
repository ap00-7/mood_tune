import Image from 'next/image';
import { ArrowUpRight, Disc3 } from 'lucide-react';

export type TrackResult = {
  track_name: string;
  artist_name: string;
  valence: number;
  energy: number;
  danceability: number;
  artwork_url: string;
  track_url: string;
  language: string;
};

export function MusicCard({
  track,
  index,
}: {
  track: TrackResult;
  index: number;
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
    </article>
  );
}
