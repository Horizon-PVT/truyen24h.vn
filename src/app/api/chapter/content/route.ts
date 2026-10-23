/**
 * GET /api/chapter/content?novelId={novelId}&chapterId={chapterId}
 *
 * Secure server endpoint for fetching VIP chapter full content.
 * Enforces authorization:
 *   1. Free chapters: Anyone can read.
 *   2. VIP chapters: Caller must be authenticated AND have:
 *      - Active monthly VIP, OR
 *      - Unlocked the chapter (in user.unlockedChapters), OR
 *      - Be the author of the novel, OR
 *      - Be an admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { requireFirebaseUser, authorizeAdmin } from '@/lib/apiAuth';
import { isVipActive } from '@/lib/vip';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const novelId = req.nextUrl.searchParams.get('novelId');
  const chapterId = req.nextUrl.searchParams.get('chapterId');

  if (!novelId || !chapterId) {
    return NextResponse.json({ error: 'Missing novelId or chapterId' }, { status: 400 });
  }

  try {
    const db = adminDb();
    const chapterRef = db.doc(`novels/${novelId}/chapters/${chapterId}`);
    const chapterSnap = await chapterRef.get();

    if (!chapterSnap.exists) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const chapterData = chapterSnap.data() as any;

    // If free chapter, return content directly
    if (!chapterData.isVip) {
      return NextResponse.json({ ok: true, content: chapterData.content || '' });
    }

    // For VIP chapters, require valid authorization
    const auth = await requireFirebaseUser(req);
    if (!auth.ok) {
      // Check if server admin
      const adminAuth = await authorizeAdmin(req);
      if (!adminAuth.ok) {
        return NextResponse.json({ error: 'Vui lòng đăng nhập để đọc chương VIP' }, { status: 401 });
      }
      return NextResponse.json({ ok: true, content: chapterData.content || '' });
    }

    const uid = auth.user.uid;

    // Check if caller is novel author
    const novelSnap = await db.collection('novels').doc(novelId).get();
    if (novelSnap.exists && novelSnap.data()?.authorId === uid) {
      return NextResponse.json({ ok: true, content: chapterData.content || '' });
    }

    // Check caller's user document (VIP status & unlockedChapters)
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnap.data() as any;
    const hasVip = isVipActive(userData);
    const hasUnlocked = Array.isArray(userData.unlockedChapters) && userData.unlockedChapters.includes(chapterId);

    if (hasVip || hasUnlocked) {
      return NextResponse.json({ ok: true, content: chapterData.content || '' });
    }

    return NextResponse.json({ error: 'Chương này chưa được mở khóa', locked: true }, { status: 403 });
  } catch (err: any) {
    console.error('[chapter/content] error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
