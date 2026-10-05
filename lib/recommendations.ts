import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import type { Mood } from '@/lib/mood';

export type Track = {
  track_name: string;
  artist_name: string;
  valence: number;
  energy: number;
  danceability: number;
  artwork_url: string;
  track_url: string;
  language: string;
  mood: Mood;
};

const DEFAULT_ARTWORK =
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80';

let cache: Track[] | null = null;

export async function loadTracks(): Promise<Track[]> {
  if (cache) {
    return cache;
  }

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
      const valence = Number(row.Valence ?? row.valence ?? 0.5);
      const energy = Number(row.energy ?? 0.5);
      const danceability = Number(row.danceability ?? 0.5);

      if (!trackName || !artistName) continue;
      const trackKey = `${trackName.toLowerCase()}|${artistName.toLowerCase()}|${language.toLowerCase()}`;
      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const track: Track = {
        track_name: trackName,
        artist_name: artistName,
        valence: Number.isFinite(valence) ? valence : 0.5,
        energy: Number.isFinite(energy) ? energy : 0.5,
        danceability: Number.isFinite(danceability) ? danceability : 0.5,
        artwork_url: row.artwork_url || row.image_url || DEFAULT_ARTWORK,
        track_url:
          row.track_url ||
          `https://open.spotify.com/search/${encodeURIComponent(`${trackName} ${artistName}`)}`,
        language: language || 'Global',
        mood: inferMoodFromFeatures(valence, energy),
      };

      records.push(track);
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

export async function getRecommendations({
  mood,
  language = 'All',
  limit = 5,
  offset = 0,
}: {
  mood: Mood;
  language?: string;
  limit?: number;
  offset?: number;
}) {
  const tracks = await loadTracks();
  const targetMood = mood;

  const filtered = tracks.filter((track) => {
    const matchesMood = track.mood === targetMood;
    const matchesLanguage = language === 'All' || track.language.toLowerCase() === language.toLowerCase();
    return matchesMood && matchesLanguage;
  });

  const ranked = filtered
    .map((track) => {
      const moodBoost = track.mood === targetMood ? 2 : 0;
      const energyBoost = track.energy * 1.5;
      const danceBoost = track.danceability * 1.4;
      const valenceBoost = Math.abs(track.valence - (targetMood === 'happy' ? 0.75 : targetMood === 'sad' ? 0.25 : targetMood === 'energetic' ? 0.52 : 0.6));
      const score = moodBoost + energyBoost + danceBoost - valenceBoost;
      return { track, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(Math.max(0, offset), Math.max(0, offset) + Math.max(1, limit));

  return ranked.map(({ track }) => ({
    track_name: track.track_name,
    artist_name: track.artist_name,
    valence: Number(track.valence.toFixed(2)),
    energy: Number(track.energy.toFixed(2)),
    danceability: Number(track.danceability.toFixed(2)),
    artwork_url: track.artwork_url,
    track_url: track.track_url,
    language: track.language,
  }));
}
