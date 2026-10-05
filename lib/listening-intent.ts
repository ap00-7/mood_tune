export const listeningIntents = [
  'match_mood',
  'lift_me_up',
  'calm_me_down',
  'add_energy',
] as const;

export type ListeningIntent = (typeof listeningIntents)[number];

export const listeningIntentLabels: Record<ListeningIntent, string> = {
  match_mood: 'Match my mood',
  lift_me_up: 'Lift me up',
  calm_me_down: 'Calm me down',
  add_energy: 'Add energy',
};

export type IntentAudioProfile = {
  valence: number;
  energy: number;
  danceability: number;
  weights: {
    valence: number;
    energy: number;
    danceability: number;
  };
};

export const intentAudioProfiles: Record<ListeningIntent, IntentAudioProfile> = {
  match_mood: {
    valence: 0.55,
    energy: 0.55,
    danceability: 0.5,
    weights: { valence: 0.5, energy: 0.5, danceability: 0.35 },
  },
  lift_me_up: {
    valence: 0.8,
    energy: 0.65,
    danceability: 0.6,
    weights: { valence: 0.8, energy: 0.55, danceability: 0.4 },
  },
  calm_me_down: {
    valence: 0.45,
    energy: 0.25,
    danceability: 0.2,
    weights: { valence: 0.35, energy: 0.85, danceability: 0.4 },
  },
  add_energy: {
    valence: 0.6,
    energy: 0.9,
    danceability: 0.8,
    weights: { valence: 0.3, energy: 0.8, danceability: 0.6 },
  },
};

export function isListeningIntent(value: unknown): value is ListeningIntent {
  return typeof value === 'string' && listeningIntents.includes(value as ListeningIntent);
}

export function getIntentAudioProfile(intent: ListeningIntent): IntentAudioProfile {
  return intentAudioProfiles[intent];
}
