import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, AudioLines, Disc3, Headphones, Sparkles } from 'lucide-react';

const soundBars = [28, 48, 34, 72, 44, 86, 57, 38, 68, 43, 78, 30, 55, 40, 72, 34, 62, 45, 81, 36, 58, 27, 70, 42];

export default function HomePage() {
  return (
    <main>
      <section className="hero-wrap relative isolate overflow-hidden">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-16 px-5 py-16 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
          <div className="hero-copy relative z-10">
            <p className="eyebrow inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,.8)]" />
              AI-powered music discovery
            </p>
            <h1 className="mt-7 max-w-2xl text-balance text-[3.3rem] font-semibold leading-[0.98] tracking-[-0.065em] text-white sm:text-6xl lg:text-[5.25rem]">
              Music that
              <span className="block text-gradient">moves with you.</span>
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
              Turn how you’re feeling into music discovery that learns from your choices—without claiming to know exactly how you feel.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/mood" className="button-primary">
                Discover your mood <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/discover" className="button-secondary">
                Explore music <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-11 flex items-center gap-3 text-xs text-slate-500">
              <span className="flex -space-x-1.5" aria-hidden="true">
                {['from-violet-300 to-indigo-400', 'from-fuchsia-300 to-violet-400', 'from-sky-300 to-indigo-400'].map((color) => (
                  <span key={color} className={`h-5 w-5 rounded-full border-2 border-[#090910] bg-gradient-to-br ${color}`} />
                ))}
              </span>
              Four moods. A whole world of sound.
            </div>
          </div>

          <div className="hero-art relative mx-auto flex min-h-[25rem] w-full max-w-[34rem] items-center justify-center sm:min-h-[31rem]">
            <div className="hero-ring hero-ring-outer" aria-hidden="true" />
            <div className="hero-ring hero-ring-inner" aria-hidden="true" />
            <div className="hero-disc relative z-10 flex h-52 w-52 items-center justify-center rounded-full sm:h-64 sm:w-64">
              <div className="hero-disc-core flex h-32 w-32 items-center justify-center rounded-full sm:h-40 sm:w-40">
                <AudioLines className="h-12 w-12 text-white/90 sm:h-16 sm:w-16" strokeWidth={1.2} aria-hidden="true" />
              </div>
            </div>

            <div className="float-card float-card-top absolute left-0 top-[15%] z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#17151f]/85 p-3.5 shadow-2xl backdrop-blur-xl sm:left-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200/20 to-rose-300/10 text-amber-100">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-500">A moment</span>
                <span className="mt-0.5 block text-sm font-medium text-white">Emotion into sound</span>
              </span>
            </div>

            <div className="float-card float-card-bottom absolute bottom-[13%] right-0 z-20 rounded-2xl border border-white/10 bg-[#17151f]/85 p-4 shadow-2xl backdrop-blur-xl sm:right-1">
              <div className="mb-3 flex items-center justify-between gap-8">
                <span className="text-xs font-medium text-white">Find your frequency</span>
                <Disc3 className="h-4 w-4 text-violet-200" aria-hidden="true" />
              </div>
              <div className="flex h-10 items-center gap-[3px]" aria-hidden="true">
                {soundBars.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className="wave-bar w-[3px] rounded-full bg-gradient-to-t from-violet-500/70 to-sky-200/90"
                    style={{ height: `${height}%`, animationDelay: `${index * 35}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="absolute right-[10%] top-[11%] h-2 w-2 rounded-full bg-fuchsia-200/80 shadow-[0_0_18px_rgba(232,121,249,.7)]" aria-hidden="true" />
            <div className="absolute bottom-[24%] left-[12%] h-1.5 w-1.5 rounded-full bg-sky-200/80 shadow-[0_0_16px_rgba(125,211,252,.7)]" aria-hidden="true" />
          </div>
        </div>
        <Link href="/discover" className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-600 transition hover:text-slate-300 lg:flex">
          Find your next feeling <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 border-y border-white/[0.07] py-9 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="eyebrow">More than a playlist</p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight text-white sm:text-3xl">
              Meet yourself in the music.
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            MoodTune connects the feeling you put into words with music from a multilingual catalog. No endless scrolling—just a thoughtful place to begin.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Say what you feel', copy: 'A simple reflection gives your listening a starting point.', icon: Sparkles },
            { title: 'Find the signal', copy: 'A pretrained emotion model offers one interpretation—not a diagnosis.', icon: AudioLines },
            { title: 'Shape what comes next', copy: 'Likes, saves, and skips tune future picks on this device.', icon: Headphones },
          ].map(({ title, copy, icon: Icon }, index) => (
            <article key={title} className="feature-tile rounded-2xl border border-white/[0.07] bg-[#101019] p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="text-xs tabular-nums text-slate-600">0{index + 1}</span>
                <Icon className="h-4 w-4 text-violet-200/80" aria-hidden="true" />
              </div>
              <h3 className="mt-8 text-base font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
