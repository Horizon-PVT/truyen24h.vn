import { Suspense } from 'react';
import SearchClient from './SearchClient';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

export const metadata = {
  title: 'Bộ Lọc & Tìm Kiếm Truyện Hay - Truyen24h.vn',
  description: 'Tìm kiếm truyện theo thể loại Tiên Hiệp, Huyền Huyễn, Ngôn Tình, Đô Thị, Trọng Sinh... Lọc theo số chương, trạng thái hoàn thành và lượt xem cao nhất.',
  alternates: { canonical: absoluteUrl('/tim-kiem') },
  openGraph: {
    title: `Tìm Kiếm Truyện - ${SITE_NAME}`,
    description: 'Bộ lọc và tìm kiếm truyện chữ chất lượng cao tại Truyen24h.vn.',
    url: absoluteUrl('/tim-kiem'),
    siteName: SITE_NAME,
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0C10] flex items-center justify-center p-20 text-slate-400">Đang tải bộ lọc truyện...</div>}>
      <SearchClient />
    </Suspense>
  );
}
