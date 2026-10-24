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
};

type SerializedChapter = Record<string, unknown> & {
  id: string;
  title?: string;
  chapterNumber?: number;
};

type FetchResult = {
  novel: SerializedNovel;
  chapter: SerializedChapter | null;
};

// In-memory cache for chapters to reduce server loads
const chapterMemoryCache = new Map<string, { data: FetchResult; expiresAt: number }>();

async function fetchNovelAndChapter(slug: string, chapterId: string): Promise<FetchResult | null> {
  if (!slug || !chapterId) return null;
  const cacheKey = `${slug.trim().toLowerCase()}__${chapterId.trim().toLowerCase()}`;

  const cached = chapterMemoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let result: FetchResult | null = null;

  // 1. Try reading from Firestore with a 2.5s timeout
  try {
    const db = adminDb();
    const fetchPromise = (async () => {
      const novelSnap = await db.collection('novels').doc(slug).get();
      if (!novelSnap.exists) return null;
      const novelData = novelSnap.data();
      if (!isPublicItem(novelData)) return null;

      const chapterSnap = await db.doc(`novels/${slug}/chapters/${chapterId}`).get();
      if (!chapterSnap.exists) {
        return {
          novel: serializeFirestore({ id: novelSnap.id, ...novelData }) as SerializedNovel,
          chapter: null,
        };
      }
      const chapterData = chapterSnap.data();
      if (!isPublicItem(chapterData)) return null;

      // Sibling chapters for reader menu
      const chaptersSnap = await db
        .collection(`novels/${slug}/chapters`)
        .orderBy('chapterNumber', 'asc')
        .get();
      const chaptersData = chaptersSnap.docs
        .map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }))
        .filter(isPublicItem);

      const safeChapterData = { ...chapterData };
      if (safeChapterData.isVip) {
        const raw = String(safeChapterData.content || '').trim();
        const teaser = raw.slice(0, 200).trim();
        safeChapterData.content = `${teaser}...\n\n[🔒 CHƯƠNG VIP: Nội dung này thuộc quyền sở hữu đặc biệt. Vui lòng đăng nhập và mở khóa để đọc toàn bộ.]`;
      }

      return {
        novel: serializeFirestore({ id: novelSnap.id, ...novelData, chapters: chaptersData }) as SerializedNovel,
        chapter: serializeFirestore({ id: chapterSnap.id, ...safeChapterData }) as SerializedChapter,
      } satisfies FetchResult;
    })();

    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Firestore read timeout (2500ms)')), 2500)
    );

    result = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn(`[fetchNovelAndChapter] Firestore read error for "${slug}/${chapterId}":`, err?.message || err);
  }

  // 2. Resilient fallback catalog
  if (!result || !result.chapter) {
    const fallbackData = getFallbackChapter(slug, chapterId);
    if (fallbackData) {
      result = {
        novel: {
          ...fallbackData.novel,
          coverUrl: resolveNovelCover(fallbackData.novel),
        } as SerializedNovel,
        chapter: fallbackData.chapter as unknown as SerializedChapter,
      };
    }
  }

  // 3. Cache result in memory for 5 minutes
  if (result && result.chapter) {
    chapterMemoryCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 300_000,
    });
  }

  return result;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string, chapter_id: string }> }) {
  const { slug, chapter_id } = await params;
  const result = await fetchNovelAndChapter(slug, chapter_id);
  if (!result || !result.chapter) {
    return {
      title: 'Chương không tồn tại - Truyen24h.vn',
      robots: { index: false, follow: false },
    };
  }

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

  if (!result || !result.chapter) {
    notFound();
  }

  return (
    <>
      <ChapterJsonLd novel={result.novel} chapter={result.chapter} />
      <ReaderClient novel={result.novel} chapter={result.chapter} />
    </>
  );
}
