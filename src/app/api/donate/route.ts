import { NextRequest, NextResponse } from 'next/server';
import type { Transaction } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';

type DonateBody = {
  authorId?: unknown;
  amount?: unknown;
};

const MAX_DONATION_COINS = 100000;

function isSafeDocId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !value.includes('/');
}

function parseDonationAmount(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_DONATION_COINS) {
    return null;
  }
  return amount;
}

export async function POST(request: NextRequest) {
  const auth = await requireFirebaseUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as DonateBody;
    const donorId = auth.user.uid;
    const authorId = isSafeDocId(body.authorId) ? body.authorId.trim() : null;
    const donateAmount = parseDonationAmount(body.amount);

    if (!authorId || donateAmount === null) {
      return NextResponse.json({ error: 'Invalid donation request' }, { status: 400 });
    }

    if (donorId === authorId) {
      return NextResponse.json({ error: 'Cannot donate to yourself' }, { status: 400 });
    }

    const db = adminDb();
    const donorRef = db.doc(`users/${donorId}`);
    const authorRef = db.doc(`users/${authorId}`);
    const txRef = db.collection('transactions').doc();

    await db.runTransaction(async (transaction: Transaction) => {
      const [donorSnap, authorSnap] = await transaction.getAll(donorRef, authorRef);

      if (!donorSnap.exists) {
        throw new Error('DONOR_NOT_FOUND');
      }

      if (!authorSnap.exists) {
        throw new Error('AUTHOR_NOT_FOUND');
      }

      const donorCoins = Number(donorSnap.get('coins') ?? 0);
      if (!Number.isFinite(donorCoins) || donorCoins < donateAmount) {
        throw new Error('INSUFFICIENT_COINS');
      }

      transaction.update(donorRef, {
        coins: FieldValue.increment(-donateAmount),
        contributionScore: FieldValue.increment(donateAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(authorRef, {
        coins: FieldValue.increment(donateAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(txRef, {
        type: 'DONATE',
        donorId,
        authorId,
        buyerId: donorId,
        amount: donateAmount,
        status: 'COMPLETED',
        provider: 'internal',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      amount: donateAmount,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'DONOR_NOT_FOUND') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (error.message === 'AUTHOR_NOT_FOUND') {
        return NextResponse.json({ error: 'Author not found' }, { status: 404 });
      }
      if (error.message === 'INSUFFICIENT_COINS') {
        return NextResponse.json({ error: 'Insufficient coins' }, { status: 402 });
      }
    }

    console.error('Donate route failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
