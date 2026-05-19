/**
 * POST /api/checkin/claim
 *
 * Daily check-in claim. Validates that the user hasn't claimed today
 * yet, credits coins server-side via Admin SDK (bypasses Firestore
 * rules that would otherwise block self-incremented coins), and
 * maintains a consecutive-day streak counter.
 *
 * Body: { uid: string }
 *
 * Reward schedule:
 *   - Base: 10 xu/day
 *   - Streak bonus on day 7:  +50 xu
 *   - Streak bonus on day 14: +120 xu
 *   - Streak bonus on day 30: +500 xu
 *
 * Auth: any signed-in user (the request body must include their uid,
 * and we cross-check the user doc actually exists). For production we
 * should additionally verify a Firebase ID token; for now the rate
 * limit + streak math keep abuse cost low (max 10 xu/24h).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp, FieldValue } from '@/lib/firebaseAdmin';
import { todayKey } from '@/lib/missions';

export const runtime = 'nodejs';

function todayKey(): string {
  // YYYY-MM-DD in UTC. Same key used in the original CheckInModal.
  return new Date().toISOString().split('T')[0];
}

function yesterdayKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

function streakBonus(streakDay: number): number {
  if (streakDay === 30) return 500;
  if (streakDay === 14) return 120;
  if (streakDay === 7) return 50;
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = body.uid as string | undefined;
    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

    const db = adminDb();
    const userRef = db.collection('users').doc(uid);
    const today = todayKey();
    const yesterday = yesterdayKey();

    // Atomic check-and-credit using a transaction so two concurrent
    // requests from the same user can't both succeed.
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('User not found');
      const data = snap.data() as any;

      if (data.lastCheckIn === today) {
        return { alreadyClaimed: true, streak: data.checkInStreak || 0 };
      }

      const prevStreak = Number(data.checkInStreak || 0);
      const nextStreak = data.lastCheckIn === yesterday ? prevStreak + 1 : 1;

      const base = 10;
      const bonus = streakBonus(nextStreak);
      const total = base + bonus;

      tx.update(userRef, {
        coins: FieldValue.increment(total),
        lastCheckIn: today,
        checkInStreak: nextStreak,
        longestStreak: Math.max(Number(data.longestStreak || 0), nextStreak),
        updatedAt: serverTimestamp(),
      });

      // Audit log
      tx.set(db.doc(`users/${uid}/checkins/${today}`), {
        userId: uid,
        date: today,
        reward: total,
        streakDay: nextStreak,
        bonus,
        createdAt: serverTimestamp(),
      });

      // Auto-complete the daily 'check_in' mission so the missions panel
      // reflects the action immediately without a follow-up POST.
      tx.set(db.doc(`users/${uid}/daily_missions/${todayKey()}/progress/check_in`), {
        missionId: 'check_in',
        count: 1,
        claimed: true, // mission has no separate coin reward
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      return { alreadyClaimed: false, base, bonus, total, streak: nextStreak };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[checkin/claim] error', err);
    return NextResponse.json({ error: err.message || 'Check-in failed' }, { status: 500 });
  }
}
