import { NextResponse } from 'next/server';
import type { Transaction } from 'firebase-admin/firestore';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

const MISSION_REWARDS: Record<string, { target: number; rewardCoins: number }> = {
  daily_read: { target: 1, rewardCoins: 5 },
  daily_bookmark: { target: 1, rewardCoins: 5 },
  daily_checkin: { target: 1, rewardCoins: 10 },
};

type MissionClaimBody = {
  missionId?: unknown;
};

function readMissionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const missionId = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(missionId)) return null;
  return missionId;
}

export async function POST(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (!auth.ok) return auth.response;

  let body: MissionClaimBody;
  try {
    body = (await request.json()) as MissionClaimBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const missionId = readMissionId(body.missionId);
  if (!missionId) {
    return NextResponse.json({ error: 'Missing missionId' }, { status: 400 });
  }

  const mission = MISSION_REWARDS[missionId];
  if (!mission) {
    return NextResponse.json({ error: 'Unknown mission' }, { status: 400 });
  }

  const uid = auth.user.uid;
  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const missionRef = db.doc(`users/${uid}/missions/${missionId}`);

  try {
    const result = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(missionRef);
      const data = snap.data();
      const progress = Number(data?.progress || 0);

      if (data?.claimedAt) {
        return { alreadyClaimed: true, rewardCoins: 0 };
      }

      if (progress < mission.target) {
        return { notReady: true, rewardCoins: 0 };
      }

      tx.set(
        userRef,
        {
          coins: FieldValue.increment(mission.rewardCoins),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(
        missionRef,
        {
          claimedAt: FieldValue.serverTimestamp(),
          rewardCoins: mission.rewardCoins,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { alreadyClaimed: false, rewardCoins: mission.rewardCoins };
    });

    if ('notReady' in result) {
      return NextResponse.json({ error: 'Mission is not ready to claim' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Mission claim failed' }, { status: 500 });
  }
}
