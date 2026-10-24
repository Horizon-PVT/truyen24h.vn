import { notFound } from 'next/navigation';
import NovelDetailClient from './NovelDetailClient';
import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { NovelJsonLd } from '@/components/JsonLd';
import { adminDb } from '@/lib/firebaseAdmin';
import { serializeFirestore } from '@/lib/serialize';
import { isPublicItem } from '@/lib/visibilityGuard';
import { getFallbackNovel } from '@/data/fallbackNovels';
import { resolveNovelCover } from '@/lib/covers';

export const revalidate = 300;

// In-memory cache to eliminate repeated Firestore reads on VPS
const novelMemoryCache = new Map<string, { data: any; expiresAt: number }>();

async function fetchNovel(slug: string) {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();

  // 1. Check in-memory server cache
  const cached = novelMemoryCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let novelData: any = null;

  // 2. Try Firestore (with 2.5s strict timeout to prevent thread blocking)
  try {
    const firestorePromise = adminDb().collection('novels').doc(normalized).get();
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Firestore read timeout (2500ms)')), 2500)
    );

    const snap = await Promise.race([firestorePromise, timeoutPromise]) as any;
    if (snap && snap.exists) {
      const data = serializeFirestore({ id: snap.id, ...snap.data() }) as any;
      if (isPublicItem(data)) {
        novelData = data;
      }
    }
  } catch (err: any) {
    console.warn(`[fetchNovel] Firestore read failed for "${normalized}":`, err?.message || err);
  }

  // 3. Fallback to resilient static catalog if Firestore is down, empty, or quota-exceeded
  if (!novelData) {
    const fallback = getFallbackNovel(normalized);
    if (fallback) {
      novelData = {
        ...fallback,
        coverUrl: resolveNovelCover(fallback),
      };
    }
  }

  // 4. Save to server memory cache for 5 minutes
  if (novelData) {
    novelMemoryCache.set(normalized, {
      data: novelData,
      expiresAt: Date.now() + 300_000,
    });
  }

  return novelData;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchNovel(slug);
  if (!data) {
    return { 
      title: 'Truyện không tồn tại - Truyen24h.vn',
      robots: { index: false, follow: false },
    };
  }

  const canonical = absoluteUrl(`/truyen/${slug}`);
  const ogImage = absoluteUrl(`/api/og/novel/${slug}`);

  return {
    title: `${data.title} - Đọc Truyện VIP Online`,
    description: (data.description || '').slice(0, 160) + '...',
    alternates: { canonical },
    openGraph: {
      title: `${data.title} - ${SITE_NAME}`,
      description: (data.description || '').slice(0, 160) + '...',
      url: canonical,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Bìa truyện ${data.title}` }],
      locale: 'vi_VN',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description: (data.description || '').slice(0, 160) + '...',
      images: [ogImage],
    },
  };
}

export default async function NovelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const novelData = await fetchNovel(slug);

  if (!novelData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100">
      <TopNavBarClientWrapper />
      <NovelJsonLd novel={novelData} />
      <NovelDetailClient novel={novelData} />
    </div>
  );
}
