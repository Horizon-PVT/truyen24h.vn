/**
 * POST /api/unlock-chapter
 * Server-side endpoint for unlocking VIP chapters with atomic balance deduction.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp as adminTimestamp, FieldValue } from '@/lib/firebaseAdmin';
import { requireFirebaseUser } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireFirebaseUser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const buyerId = auth.user.uid;
    const body = await request.json().catch(() => ({}));
    const { novelId, chapterId, chapterPrice, authorId } = body;

    // Validate required fields
    if (!novelId || !chapterId || !authorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const price = Math.max(1, Number(chapterPrice) || 50);
    const db = adminDb();

    const buyerRef = db.collection('users').doc(buyerId);
    const chapterRef = db.doc(`novels/${novelId}/chapters/${chapterId}`);

    const result = await db.runTransaction(async (tx) => {
      const [buyerSnap, chapterSnap] = await Promise.all([
        tx.get(buyerRef),
        tx.get(chapterRef),
      ]);

      if (!buyerSnap.exists) {
        throw new Error('User not found');
      }
      if (!chapterSnap.exists) {
        throw new Error('Chapter not found');
      }

      const buyerData = buyerSnap.data() as any;
      const chapterData = chapterSnap.data() as any;
      const currentCoins = Number(buyerData.coins || 0);

      // Check if already unlocked
      const unlockedChapters: string[] = buyerData.unlockedChapters || [];
      if (unlockedChapters.includes(chapterId)) {
        return {
          alreadyUnlocked: true,
          content: chapterData.content || '',
          newCoins: currentCoins,
        };
      }

      if (currentCoins < price) {
        throw new Error(`Bạn không đủ Xu. Cần ${price} Xu, hiện có ${currentCoins} Xu.`);
      }

      // Calculate revenue split: 60% author, 40% platform
      const authorShare = Math.floor(price * 0.6);
      const platformFee = price - authorShare;

      // Deduct coins from buyer + add chapter to unlockedChapters
      tx.update(buyerRef, {
        coins: FieldValue.increment(-price),
        unlockedChapters: FieldValue.arrayUnion(chapterId),
        updatedAt: adminTimestamp(),
      });

      // Credit author (only if buyer != author)
      if (authorId !== buyerId) {
        const authorRef = db.collection('users').doc(authorId);
        tx.update(authorRef, {
          coins: FieldValue.increment(authorShare),
          updatedAt: adminTimestamp(),
        });
      }

      // Log transaction
      const txRef = db.collection('transactions').doc();
      tx.set(txRef, {
        type: 'UNLOCK_CHAPTER',
        chapterId,
        novelId,
        buyerId,
        authorId,
        price,
        authorShare,
        platformFee,
        createdAt: adminTimestamp(),
      });

      return {
        alreadyUnlocked: false,
        content: chapterData.content || '',
        newCoins: currentCoins - price,
        authorShare,
      };
    });

    // Increment daily mission 'unlock_vip' (best-effort, non-fatal)
    try {
      const today = new Date().toISOString().slice(0, 10);
      const progressRef = db.doc(`users/${buyerId}/daily_missions/${today}/progress/unlock_vip`);
      const dedupKey = `chapter:${chapterId}`;
      await db.runTransaction(async (tx) => {
        const p = await tx.get(progressRef);
        const data = (p.exists ? p.data() : {}) as any;
        const keys: string[] = data.dedupKeys || [];
        if (keys.includes(dedupKey)) return;
        tx.set(progressRef, {
          missionId: 'unlock_vip',
          count: (data.count || 0) + 1,
          dedupKeys: [...keys, dedupKey],
          updatedAt: adminTimestamp(),
          ...(p.exists ? {} : { createdAt: adminTimestamp(), claimed: false }),
        }, { merge: true });
      });
    } catch (_e) {}

    return NextResponse.json({
      success: true,
      message: 'Chapter unlocked successfully',
      content: result.content,
      newCoins: result.newCoins,
    });
  } catch (error: any) {
    console.error('[unlock-chapter] error:', error);
    return NextResponse.json(
      { error: error.message || 'Mở khóa chương thất bại' },
      { status: 400 }
    );
  }
}
