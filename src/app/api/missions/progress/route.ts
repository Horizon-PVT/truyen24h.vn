import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

type MissionProgressBody = {
  missionId?: unknown;
  eventType?: unknown;
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

  let body: MissionProgressBody;
  try {
    body = (await request.json()) as MissionProgressBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const missionId = readMissionId(body.missionId);
  if (!missionId) {
    return NextResponse.json({ error: 'Missing missionId' }, { status: 400 });
  }

  const eventType = typeof body.eventType === 'string' ? body.eventType.slice(0, 80) : 'manual';
  const uid = auth.user.uid;
  const missionRef = adminDb().doc(`users/${uid}/missions/${missionId}`);

  try {
    await missionRef.set(
      {
        missionId,
        progress: FieldValue.increment(1),
        lastEventType: eventType,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Mission progress update failed' }, { status: 500 });
  }
}
