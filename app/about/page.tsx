import type { Metadata } from 'next';
import { ArrowDown, BrainCircuit, Disc3, Fingerprint, Music2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About MoodTune',
  description: 'Learn how MoodTune turns emotion into music discovery.',
};

const steps = [
  {
    title: 'Express',
    detail: 'Tell MoodTune how you are feeling in your own words.',
    icon: Fingerprint,
  },
  {
    title: 'Understand',
    detail: 'A transformer-based emotion model predicts a label and confidence score.',
    icon: BrainCircuit,
  },
  {
    title: 'Match',
    detail: 'The original emotion mapping connects that label to a musical mood.',
    icon: Music2,
  },
  {
    title: 'Discover',
    detail: 'The recommendation engine finds matching music in the catalog.',
    icon: Disc3,
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
        <p className="eyebrow">Behind the feeling</p>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] text-white sm:text-6xl">
          A little more in tune with you.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
          MoodTune is an emotion-aware music discovery experience. It pairs a real transformer-based emotion model with a mood-aware recommendation engine—so discovery can start with how a moment feels.
        </p>
      </header>

      <section className="mt-16">
        <div className="mb-5 flex items-center gap-3">
          <span className="eyebrow">From words to sound</span>
          <span className="h-px flex-1 bg-white/[0.07]" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, detail, icon: Icon }, index) => (
            <article key={title} className="rounded-2xl border border-white/[0.07] bg-[#101019] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs tabular-nums text-slate-600">0{index + 1}</span>
                <Icon className="h-4 w-4 text-violet-200" aria-hidden="true" />
              </div>
              <h2 className="mt-9 text-lg font-medium text-white">{title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{detail}</p>
              {index < steps.length - 1 ? (
                <ArrowDown className="mt-5 h-4 w-4 text-slate-700 lg:hidden" aria-hidden="true" />
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-8 border-t border-white/[0.07] pt-10 md:grid-cols-[0.75fr_1.25fr]">
        <div>
          <p className="eyebrow">The technology</p>
          <h2 className="mt-3 text-2xl font-medium text-white">Built with intention.</h2>
        </div>
        <div>
          <p className="max-w-2xl text-sm leading-7 text-slate-400">
            The web experience and recommendation API run in Next.js. A separate Python service loads the original Hugging Face model for inference. The model’s emotion label and confidence feed the preserved mood mapping; the music catalog is ranked using track mood and audio features.
          </p>
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
