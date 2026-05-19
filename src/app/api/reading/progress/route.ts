/**
 * POST /api/reading/progress
 *
 * Upserts the user's reading-progress doc for a given novel. The doc
 * lives at users/{uid}/reading_progress/{novelId} so we can index
 * "Tiếp tục đọc" cheaply (collection-group query on
 * reading_progress, ordered by lastReadAt desc).
 *
 * Body: {
 *   uid, novelId, chapterId, chapterNumber, scrollPercent?
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { uid, novelId, chapterId, chapterNumber, scrollPercent } = body;
    if (!uid || !novelId || !chapterId) {
      return NextResponse.json({ error: 'Missing uid, novelId, or chapterId' }, { status: 400 });
    }

    const db = adminDb();
    const ref = db.doc(`users/${uid}/reading_progress/${novelId}`);
    await ref.set({
      novelId,
      lastChapterId: chapterId,
      lastChapterNumber: Number(chapterNumber) || 0,
      scrollPercent: Math.max(0, Math.min(100, Number(scrollPercent) || 0)),
      lastReadAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[reading/progress] error', err);
    return NextResponse.json({ error: err.message || 'Save failed' }, { status: 500 });
  }
}
