import { NextRequest, NextResponse } from 'next/server';
import { authorizeBot } from '@/lib/apiAuth';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await authorizeBot(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const {
      novelId,
      chapterNumber,
      title,
      content,
      isVip = false,
      coinPrice = 0,
    } = body;

    if (!novelId || typeof novelId !== 'string') {
      return NextResponse.json({ ok: false, error: 'Thiếu novelId' }, { status: 400 });
    }

    if (chapterNumber === undefined || typeof chapterNumber !== 'number') {
      return NextResponse.json({ ok: false, error: 'chapterNumber phải là số nguyên' }, { status: 400 });
    }

    if (!title || !content) {
      return NextResponse.json({ ok: false, error: 'Thiếu title hoặc content chương' }, { status: 400 });
    }

    const db = adminDb();
    const novelRef = db.collection('novels').doc(novelId);
    const novelSnap = await novelRef.get();

    if (!novelSnap.exists) {
      return NextResponse.json({ ok: false, error: `Không tìm thấy truyện với ID: ${novelId}` }, { status: 404 });
    }

    const chapterId = `c-${chapterNumber}`;
    const chapterRef = novelRef.collection('chapters').doc(chapterId);

    const chapterData: Record<string, any> = {
      chapterNumber,
      title: title.trim(),
      content: content.trim(),
      isVip: Boolean(isVip),
      coinPrice: isVip ? (coinPrice || 10) : 0,
      isPublic: true,
      approvalStatus: 'approved',
      updatedAt: serverTimestamp(),
    };

    const existingChap = await chapterRef.get();
    if (!existingChap.exists) {
      chapterData.createdAt = serverTimestamp();
      await chapterRef.set(chapterData);

      // Update parent novel stats
      const currentTotal = novelSnap.data()?.totalChapters || 0;
      await novelRef.update({
        totalChapters: Math.max(currentTotal, chapterNumber),
        lastChapter: title.trim(),
        lastChapterId: chapterId,
        updatedAt: serverTimestamp(),
      });
    } else {
      await chapterRef.set(chapterData, { merge: true });
      await novelRef.update({
        lastChapter: title.trim(),
        lastChapterId: chapterId,
        updatedAt: serverTimestamp(),
      });
    }

    return NextResponse.json({
      ok: true,
      chapter: {
        id: chapterId,
        chapterNumber,
        title: chapterData.title,
        novelId,
        isVip: chapterData.isVip,
        coinPrice: chapterData.coinPrice,
        url: `${getSiteUrl()}/doc/${novelId}/${chapterId}`,
        isCreated: !existingChap.exists,
      },
    });
  } catch (error: any) {
    console.error('Bot API chapters POST error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
