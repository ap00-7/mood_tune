'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Headphones, Home, Info, Sparkles } from 'lucide-react';

const navItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Mood', href: '/mood', icon: Sparkles },
  { label: 'Picks', href: '/recommendations', icon: Headphones },
  { label: 'About', href: '/about', icon: Info },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#090910]/85 backdrop-blur-2xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8"
        >
          <Link href="/" className="group flex items-center gap-3" aria-label="MoodTune home">
            <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl text-white">
              <span className="text-sm font-black">M</span>
            </span>
            <span className="text-[13px] font-semibold tracking-[0.22em] text-white">MOODTUNE</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map(({ label, href }) => {
              const active = pathname === href;
              return (
                <Link
                  key={label}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                    active ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <Link
            href="/mood"
            className="hidden items-center gap-2 rounded-full border border-violet-300/25 bg-violet-300/[0.08] px-4 py-2 text-xs font-medium text-violet-100 transition hover:border-violet-200/50 hover:bg-violet-300/[0.14] sm:inline-flex"
          >
            Find your sound <Sparkles className="h-3.5 w-3.5" />
          </Link>
          <span className="text-xs text-slate-500 sm:hidden">Made for this moment</span>
        </nav>
      </header>

      <nav
        aria-label="Mobile navigation"
        className="mobile-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-white/10 bg-[#0b0b13]/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-2xl md:hidden"
      >
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] transition ${
                active ? 'text-violet-200' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
