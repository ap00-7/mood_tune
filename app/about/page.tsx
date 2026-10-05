import type { Metadata } from 'next';
import { ArrowDown, BrainCircuit, Disc3, Fingerprint, Music2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About MoodTune',
  description: 'How MoodTune turns an AI emotion signal and your music choices into discovery.',
};

const steps = [
  {
    title: 'Your words',
    detail: 'You choose what to share. Mood text is sent for analysis, but is never added to the local preference profile.',
    icon: Fingerprint,
  },
  {
    title: 'Emotion distribution',
    detail: 'A pretrained Hugging Face transformer returns its emotion-label distribution. The model is English-focused.',
    icon: BrainCircuit,
  },
  {
    title: 'Mood affinity + intent',
    detail: 'Model scores map through the existing mood mapping. You separately choose whether to match, lift, calm, or add energy.',
    icon: Music2,
  },
  {
    title: 'Local preferences',
    detail: 'Likes, saves, skips, feature preferences, and repeated language choices stay in this browser. No account is required.',
    icon: Fingerprint,
  },
  {
    title: 'Hybrid ranking',
    detail: 'A transparent deterministic ranker combines available emotion, intent, catalog feature, preference, and metadata signals.',
    icon: Disc3,
  },
  {
    title: 'Feedback loop',
    detail: 'Your next request can use bounded feedback signals to adjust music ranking. This is not a trained recommendation model.',
    icon: Music2,
  },
];

const stack = [
  'Next.js',
  'TypeScript',
  'React',
  'Tailwind CSS',
  'FastAPI',
  'Python',
  'Hugging Face Transformers',
  'PyTorch',
  'Vercel',
];

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-[calc(100svh-4.5rem)] max-w-7xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <header className="max-w-3xl">
        <p className="eyebrow">Behind the listening</p>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
          Music discovery that adapts to your choices.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
          MoodTune turns how you are feeling into a music discovery starting point, then lets your own choices shape what comes next. Its emotion model offers a signal—not certainty about a person.
        </p>
      </header>

      <section className="mt-14" aria-labelledby="flow-heading">
        <div className="mb-5 flex items-center gap-3">
          <span id="flow-heading" className="eyebrow">How a recommendation is made</span>
          <span className="h-px flex-1 bg-white/[0.07]" />
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ title, detail, icon: Icon }, index) => (
            <li key={title} className="rounded-2xl border border-white/[0.07] bg-[#101019] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs tabular-nums text-slate-600">0{index + 1}</span>
                <Icon className="h-4 w-4 text-violet-200" aria-hidden="true" />
              </div>
              <h2 className="mt-7 text-lg font-medium text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
              {index < steps.length - 1 ? (
                <ArrowDown className="mt-4 h-4 w-4 text-slate-700 lg:hidden" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-center text-xs leading-6 text-slate-500">
          User text → emotion classifier → emotion distribution → mood affinity → listening intent → local preference profile → hybrid ranking → feedback
        </p>
      </section>

      <section className="mt-16 grid gap-8 border-t border-white/[0.07] pt-10 md:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="eyebrow">Transparent by design</p>
          <h2 className="mt-3 text-2xl font-medium text-white">A signal, not a diagnosis.</h2>
        </div>
        <div>
          <ul className="max-w-2xl space-y-3 text-sm leading-7 text-slate-400">
            <li>The emotion classifier is a pretrained Hugging Face transformer and is English-focused.</li>
            <li>Model confidence is the score for its leading label; it is not emotional accuracy.</li>
            <li>Recommendations use deterministic hybrid ranking over the existing catalog, not a trained or neural recommender.</li>
            <li>Preference data is stored locally in your browser. No account is required, and raw mood text is not stored in that profile.</li>
            <li>MoodTune is for music discovery. Its model output and recommendations are not medical or psychological advice.</li>
          </ul>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Technologies used">
            {stack.map((technology) => (
              <li key={technology} className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-slate-400">
                {technology}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
