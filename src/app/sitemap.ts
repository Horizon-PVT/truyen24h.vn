import { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import { getSiteUrl } from '@/lib/site';
import { isPublicItem } from '@/lib/visibilityGuard';
import { FALLBACK_NOVELS } from '@/data/fallbackNovels';

// Revalidate once every 24 hours — NEVER burn Firestore reads on every crawler hit!
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const now = new Date();

  // 1. Static Core Canonical Landing Pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/bang-xep-hang`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/tim-kiem`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/tac-gia`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/gioi-thieu`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/vip`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/chinh-sach-bao-mat`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/dieu-khoan-su-dung`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // 2. Collect Novel Slugs (Merge Firestore + Fallback with Canonical Slugs)
  const novelMap = new Map<string, { url: string; lastModified: Date; priority: number }>();

  // Add all curated fallback novels first
  for (const novel of FALLBACK_NOVELS) {
    const slug = (novel as any).slug || novel.id;
    novelMap.set(slug, {
      url: `${baseUrl}/truyen/${slug}`,
      lastModified: new Date(novel.updatedAt || now),
      priority: 0.9,
    });
  }

  // Attempt Firestore read with safe 2s timeout
  try {
    const snapPromise = adminDb().collection('novels').limit(100).get();
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Sitemap Firestore timeout')), 2000)
    );
    const snap = await Promise.race([snapPromise, timeoutPromise]) as any;

    if (snap && snap.docs) {
      snap.docs
        .filter((d: any) => isPublicItem(d.data()))
        .forEach((d: any) => {
          const data = d.data() as any;
          const slug = data.slug || d.id;
          const ms = data.updatedAt?.toMillis?.() ?? Date.now();
          novelMap.set(slug, {
            url: `${baseUrl}/truyen/${slug}`,
            lastModified: new Date(ms),
            priority: 0.9,
          });
        });
    }
  } catch (e: any) {
    console.warn('[sitemap] Firestore read skipped, using static catalog:', e?.message || e);
  }

  const novelPages: MetadataRoute.Sitemap = Array.from(novelMap.values()).map(item => ({
    url: item.url,
    lastModified: item.lastModified,
    changeFrequency: 'daily' as const,
    priority: item.priority,
  }));

  // 3. Sample Core Chapter Pages for Crawlers (Unique & Verified Content)
  const chapterPages: MetadataRoute.Sitemap = [];
  for (const novel of FALLBACK_NOVELS) {
    const slug = (novel as any).slug || novel.id;
    for (const chap of novel.chapters.slice(0, 3)) {
      chapterPages.push({
        url: `${baseUrl}/doc/${slug}/${chap.id}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      });
    }
  }

  return [...staticPages, ...novelPages, ...chapterPages];
}
