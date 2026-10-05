import type { Metadata } from 'next';

import { CatalogBrowser } from '@/components/catalog-browser';

export const metadata: Metadata = {
  title: 'Your recommendations — MoodTune',
  description: 'Explore recommendations shaped by your mood, listening intent, and local preferences.',
};

export default function RecommendationsPage() {
  return (
    <main className="min-h-[calc(100svh-4.5rem)]">
      <CatalogBrowser />
    </main>
  );
}
