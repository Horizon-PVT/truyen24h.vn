/**
 * GET /api/missions/today?uid={uid}
 *
 * Returns today's missions for a user. Mission progress is stored at
 *   users/{uid}/daily_missions/{date}/progress/{missionId}
 *
 * Each row in the returned array merges the catalog definition with
 * the user's progress so the client can render bars + claim states
 * without a second round-trip.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { DAILY_MISSIONS, todayKey } from '@/lib/missions';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    const date = todayKey();
    const db = adminDb();
    const snap = await db.collection(`users/${uid}/daily_missions/${date}/progress`).get();
    const progressMap: Record<string, { count: number; claimed: boolean }> = {};
    snap.forEach((d: any) => {
      const data = d.data();
      progressMap[d.id] = { count: Number(data.count || 0), claimed: !!data.claimed };
    });

    const missions = DAILY_MISSIONS.map((m) => {
      const p = progressMap[m.id] || { count: 0, claimed: false };
      return {
        ...m,
        count: p.count,
        claimed: p.claimed,
        completed: p.count >= m.goal,
        claimable: p.count >= m.goal && !p.claimed && m.reward > 0,
      };
    });

    return NextResponse.json({ ok: true, date, missions });
  } catch (err: any) {
    console.error('[missions/today] error', err);
    return NextResponse.json({ error: err.message || 'Load failed' }, { status: 500 });
  }
}
