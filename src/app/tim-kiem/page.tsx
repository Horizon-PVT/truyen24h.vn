import { Suspense } from 'react';
import SearchClient from './SearchClient';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const genre = typeof params.genre === 'string' ? params.genre : (typeof params['the-loai'] === 'string' ? params['the-loai'] : undefined);
  const title = genre 
    ? `Truyện ${genre.toUpperCase()} - Bộ Lọc & Tìm Kiếm Truyện Hay | ${SITE_NAME}`
    : `Bộ Lọc & Tìm Kiếm Truyện Hay - ${SITE_NAME}`;
  const description = 'Tìm kiếm truyện theo thể loại Tiên Hiệp, Huyền Huyễn, Ngôn Tình, Đô Thị, Trọng Sinh... Lọc theo số chương, trạng thái hoàn thành và lượt xem cao nhất.';
  const canonical = genre ? absoluteUrl(`/tim-kiem?genre=${genre}`) : absoluteUrl('/tim-kiem');

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: 'vi_VN',
      type: 'website',
    },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const initialGenre = typeof params.genre === 'string' ? params.genre : (typeof params['the-loai'] === 'string' ? params['the-loai'] : undefined);
  const initialSearch = typeof params.q === 'string' ? params.q : (typeof params['tu-khoa'] === 'string' ? params['tu-khoa'] : undefined);
  const initialChapters = typeof params.chapters === 'string' ? params.chapters : undefined;

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0C10] flex items-center justify-center p-20 text-slate-400">Đang tải bộ lọc truyện...</div>}>
      <SearchClient 
        serverGenre={initialGenre}
        serverSearch={initialSearch}
        serverChapters={initialChapters}
      />
    </Suspense>
  );
}
