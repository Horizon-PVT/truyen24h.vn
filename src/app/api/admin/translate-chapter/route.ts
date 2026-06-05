/**
 * POST /api/admin/translate-chapter
 *
 * Translates a single chapter (Chinese raw text) into Vietnamese
 * and, if `persist` is true and `novelId` is supplied, immediately
 * writes the result as a chapter under that novel.
 *
 * Body: {
 *   raw: string,
 *   chapterNumber: number,
 *   novelTitle?: string,
 *   glossary?: Record<string,string>,
 *   persist?: boolean,
 *   novelId?: string,
 *   isVip?: boolean,
 *   price?: number,
 * }
 *
 * Auth: admin only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';
import { translateChapter } from '@/services/aiTranslateService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  try {
    const body = await req.json();
    const { raw, chapterNumber, novelTitle, glossary, persist, novelId, isVip, price } = body;
    if (!raw || !chapterNumber) {
      return NextResponse.json({ error: 'Missing raw or chapterNumber' }, { status: 400 });
    }
    const translated = await translateChapter({
      raw: String(raw),
      chapterNumber: Number(chapterNumber),
      novelTitle,
      glossary,
    });

    let savedAs: string | null = null;
    if (persist && novelId) {
      const db = adminDb();
      const num = Number(chapterNumber);
      const chapterId = `c${num}`;
      const finalIsVip = typeof isVip === 'boolean' ? isVip : num >= 4;
      const finalPrice = finalIsVip ? Number(price) || 50 : 0;
      const batch = db.batch();
      batch.set(db.doc(`novels/${novelId}/chapters/${chapterId}`), {
        id: chapterId,
        title: translated.title,
        content: translated.content,
        chapterNumber: num,
        isVip: finalIsVip,
        price: finalPrice,
        publishDate: serverTimestamp(),
        aiAssisted: true,
        translatedFromChinese: true,
      });
      batch.update(db.doc(`novels/${novelId}`), {
        latestChapterNumber: num,
        updatedAt: serverTimestamp(),
        lastUpdated: new Date().toISOString(),
      });
      await batch.commit();
      savedAs = `novels/${novelId}/chapters/${chapterId}`;
    }

    return NextResponse.json({ ok: true, ...translated, savedAs });
  } catch (err: unknown) {
    console.error('[admin/translate-chapter] error', err);
    const message = err instanceof Error ? err.message : 'Translate failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
