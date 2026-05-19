import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import TranslatorPanel from '@/components/TranslatorPanel';

export const metadata = {
  title: 'AI Translator | Admin',
  robots: { index: false, follow: false },
};

export default function AdminTranslatorPage() {
  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col">
      <header className="sticky top-0 z-50 px-4 md:px-8 py-4 backdrop-blur-xl border-b border-accent/10">
        <TopNavBarClientWrapper />
      </header>
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 py-8">
        <TranslatorPanel />
      </main>
    </div>
  );
}
