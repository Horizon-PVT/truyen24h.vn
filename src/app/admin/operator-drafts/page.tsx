/**
 * Admin Operator Drafts manager page — review and publish AI drafts.
 */
import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import OperatorDraftsClient from '@/components/OperatorDraftsClient';

export const metadata = {
  title: 'Duyệt Draft AI | Admin',
  robots: { index: false, follow: false },
};

export default function AdminOperatorDraftsPage() {
  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col">
      <header className="sticky top-0 z-50 px-4 md:px-8 py-4 backdrop-blur-xl border-b border-accent/10">
        <TopNavBarClientWrapper />
      </header>
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 py-8">
        <OperatorDraftsClient />
      </main>
    </div>
  );
}
