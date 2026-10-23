import { NextRequest, NextResponse } from 'next/server';
import { authorizeBot } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { getActiveProvider } from '@/services/aiProvider';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await authorizeBot(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    let totalNovels = 0;
    let totalChapters = 0;

    try {
      const db = adminDb();
      const novelsSnap = await db.collection('novels').count().get();
      totalNovels = novelsSnap.data().count;

      const chaptersSnap = await db.collectionGroup('chapters').count().get();
      totalChapters = chaptersSnap.data().count;
    } catch {
      // Fallback to client SDK if service account is not yet loaded on VPS
      const { db } = await import('@/firebase');
      const { collection, getCountFromServer } = await import('firebase/firestore');
      const novelsSnap = await getCountFromServer(collection(db, 'novels'));
      totalNovels = novelsSnap.data().count;
      totalChapters = 0;
    }

    return NextResponse.json({
      ok: true,
      site: {
        name: 'Truyen24h.vn',
        url: getSiteUrl(),
        status: 'online',
        timestamp: new Date().toISOString(),
      },
      stats: {
        totalNovels,
        totalChapters,
      },
      ai: {
        activeProvider: getActiveProvider(),
        model: process.env.BYTEPLUS_MODEL || 'deepseek-v4-1-flash-261017',
      },
    });
  } catch (error: any) {
    console.error('Bot API stats GET error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
