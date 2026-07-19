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

      // Auto-credit the 'bookmark_novel' daily mission when the user
      // FLIPS TO followed (not on un-bookmark, not on duplicate). We
      // dedupe per (uid, novelId, date) so the same novel can't farm
      // multiple points by toggling off/on.
      if (following) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const progressRef = db.doc(`users/${uid}/daily_missions/${today}/progress/bookmark_novel`);
          const dedupKey = `novel:${novelId}`;
          await db.runTransaction(async (tx) => {
            const p = await tx.get(progressRef);
            const data = (p.exists ? p.data() : {}) as any;
            const keys: string[] = data.dedupKeys || [];
            if (keys.includes(dedupKey)) return;
            tx.set(progressRef, {
              missionId: 'bookmark_novel',
              count: (data.count || 0) + 1,
              dedupKeys: [...keys, dedupKey],
              updatedAt: serverTimestamp(),
              ...(p.exists ? {} : { createdAt: serverTimestamp(), claimed: false }),
            }, { merge: true });
          });
        } catch (e) { /* non-fatal */ }
      }

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
