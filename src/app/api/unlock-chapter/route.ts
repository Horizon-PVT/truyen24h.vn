import { NextResponse } from 'next/server';
import type { Transaction as FirestoreTransaction } from 'firebase-admin/firestore';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

const AUTHOR_SHARE_RATIO = 0.6;
const DEFAULT_VIP_PRICE = 50;

type UnlockBody = {
  novelId?: unknown;
  chapterId?: unknown;
};

type ServerNovel = {
  authorId?: unknown;
  chapters?: unknown;
};

type ServerChapter = {
  id?: unknown;
  isVip?: unknown;
  price?: unknown;
  authorId?: unknown;
};

type ServerUser = {
  coins?: unknown;
  unlockedChapters?: unknown;
  vipUntil?: unknown;
};

function readId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) return null;
  return id;
}

function toMoneyNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function isActiveVip(value: unknown): boolean {
  const now = Date.now();
  if (value instanceof Date) return value.getTime() > now;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && parsed > now;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const toMillis = (value as { toMillis?: () => number }).toMillis;
    return typeof toMillis === 'function' && toMillis() > now;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    return typeof seconds === 'number' && seconds * 1000 > now;
  }
  return false;
}

function findEmbeddedChapter(chapters: unknown, chapterId: string): ServerChapter | null {
  if (!Array.isArray(chapters)) return null;
  const found = chapters.find((chapter) => {
    if (typeof chapter !== 'object' || chapter === null) return false;
    return (chapter as ServerChapter).id === chapterId;
  });
  return found && typeof found === 'object' ? (found as ServerChapter) : null;
}

function safeTransactionId(buyerId: string, novelId: string, chapterId: string): string {
  return `unlock_${buyerId}_${novelId}_${chapterId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function POST(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (!auth.ok) return auth.response;

  let body: UnlockBody;
  try {
    body = (await request.json()) as UnlockBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const novelId = readId(body.novelId);
  const chapterId = readId(body.chapterId);
  if (!novelId || !chapterId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const buyerId = auth.user.uid;
  const db = adminDb();
  const novelRef = db.doc(`novels/${novelId}`);
  const chapterRef = db.doc(`novels/${novelId}/chapters/${chapterId}`);
  const buyerRef = db.doc(`users/${buyerId}`);
  const transactionRef = db.doc(`transactions/${safeTransactionId(buyerId, novelId, chapterId)}`);

  try {
    const [novelSnap, chapterSnap] = await Promise.all([novelRef.get(), chapterRef.get()]);
    if (!novelSnap.exists) {
      return NextResponse.json({ error: 'Novel not found' }, { status: 404 });
    }

    const novel = novelSnap.data() as ServerNovel;
    const embeddedChapter = findEmbeddedChapter(novel.chapters, chapterId);
    const chapter = chapterSnap.exists ? (chapterSnap.data() as ServerChapter) : embeddedChapter;
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    if (typeof chapter.price === 'number' && chapter.price < 0) {
      return NextResponse.json({ error: 'Invalid chapter price' }, { status: 400 });
    }

    const isVipChapter = chapter.isVip === true;
    const serverPrice = isVipChapter ? toMoneyNumber(chapter.price) || DEFAULT_VIP_PRICE : 0;
    const authorId =
      typeof chapter.authorId === 'string' && chapter.authorId
        ? chapter.authorId
        : typeof novel.authorId === 'string'
          ? novel.authorId
          : '';

    const result = await db.runTransaction(async (tx: FirestoreTransaction) => {
      const buyerSnap = await tx.get(buyerRef);
      if (!buyerSnap.exists) {
        return { status: 404, body: { error: 'User not found' } };
      }

      const buyer = buyerSnap.data() as ServerUser;
      const unlockedChapters = Array.isArray(buyer.unlockedChapters)
        ? buyer.unlockedChapters.filter((id): id is string => typeof id === 'string')
        : [];
      const alreadyUnlocked = unlockedChapters.includes(chapterId);
      const activeVip = isActiveVip(buyer.vipUntil);

      if (!isVipChapter || serverPrice === 0 || alreadyUnlocked || activeVip) {
        if (!alreadyUnlocked && isVipChapter) {
          tx.set(
            buyerRef,
            {
              unlockedChapters: FieldValue.arrayUnion(chapterId),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        return {
          status: 200,
          body: {
            success: true,
            alreadyUnlocked,
            deducted: 0,
            authorShare: 0,
            vipCovered: activeVip && isVipChapter,
          },
        };
      }

      const currentCoins = toMoneyNumber(buyer.coins);
      if (currentCoins < serverPrice) {
        return {
          status: 402,
          body: { error: 'Insufficient coins', required: serverPrice },
        };
      }

      const authorShare = Math.floor(serverPrice * AUTHOR_SHARE_RATIO);
      const platformFee = serverPrice - authorShare;
      const userUpdate = {
        coins: FieldValue.increment(-serverPrice),
        unlockedChapters: FieldValue.arrayUnion(chapterId),
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(buyerRef, userUpdate, { merge: true });

      if (authorId && authorId !== buyerId && authorShare > 0) {
        tx.set(
          db.doc(`users/${authorId}`),
          {
            coins: FieldValue.increment(authorShare),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      tx.set(
        transactionRef,
        {
          type: 'UNLOCK_CHAPTER',
          chapterId,
          novelId,
          buyerId,
          authorId,
          price: serverPrice,
          authorShare: authorId === buyerId ? 0 : authorShare,
          platformFee: authorId === buyerId ? serverPrice : platformFee,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );

      return {
        status: 200,
        body: {
          success: true,
          alreadyUnlocked: false,
          deducted: serverPrice,
          authorShare: authorId === buyerId ? 0 : authorShare,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Unlock chapter failed' }, { status: 500 });
  }
}
