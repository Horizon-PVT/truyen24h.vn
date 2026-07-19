import { NextResponse } from 'next/server';
import type { Transaction } from 'firebase-admin/firestore';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

const MIN_WITHDRAW_COINS = 500;
const VND_PER_COIN = 100;

type WithdrawBody = {
  bankName?: unknown;
  accountName?: unknown;
  accountNumber?: unknown;
};

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanAccountNumber(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^0-9A-Za-z]/g, '').slice(0, 40);
}

export async function POST(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (!auth.ok) return auth.response;

  let body: WithdrawBody;
  try {
    body = (await request.json()) as WithdrawBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bankName = cleanText(body.bankName, 80);
  const accountName = cleanText(body.accountName, 120);
  const accountNumber = cleanAccountNumber(body.accountNumber);
  if (!bankName || !accountName || !accountNumber) {
    return NextResponse.json({ error: 'Missing withdrawal account details' }, { status: 400 });
  }

  const uid = auth.user.uid;
  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const requestRef = db.collection('withdraw_requests').doc();

  try {
    const result = await db.runTransaction(async (tx: Transaction) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        return { status: 404 as const, body: { error: 'User not found' } };
      }

      const userData = userSnap.data() || {};
      const currentCoins = Number(userData.coins || 0);
      if (!Number.isFinite(currentCoins) || currentCoins < MIN_WITHDRAW_COINS) {
        return { status: 400 as const, body: { error: 'Insufficient balance' } };
      }

      tx.set(
        userRef,
        {
          coins: 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(requestRef, {
        userId: uid,
        userName: cleanText(userData.displayName, 120) || 'Khuyet danh',
        userEmail: auth.user.email || cleanText(userData.email, 160),
        amountXu: currentCoins,
        amountVND: currentCoins * VND_PER_COIN,
        bankName,
        accountName,
        accountNumber,
        status: 'PENDING',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        status: 200 as const,
        body: {
          ok: true,
          requestId: requestRef.id,
          amountXu: currentCoins,
          amountVND: currentCoins * VND_PER_COIN,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'Withdrawal request failed' }, { status: 500 });
  }
}
