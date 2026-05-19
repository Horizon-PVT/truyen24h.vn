/**
 * POST /api/newsletter/subscribe
 *
 * Persists an email subscriber. Idempotent: subscribing the same email
 * twice updates the existing doc instead of throwing.
 *
 * Body: { email: string, source?: string }
 * Returns: { ok, alreadySubscribed }
 *
 * No auth required — this is a public form. Light validation only:
 *   - Format must look like an email
 *   - Length 6..254 (RFC 5321)
 *   - Reject obvious bot patterns
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function sanitiseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  if (!EMAIL_RE.test(e)) return null;
  // Trivial bot filter: very long local parts, obvious throwaways
  if (e.split('@')[0].length > 64) return null;
  return e;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = sanitiseEmail(body.email);
    if (!email) return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });

    const source = typeof body.source === 'string' ? body.source.slice(0, 80) : 'footer';
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
    const userAgent = req.headers.get('user-agent')?.slice(0, 200) || null;

    const db = adminDb();
    // Use email (with dots escaped) as doc id so dup subscribes are idempotent.
    const id = email.replace(/[.]/g, '_');
    const ref = db.collection('newsletter_subscribers').doc(id);
    const snap = await ref.get();
    const alreadySubscribed = snap.exists;

    await ref.set({
      email,
      source,
      ip,
      userAgent,
      status: 'pending', // becomes 'confirmed' if/when we wire Resend double opt-in
      updatedAt: serverTimestamp(),
      ...(alreadySubscribed ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });

    return NextResponse.json({ ok: true, alreadySubscribed });
  } catch (err: any) {
    console.error('[newsletter/subscribe] error', err);
    return NextResponse.json({ error: err.message || 'Subscribe failed' }, { status: 500 });
  }
}
