import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import LeaderboardView from '@/components/LeaderboardView';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { FALLBACK_LEADERS } from '@/data/fallbackLeaders';

export const revalidate = 3600;

export const metadata = {
  title: 'Bảng Xếp Hạng Độc Giả & Top Truyện Đọc Nhiều - Truyen24h.vn',
  description: 'Vinh danh những độc giả nhiệt huyết nhất, bảng vàng đại gia ủng hộ tác giả, và các bậc thầy đánh giá truyện trên Truyen24h.vn.',
  alternates: { canonical: absoluteUrl('/bang-xep-hang') },
  openGraph: {
    title: `Bảng Xếp Hạng - ${SITE_NAME}`,
    description: 'Vinh danh độc giả và truyện hot nhất nền tảng.',
    url: absoluteUrl('/bang-xep-hang'),
    siteName: SITE_NAME,
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100">
      <TopNavBarClientWrapper />
      <LeaderboardView initialLeaders={FALLBACK_LEADERS} />
    </div>
  );
}
