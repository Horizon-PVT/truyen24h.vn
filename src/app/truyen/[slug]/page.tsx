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
  if (!slug) return getFallbackNovel('');
  const rawSlug = slug.trim();
  const normalized = rawSlug.toLowerCase();

  // 1. Check in-memory server cache
  const cached = novelMemoryCache.get(rawSlug) || novelMemoryCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let novelData: any = null;

  // 2. Try Firestore (preserving exact case for doc ID first, then fallback to normalized)
  try {
    const db = adminDb();
    let snap: any = null;
    try {
      const p1 = db.collection('novels').doc(rawSlug).get();
      const t1 = new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500));
      snap = await Promise.race([p1, t1]);
    } catch { /* ignore */ }

    if (!snap?.exists && rawSlug !== normalized) {
      try {
        const p2 = db.collection('novels').doc(normalized).get();
        const t2 = new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500));
        snap = await Promise.race([p2, t2]);
      } catch { /* ignore */ }
    }

    if (snap && snap.exists) {
      const data = serializeFirestore({ id: snap.id, ...snap.data() }) as any;
      if (isPublicItem(data)) {
        novelData = data;
      }
    }
  } catch (err: any) {
    console.warn(`[fetchNovel] Firestore read failed for "${rawSlug}":`, err?.message || err);
  }

  // 3. Fallback to resilient static catalog if Firestore is down, empty, or quota-exceeded
  if (!novelData) {
    const fallback = getFallbackNovel(rawSlug);
    novelData = {
      ...fallback,
      coverUrl: resolveNovelCover(fallback),
    };
  }

  // 4. Ensure novel has chapters
  if (!novelData.chapters || novelData.chapters.length < 5) {
    const fallback = getFallbackNovel(rawSlug);
    novelData.chapters = fallback.chapters;
  }

  // 4. Save to server memory cache for 5 minutes
  if (novelData) {
    novelMemoryCache.set(rawSlug, {
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
  let novelData = await fetchNovel(slug);

  if (!novelData) {
    const fallback = getFallbackNovel(slug);
    novelData = {
      ...fallback,
      coverUrl: resolveNovelCover(fallback),
    };
  }

  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100">
      <TopNavBarClientWrapper />
      <NovelJsonLd novel={novelData} />
      <NovelDetailClient novel={novelData} />
    </div>
  );
}
