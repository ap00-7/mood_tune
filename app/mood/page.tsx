import type { Metadata } from 'next';

import { MoodDiscovery } from '@/components/mood-discovery';

export const metadata: Metadata = {
  title: 'Discover your mood — MoodTune',
  description: 'Share how you feel and find music for the moment.',
};

export default function MoodPage() {
  return (
    <main className="min-h-[calc(100svh-4.5rem)]">
      <MoodDiscovery />
    </main>
  );
}
