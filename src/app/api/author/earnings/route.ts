/**
 * GET /api/author/earnings?uid={uid}
 *
 * Aggregates an author's earnings from the transactions collection
 * (where type is UNLOCK_CHAPTER or DONATE and authorId == uid).
 *
 * Returns:
 *   currentBalance: number  // xu currently in their wallet
 *   thisMonthXu, thisMonthVnd
 *   allTimeXu, allTimeVnd
 *   unlockCount, donateCount
 *   recent: [{type, amount, novelId?, createdAt}]
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const XU_TO_VND = 100;

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const db = adminDb();
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const currentBalance = Number((userSnap.data() as any).coins || 0);

    const txSnap = await db
      .collection('transactions')
      .where('authorId', '==', uid)
      .limit(500)
      .get();

    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    let thisMonthXu = 0;
    let allTimeXu = 0;
    let unlockCount = 0;
    let donateCount = 0;
    const recent: any[] = [];

    txSnap.forEach((d: any) => {
      const data = d.data() as any;
      const share = Number(data.authorShare || data.amount || 0);
      allTimeXu += share;
      const ms = data.createdAt?.toMillis?.() ?? 0;
      if (ms >= monthAgo) thisMonthXu += share;
      if (data.type === 'UNLOCK_CHAPTER') unlockCount++;
      else if (data.type === 'DONATE') donateCount++;
      recent.push({
        type: data.type,
        amount: share,
        novelId: data.novelId,
        createdAt: ms || null,
      });
    });
    recent.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({
      ok: true,
      currentBalance,
      thisMonthXu,
      thisMonthVnd: thisMonthXu * XU_TO_VND,
      allTimeXu,
      allTimeVnd: allTimeXu * XU_TO_VND,
      unlockCount,
      donateCount,
      recent: recent.slice(0, 20),
    });
  } catch (err: any) {
    console.error('[author/earnings] error', err);
    return NextResponse.json({ error: err.message || 'Load failed' }, { status: 500 });
  }
}
