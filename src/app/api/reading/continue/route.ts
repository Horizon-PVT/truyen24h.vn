/**
 * GET /api/reading/continue?uid={uid}&limit=10
 *
 * Returns the user's most recent reading-progress rows joined with
 * the corresponding novel meta (title, cover, latestChapterNumber)
 * so the homepage 'Tiếp tục đọc' carousel can render in one shot.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 10, 1), 30);
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const db = adminDb();
    const snap = await db
      .collection(`users/${uid}/reading_progress`)
      .orderBy('lastReadAt', 'desc')
      .limit(limit)
      .get();

    // Batch-fetch novel docs
    const progressRows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const novelDocs = await Promise.all(
      progressRows.map((p: any) => db.collection('novels').doc(p.novelId).get())
    );

    const items = progressRows.map((p: any, i: number) => {
      const novelSnap = novelDocs[i];
      if (!novelSnap.exists) return null;
      const novel = novelSnap.data() as any;
      return {
        novelId: p.novelId,
        title: novel.title,
        coverUrl: novel.coverUrl,
        genres: novel.genres || [],
        latestChapterNumber: novel.latestChapterNumber || 0,
        lastChapterId: p.lastChapterId,
        lastChapterNumber: p.lastChapterNumber || 0,
        scrollPercent: p.scrollPercent || 0,
        lastReadAt: p.lastReadAt?.toMillis?.() ?? null,
        unreadCount: Math.max(0, (novel.latestChapterNumber || 0) - (p.lastChapterNumber || 0)),
      };
    }).filter(Boolean);

    return NextResponse.json({ ok: true, items });
  } catch (err: any) {
    console.error('[reading/continue] error', err);
    return NextResponse.json({ error: err.message || 'Load failed' }, { status: 500 });
  }
}
