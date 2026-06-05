/**
 * GET /api/admin/newsletter/list
 *
 * Returns the newsletter subscriber list. We can't read the
 * collection from the client SDK because the firestore.rules block
 * non-admin reads (privacy). Admin SDK bypasses rules.
 *
 * Auth: admin email via x-admin-email header.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  try {
    const snap = await adminDb()
      .collection('newsletter_subscribers')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    const subscribers = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
      const data = d.data() as Record<string, { toMillis?: () => number } | string | undefined>;
      const createdAt = data.createdAt;
      return {
        id: d.id,
        email: data.email,
        source: data.source,
        status: data.status,
        createdAt: typeof createdAt === 'object' ? createdAt?.toMillis?.() ?? null : null,
      };
    });
    return NextResponse.json({ ok: true, subscribers, count: subscribers.length });
  } catch (err: unknown) {
    console.error('[admin/newsletter/list] error', err);
    const message = err instanceof Error ? err.message : 'List failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
