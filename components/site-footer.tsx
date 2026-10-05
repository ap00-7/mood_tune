import Link from 'next/link';
import { AudioLines } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.07] pb-24 md:pb-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white">
          <AudioLines className="h-4 w-4 text-violet-200" aria-hidden="true" />
          <span className="font-medium tracking-[0.15em]">MOODTUNE</span>
        </Link>
        <p>Music for the feeling you’re in.</p>
        <Link href="/about" className="transition hover:text-slate-300">
          How it works
        </Link>
      </div>
    </footer>
  );
}
