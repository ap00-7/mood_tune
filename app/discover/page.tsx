import type { Metadata } from 'next';

import { CatalogBrowser } from '@/components/catalog-browser';

export const metadata: Metadata = {
  title: 'Discover music — MoodTune',
  description: 'Explore the MoodTune music catalog by mood and language.',
};

export default function DiscoverPage() {
  return (
    <main className="min-h-[calc(100svh-4.5rem)]">
      <CatalogBrowser />
    </main>
  );
}
