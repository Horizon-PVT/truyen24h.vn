import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import AuthorPayoutPanel from '@/components/AuthorPayoutPanel';

export const metadata = {
  title: 'Doanh thu & Rút tiền | Creator Studio',
  robots: { index: false, follow: false },
};

export default function AuthorPayoutPage() {
  return (
    <div className="min-h-screen bg-background text-text-main flex flex-col">
      <header className="sticky top-0 z-50 px-4 md:px-8 py-4 backdrop-blur-xl border-b border-accent/10">
        <TopNavBarClientWrapper />
      </header>
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-8">
        <AuthorPayoutPanel />
      </main>
    </div>
  );
}
