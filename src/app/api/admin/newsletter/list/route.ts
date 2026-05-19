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

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  try {
    const snap = await adminDb()
      .collection('newsletter_subscribers')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    const subscribers = snap.docs.map((d: any) => {
      const data = d.data() as any;
      return {
        id: d.id,
        email: data.email,
        source: data.source,
        status: data.status,
        createdAt: data.createdAt?.toMillis?.() ?? null,
      };
    });
    return NextResponse.json({ ok: true, subscribers, count: subscribers.length });
  } catch (err: any) {
    console.error('[admin/newsletter/list] error', err);
    return NextResponse.json({ error: err.message || 'List failed' }, { status: 500 });
  }
}
