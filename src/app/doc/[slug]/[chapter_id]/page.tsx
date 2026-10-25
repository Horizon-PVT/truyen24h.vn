import { notFound } from 'next/navigation';
import ReaderClient from './ReaderClient';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { ChapterJsonLd } from '@/components/JsonLd';
import { adminDb } from '@/lib/firebaseAdmin';
import { serializeFirestore } from '@/lib/serialize';
import { isPublicItem } from '@/lib/visibilityGuard';
import { getFallbackChapter } from '@/data/fallbackNovels';
import { resolveNovelCover } from '@/lib/covers';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const revalidate = 300;

type SerializedNovel = Record<string, unknown> & {
  id: string;
  title?: string;
  coverUrl?: string;
  slug?: string;
};

type SerializedChapter = Record<string, unknown> & {
  id: string;
  title?: string;
  chapterNumber?: number;
  content?: string;
  isVip?: boolean;
  coinPrice?: number;
};

type FetchResult = {
  novel: SerializedNovel;
  chapter: SerializedChapter;
};

// In-memory cache for chapters to reduce server loads
const chapterMemoryCache = new Map<string, { data: FetchResult; expiresAt: number }>();

async function fetchNovelAndChapter(slug: string, chapterId: string): Promise<FetchResult> {
  const rawSlug = (slug || '').trim();
  const rawChapterId = (chapterId || '').trim();
  const cacheKey = `${rawSlug.toLowerCase()}__${rawChapterId.toLowerCase()}`;

  const cached = chapterMemoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let result: FetchResult | null = null;

  // 1. Try reading from Firestore with a 2.5s timeout
  try {
    const db = adminDb();
    const fetchPromise = (async () => {
      // Try exact doc ID first, then try slug query
      let novelSnap = await db.collection('novels').doc(rawSlug).get();
      if (!novelSnap.exists) {
        const qSnap = await db.collection('novels').where('slug', '==', rawSlug.toLowerCase()).limit(1).get();
        if (!qSnap.empty) {
          novelSnap = qSnap.docs[0];
        }
      }

      if (!novelSnap.exists) return null;
      const novelData = novelSnap.data();
      if (!isPublicItem(novelData)) return null;

      // Sibling chapters for reader menu
      const chaptersSnap = await db
        .collection(`novels/${novelSnap.id}/chapters`)
        .orderBy('chapterNumber', 'asc')
        .get();
      const chaptersData = chaptersSnap.docs
        .map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }))
        .filter(isPublicItem);

      // Chapter lookup: try rawChapterId, then lowercase
      let chapterSnap = await db.doc(`novels/${novelSnap.id}/chapters/${rawChapterId}`).get();
      if (!chapterSnap.exists && rawChapterId !== rawChapterId.toLowerCase()) {
        chapterSnap = await db.doc(`novels/${novelSnap.id}/chapters/${rawChapterId.toLowerCase()}`).get();
      }

      let chapterData: any = chapterSnap.exists ? chapterSnap.data() : null;

      // If chapter doesn't exist in Firestore, or content is empty / short (<300 chars), synthesize full story
      if (!chapterData || !chapterData.content || String(chapterData.content).trim().length < 300) {
        const fallback = getFallbackChapter(rawSlug, rawChapterId);
        if (fallback?.chapter) {
          chapterData = {
            ...(chapterData || {}),
            id: chapterData?.id || fallback.chapter.id,
            chapterNumber: chapterData?.chapterNumber || fallback.chapter.chapterNumber,
            title: chapterData?.title || fallback.chapter.title,
            content: fallback.chapter.content,
            isVip: chapterData?.isVip ?? fallback.chapter.isVip,
            coinPrice: chapterData?.coinPrice ?? fallback.chapter.coinPrice,
          };
        }
      }

      if (!chapterData) return null;

      return {
        novel: serializeFirestore({ 
          id: novelSnap.id, 
          ...novelData, 
          chapters: chaptersData.length > 0 ? chaptersData : undefined 
        }) as SerializedNovel,
        chapter: serializeFirestore({ 
          id: chapterSnap.exists ? chapterSnap.id : (chapterData.id || rawChapterId), 
          ...chapterData 
        }) as SerializedChapter,
      } satisfies FetchResult;
    })();

    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Firestore read timeout (2500ms)')), 2500)
    );

    result = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn(`[fetchNovelAndChapter] Firestore read error for "${rawSlug}/${rawChapterId}":`, err?.message || err);
  }

  // 2. Resilient fallback catalog (guaranteed never null)
  if (!result || !result.chapter) {
    const fallbackData = getFallbackChapter(rawSlug, rawChapterId);
    result = {
      novel: {
        ...fallbackData.novel,
        coverUrl: resolveNovelCover(fallbackData.novel),
      } as SerializedNovel,
      chapter: fallbackData.chapter as unknown as SerializedChapter,
    };
  }

  // 3. Cache result in memory for 5 minutes
  chapterMemoryCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + 300_000,
  });

  return result;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string, chapter_id: string }> }) {
  const { slug, chapter_id } = await params;
  const result = await fetchNovelAndChapter(slug, chapter_id);

  const { novel, chapter } = result;
  const coverUrl = novel.coverUrl || '/logo.jpg';
  const pageTitle = `Chương ${chapter.chapterNumber}: ${chapter.title} - ${novel.title}`;
  const pageDesc = `Đọc truyện ${novel.title} - Chương ${chapter.chapterNumber}: ${chapter.title} online chất lượng cao tại Truyen24h.vn`;
  const canonical = absoluteUrl(`/doc/${slug}/${chapter_id}`);

  return {
    title: pageTitle,
    description: pageDesc,
    alternates: { canonical },
    openGraph: {
      title: `${pageTitle} - ${SITE_NAME}`,
      description: pageDesc,
      url: canonical,
      siteName: SITE_NAME,
      images: [{ url: coverUrl, width: 400, height: 600, alt: pageTitle }],
      locale: 'vi_VN',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDesc,
      images: [coverUrl],
    },
  };
}

export default async function ChapterPage({ params }: { params: Promise<{ slug: string, chapter_id: string }> }) {
  const { slug, chapter_id } = await params;
  const result = await fetchNovelAndChapter(slug, chapter_id);

  return (
    <>
      <ChapterJsonLd novel={result.novel} chapter={result.chapter} />
      <ReaderClient novel={result.novel} chapter={result.chapter} />
    </>
  );
}
