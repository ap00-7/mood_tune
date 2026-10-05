import type { Metadata } from 'next';

import { CatalogBrowser } from '@/components/catalog-browser';

export const metadata: Metadata = {
  title: 'Your recommendations — MoodTune',
  description: 'Explore mood-aware music recommendations from the MoodTune catalog.',
};

export default function RecommendationsPage() {
  return (
    <main className="min-h-[calc(100svh-4.5rem)]">
      <CatalogBrowser recommendationsView />
    </main>
  );
}
