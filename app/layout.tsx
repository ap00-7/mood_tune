import '@/app/globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import { Navbar } from '@/components/navbar';
import { SiteFooter } from '@/components/site-footer';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'MoodTune — Music That Matches Your Mood',
  description: 'Share how you feel and discover music that fits the moment.',
  applicationName: 'MoodTune',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'MoodTune — Music That Matches Your Mood',
    description: 'Share how you feel and discover music that fits the moment.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MoodTune — Music That Matches Your Mood',
    description: 'Share how you feel and discover music that fits the moment.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-slate-950 text-white">
      <body className={`${sans.variable} ${display.variable} min-h-screen bg-[#090910] font-sans text-white antialiased`}>
        <Navbar />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
