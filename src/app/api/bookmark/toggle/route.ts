import { NextResponse } from 'next/server';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

type BookmarkAction = 'follow' | 'readLater' | 'history' | 'progress' | 'remove';

type BookmarkBody = {
  novelId?: unknown;
  action?: unknown;
  lastChapterId?: unknown;
  lastChapterNumber?: unknown;
  progress?: unknown;
};

function readId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) return null;
  return id;
}

function readAction(value: unknown): BookmarkAction {
  if (
    value === 'follow' ||
    value === 'readLater' ||
    value === 'history' ||
    value === 'progress' ||
    value === 'remove'
  ) {
    return value;
  }
  return 'follow';
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export async function POST(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (!auth.ok) return auth.response;

  let body: BookmarkBody;
  try {
    body = (await request.json()) as BookmarkBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const novelId = readId(body.novelId);
  if (!novelId) {
    return NextResponse.json({ error: 'Missing novelId' }, { status: 400 });
  }

  const uid = auth.user.uid;
  const action = readAction(body.action);
  const bookmarkRef = adminDb().doc(`users/${uid}/bookshelf/${novelId}`);

  try {
    if (action === 'remove') {
      await bookmarkRef.delete();
      return NextResponse.json({ ok: true, action });
    }

    const update: Record<string, unknown> = {
      novelId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (action === 'follow') {
      update.isFollowing = true;
    } else if (action === 'readLater') {
      update.isReadLater = true;
    } else if (action === 'history') {
      update.isFollowing = false;
      update.isReadLater = false;
    }

    if (action === 'progress') {
      const progress = boundedNumber(body.progress, 0, 100);
      const lastChapterNumber = boundedNumber(body.lastChapterNumber, 0, 100000);
      if (typeof body.lastChapterId === 'string') {
        update.lastChapterId = body.lastChapterId.slice(0, 120);
      }
      if (lastChapterNumber !== null) {
        update.lastChapterNumber = lastChapterNumber;
      }
      if (progress !== null) {
        update.progress = progress;
      }
    }

    await bookmarkRef.set(update, { merge: true });
    return NextResponse.json({ ok: true, action });
  } catch {
    return NextResponse.json({ error: 'Bookmark update failed' }, { status: 500 });
  }
}
