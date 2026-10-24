import { notFound } from 'next/navigation';
import NovelDetailClient from './NovelDetailClient';
import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { NovelJsonLd } from '@/components/JsonLd';
import { adminDb } from '@/lib/firebaseAdmin';
import { serializeFirestore } from '@/lib/serialize';
import { isPublicItem } from '@/lib/visibilityGuard';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

async function fetchNovel(slug: string) {
  try {
    const snap = await adminDb().collection('novels').doc(slug).get();
    if (!snap.exists) return null;
    const data = serializeFirestore({ id: snap.id, ...snap.data() }) as any;
    if (!isPublicItem(data)) return null;
    return data;
  } catch (err: any) {
    console.warn('[fetchNovel] Admin SDK read failed (e.g. quota limit):', err?.message || err);
    try {
      const { db } = await import('@/firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'novels', slug));
      if (snap.exists()) {
        const data = serializeFirestore({ id: snap.id, ...snap.data() }) as any;
        if (isPublicItem(data)) return data;
      }
    } catch (clientErr) {
      console.warn('[fetchNovel] Client SDK fallback also failed:', clientErr);
    }
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchNovel(slug);
  if (!data) return { title: 'Truyện không tồn tại' };

  const canonical = absoluteUrl(`/truyen/${slug}`);
  const ogImage = absoluteUrl(`/api/og/novel/${slug}`);

  return {
    title: `${data.title} - Đọc Truyện VIP`,
    description: (data.description || '').slice(0, 150) + '...',
    alternates: { canonical },
    openGraph: {
      title: `${data.title} - ${SITE_NAME}`,
      description: (data.description || '').slice(0, 150) + '...',
      url: canonical,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Bìa truyện ${data.title}` }],
      locale: 'vi_VN',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description: (data.description || '').slice(0, 150) + '...',
      images: [ogImage],
    },
  };
}

export default async function NovelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const novelData = await fetchNovel(slug);

  if (!novelData) {
    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col">
        <TopNavBarClientWrapper />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="p-4 rounded-full bg-white/5 border border-white/10 text-slate-400">
            📖
          </div>
          <h2 className="text-xl font-bold text-white">Truyện đang được cập nhật</h2>
          <p className="text-sm text-slate-400 max-w-md">Vui lòng quay lại sau ít phút hoặc chọn truyện khác trong danh sách.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100">
      <TopNavBarClientWrapper />
      <NovelJsonLd novel={novelData} />
      <NovelDetailClient novel={novelData} />
    </div>
  );
}
