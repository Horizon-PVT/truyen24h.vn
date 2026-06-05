import { NextResponse } from 'next/server';
import type { Transaction } from 'firebase-admin/firestore';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

const CHECKIN_REWARD_COINS = 10;
const CHECKIN_REWARD_POINTS = 50;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (!auth.ok) return auth.response;

  const uid = auth.user.uid;
  const today = dateKey(new Date());
  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const checkinRef = db.doc(`users/${uid}/checkins/${today}`);
  const statsRef = db.doc(`users/${uid}/profile/stats`);

  try {
    const result = await db.runTransaction(async (tx: Transaction) => {
      const [checkinSnap, statsSnap] = await Promise.all([tx.get(checkinRef), tx.get(statsRef)]);
      const currentStreak = Number(statsSnap.data()?.streak || 0);

      if (checkinSnap.exists) {
        return {
          alreadyClaimed: true,
          rewardCoins: 0,
          rewardPoints: 0,
          streak: currentStreak,
        };
      }

      const nextStreak = currentStreak + 1;
      tx.set(
        userRef,
        {
          coins: FieldValue.increment(CHECKIN_REWARD_COINS),
          lastCheckIn: today,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(checkinRef, {
        userId: uid,
        date: today,
        reward: CHECKIN_REWARD_COINS,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        statsRef,
        {
          lastCheckIn: FieldValue.serverTimestamp(),
          streak: nextStreak,
          points: FieldValue.increment(CHECKIN_REWARD_POINTS),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        alreadyClaimed: false,
        rewardCoins: CHECKIN_REWARD_COINS,
        rewardPoints: CHECKIN_REWARD_POINTS,
        streak: nextStreak,
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Check-in failed' }, { status: 500 });
  }
}
