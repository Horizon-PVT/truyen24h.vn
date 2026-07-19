/**
 * POST /api/missions/claim
 *
 * Claims the coin reward for a completed mission. Idempotent: claiming
 * twice in the same day no-ops on the second call.
 *
 * Body: { uid: string, missionId: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp, FieldValue } from '@/lib/firebaseAdmin';
import { missionById, todayKey } from '@/lib/missions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = body.uid as string | undefined;
    const missionId = body.missionId as string | undefined;
    if (!uid || !missionId) return NextResponse.json({ error: 'Missing uid or missionId' }, { status: 400 });

    const mission = missionById(missionId);
    if (!mission) return NextResponse.json({ error: 'Unknown mission' }, { status: 400 });
    if (mission.reward <= 0) return NextResponse.json({ error: 'Mission has no reward' }, { status: 400 });

    const db = adminDb();
    const date = todayKey();
    const progressRef = db.doc(`users/${uid}/daily_missions/${date}/progress/${missionId}`);
    const userRef = db.doc(`users/${uid}`);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(progressRef);
      if (!snap.exists) return { error: 'Mission not started yet' };
      const data = snap.data() as any;
      if ((data.count || 0) < mission.goal) return { error: 'Not completed yet' };
      if (data.claimed) return { error: 'Đã nhận thưởng rồi', alreadyClaimed: true };

      tx.update(progressRef, { claimed: true, claimedAt: serverTimestamp() });
      tx.update(userRef, {
        coins: FieldValue.increment(mission.reward),
        updatedAt: serverTimestamp(),
      });
      return { ok: true, reward: mission.reward };
    });

    if (result.error) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[missions/claim] error', err);
    return NextResponse.json({ error: err.message || 'Claim failed' }, { status: 500 });
  }
}
