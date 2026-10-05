export type Mood = 'happy' | 'sad' | 'energetic' | 'chill';

export const moodMeta: Record<
  Mood,
  { label: string; description: string; gradient: string }
> = {
  happy: {
    label: 'Happy',
    description: 'Bright, optimistic, and full of lift.',
    gradient: 'from-amber-300 via-rose-300 to-violet-400',
  },
  sad: {
    label: 'Sad',
    description: 'Reflective and emotionally heavy.',
    gradient: 'from-blue-400 via-indigo-400 to-violet-400',
  },
  energetic: {
    label: 'Energetic',
    description: 'Driven, vibrant, and ready for momentum.',
    gradient: 'from-fuchsia-400 via-violet-400 to-blue-400',
  },
  chill: {
    label: 'Chill',
    description: 'Calm, grounded, and relaxed.',
    gradient: 'from-sky-300 via-indigo-300 to-violet-300',
  },
};
