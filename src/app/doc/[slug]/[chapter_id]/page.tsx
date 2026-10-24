import ReaderClient from './ReaderClient';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { ChapterJsonLd } from '@/components/JsonLd';
import { adminDb } from '@/lib/firebaseAdmin';
import { serializeFirestore } from '@/lib/serialize';
import { isPublicItem } from '@/lib/visibilityGuard';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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

async function fetchNovelAndChapter(slug: string, chapterId: string): Promise<FetchResult | null> {
  try {
    const db = adminDb();
    const novelSnap = await db.collection('novels').doc(slug).get();
    if (!novelSnap.exists) return null;
    const novelData = novelSnap.data();
    if (!isPublicItem(novelData)) return null;

    const chapterSnap = await db.doc(`novels/${slug}/chapters/${chapterId}`).get();
    if (!chapterSnap.exists) return { novel: serializeFirestore({ id: novelSnap.id, ...novelData }) as SerializedNovel, chapter: null };
    const chapterData = chapterSnap.data();
    if (!isPublicItem(chapterData)) return null;

    // Sibling chapters for the in-reader chapter list.
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
  } catch (err: any) {
    console.warn('[fetchNovelAndChapter] Admin SDK read failed (e.g. quota limit):', err?.message || err);
    try {
      const { db } = await import('@/firebase');
      const { doc, getDoc } = await import('firebase/firestore');
      const novelSnap = await getDoc(doc(db, 'novels', slug));
      if (!novelSnap.exists()) return null;
      const chapterSnap = await getDoc(doc(db, 'novels', slug, 'chapters', chapterId));
      return {
        novel: serializeFirestore({ id: novelSnap.id, ...novelSnap.data(), chapters: [] }) as SerializedNovel,
        chapter: chapterSnap.exists() ? (serializeFirestore({ id: chapterSnap.id, ...chapterSnap.data() }) as SerializedChapter) : null,
      };
    } catch (clientErr) {
      console.warn('[fetchNovelAndChapter] Client fallback failed:', clientErr);
    }
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string, chapter_id: string }> }) {
  const { slug, chapter_id } = await params;
  const result = await fetchNovelAndChapter(slug, chapter_id);
  if (!result || !result.chapter) return { title: 'Đọc truyện' };

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
    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col items-center justify-center p-8 text-center gap-4">
        <h2 className="text-xl font-bold text-white">Chương truyện đang được cập nhật</h2>
        <p className="text-sm text-slate-400">Vui lòng quay lại sau hoặc đọc các chương khác.</p>
      </div>
    );
  }

  return (
    <>
      <ChapterJsonLd novel={result.novel} chapter={result.chapter} />
      <ReaderClient novel={result.novel} chapter={result.chapter} />
    </>
  );
}
