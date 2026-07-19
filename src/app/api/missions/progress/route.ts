/**
 * POST /api/missions/progress
 *
 * Increments a user's progress for a given mission today. Idempotent
 * per (mission, dedupKey) — passing a dedupKey (e.g. 'chapter:abc123')
 * prevents the same event from incrementing twice.
 *
 * Body: { uid: string, missionId: string, dedupKey?: string, delta?: number }
 *
 * Auth: trust the uid; this endpoint is rate-limited by the dedupKey
 * pattern and the small reward per mission. Don't use it for anything
 * that grants more than a few xu per claim.
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
    const dedupKey = (body.dedupKey as string | undefined) || null;
    const delta = Math.max(1, Math.min(Number(body.delta) || 1, 10));

    if (!uid || !missionId) return NextResponse.json({ error: 'Missing uid or missionId' }, { status: 400 });
    const mission = missionById(missionId);
    if (!mission) return NextResponse.json({ error: 'Unknown mission' }, { status: 400 });

    const db = adminDb();
    const date = todayKey();
    const progressRef = db.doc(`users/${uid}/daily_missions/${date}/progress/${missionId}`);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(progressRef);
      const data = (snap.exists ? snap.data() : {}) as any;

      // Dedup check: if this dedupKey has been counted already, no-op.
      if (dedupKey && Array.isArray(data.dedupKeys) && data.dedupKeys.includes(dedupKey)) {
        return { count: data.count || 0, alreadyCounted: true };
      }

      const newCount = Math.min((data.count || 0) + delta, mission.goal);

      tx.set(progressRef, {
        missionId,
        count: newCount,
        ...(dedupKey ? { dedupKeys: FieldValue.arrayUnion(dedupKey) } : {}),
        updatedAt: serverTimestamp(),
        ...(snap.exists ? {} : { createdAt: serverTimestamp(), claimed: false }),
      }, { merge: true });
      return { count: newCount, alreadyCounted: false };
    });

    return NextResponse.json({ ok: true, ...result, goal: mission.goal });
  } catch (err: any) {
    console.error('[missions/progress] error', err);
    return NextResponse.json({ error: err.message || 'Progress update failed' }, { status: 500 });
  }
}
