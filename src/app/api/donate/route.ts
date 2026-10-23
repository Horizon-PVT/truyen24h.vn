/**
 * POST /api/donate
 * Server-side endpoint for donating coins to an author.
 * Protected by verified Firebase user authentication.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp, FieldValue } from '@/lib/firebaseAdmin';
import { requireFirebaseUser } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireFirebaseUser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const donorId = auth.user.uid;
    const body = await request.json().catch(() => ({}));
    const { authorId, amount } = body;

    // Validate
    if (!authorId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const donateAmount = Math.floor(Number(amount));
    if (!Number.isFinite(donateAmount) || donateAmount <= 0 || donateAmount > 100000) {
      return NextResponse.json({ error: 'Số xu ủng hộ không hợp lệ (1 - 100,000)' }, { status: 400 });
    }

    if (donorId === authorId) {
      return NextResponse.json({ error: 'Không thể ủng hộ cho chính mình' }, { status: 400 });
    }

    const db = adminDb();
    const donorRef = db.collection('users').doc(donorId);
    const authorRef = db.collection('users').doc(authorId);
    const txRef = db.collection('transactions').doc();

    const result = await db.runTransaction(async (tx) => {
      const [donorSnap, authorSnap] = await Promise.all([
        tx.get(donorRef),
        tx.get(authorRef),
      ]);

      if (!donorSnap.exists) {
        throw new Error('Donor user not found');
      }
      if (!authorSnap.exists) {
        throw new Error('Author user not found');
      }

      const donorData = donorSnap.data() as any;
      const currentCoins = Number(donorData.coins || 0);

      if (currentCoins < donateAmount) {
        throw new Error(`Bạn không đủ Xu. Cần ${donateAmount} Xu, hiện có ${currentCoins} Xu.`);
      }

      // Deduct from donor
      tx.update(donorRef, {
        coins: FieldValue.increment(-donateAmount),
        contributionScore: FieldValue.increment(donateAmount),
        updatedAt: serverTimestamp(),
      });

      // Credit author
      tx.update(authorRef, {
        coins: FieldValue.increment(donateAmount),
        updatedAt: serverTimestamp(),
      });

      // Log transaction
      tx.set(txRef, {
        type: 'DONATE',
        donorId,
        authorId,
        buyerId: donorId,
        amount: donateAmount,
        createdAt: serverTimestamp(),
      });

      return {
        newBalance: currentCoins - donateAmount,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Đã ủng hộ ${donateAmount} Xu thành công!`,
      newBalance: result.newBalance,
    });
  } catch (error: any) {
    console.error('[donate] error:', error);
    return NextResponse.json(
      { error: error.message || 'Ủng hộ thất bại' },
      { status: 400 }
    );
  }
}
