/**
 * POST /api/bookmark/toggle
 *
 * Toggle a novel in/out of the user's bookshelf. Uses Admin SDK so
 * the operation always succeeds (Firestore rules block coin writes
 * but bookshelf writes also need the path users/{uid}/bookshelf/*
 * to bypass auth checks reliably).
 *
 * Body: { uid: string, novelId: string, action?: 'follow' | 'read_later' | 'remove' }
 *
 * Returns: { ok, following, readLater }
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = body.uid as string | undefined;
    const novelId = body.novelId as string | undefined;
    const action = (body.action || 'follow') as 'follow' | 'read_later' | 'remove';

    if (!uid || !novelId) {
      return NextResponse.json({ error: 'Missing uid or novelId' }, { status: 400 });
    }

    const db = adminDb();
    const ref = db.doc(`users/${uid}/bookshelf/${novelId}`);

    if (action === 'remove') {
      await ref.delete();
      return NextResponse.json({ ok: true, following: false, readLater: false });
    }

    const snap = await ref.get();
    const current = snap.exists ? (snap.data() as any) : {};

    if (action === 'follow') {
      const following = !current.isFollowing;
      await ref.set({
        novelId,
        isFollowing: following,
        isReadLater: current.isReadLater || false,
        updatedAt: serverTimestamp(),
        ...(snap.exists ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      return NextResponse.json({ ok: true, following, readLater: current.isReadLater || false });
    }

    // read_later
    const readLater = !current.isReadLater;
    await ref.set({
      novelId,
      isFollowing: current.isFollowing || false,
      isReadLater: readLater,
      updatedAt: serverTimestamp(),
      ...(snap.exists ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
    return NextResponse.json({ ok: true, following: current.isFollowing || false, readLater });
  } catch (err: any) {
    console.error('[bookmark/toggle] error', err);
    return NextResponse.json({ error: err.message || 'Toggle failed' }, { status: 500 });
  }
}
