/**
 * Sitemap — emitted on every request (Next.js calls this in a server context).
 *
 * Uses Firebase Admin SDK.
 * Optimized: Only queries novels + latest active chapters to prevent quota burnout.
 */
import { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebaseAdmin';
import { getSiteUrl } from '@/lib/site';
import { isPublicItem } from '@/lib/visibilityGuard';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'always', priority: 1.0 },
    { url: `${baseUrl}/bang-xep-hang`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/tim-kiem`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/tac-gia`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/gioi-thieu`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/vip`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/chinh-sach-bao-mat`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/dieu-khoan-su-dung`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const snap = await adminDb().collection('novels').limit(500).get();
    const publicNovelDocs = snap.docs.filter((d: any) => isPublicItem(d.data()));

    const novelUrls: MetadataRoute.Sitemap = publicNovelDocs.map((d: any) => {
      const data = d.data() as any;
      const ms = data.updatedAt?.toMillis?.() ?? Date.now();
      return {
        url: `${baseUrl}/truyen/${d.id}`,
        lastModified: new Date(ms),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      };
    });

    let chapterUrls: MetadataRoute.Sitemap = [];
    try {
      // Limit to latest 1,000 chapters to prevent burning 77,000 Firestore reads
      const chaptersSnap = await adminDb()
        .collectionGroup('chapters')
        .limit(1000)
        .get();

      chapterUrls = chaptersSnap.docs
        .filter((c: any) => isPublicItem(c.data()))
        .map((c: any) => {
          const novelId = c.ref.parent.parent?.id;
          if (!novelId) return null;
          const data = c.data() as any;
          const ms = data.updatedAt?.toMillis?.() ?? data.createdAt?.toMillis?.() ?? Date.now();
          return {
            url: `${baseUrl}/doc/${novelId}/${c.id}`,
            lastModified: new Date(ms),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          };
        })
        .filter(Boolean) as MetadataRoute.Sitemap;
    } catch (e) {
      console.warn('Sitemap collectionGroup chapters warning:', e);
    }

    let blogUrls: MetadataRoute.Sitemap = [];
    try {
      const blogSnap = await adminDb().collection('blog_posts').limit(100).get();
      blogUrls = blogSnap.docs
        .filter((d: any) => isPublicItem(d.data()))
        .map((d: any) => {
          const data = d.data() as any;
          const ms = data.updatedAt?.toMillis?.() ?? data.createdAt?.toMillis?.() ?? Date.now();
          return {
            url: `${baseUrl}/blog/${d.id}`,
            lastModified: new Date(ms),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
          };
        });
    } catch {
      // Blog collection may not exist yet.
    }

    return [...staticPages, ...novelUrls, ...chapterUrls, ...blogUrls];
  } catch (err) {
    console.error('Sitemap generation error, returning static pages fallback:', err);
    return staticPages;
  }
}
