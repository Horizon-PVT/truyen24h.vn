/**
 * Diagnostic endpoint for the PayOS pipeline.
 *
 *   GET /api/admin/payos-status?token=<ADMIN_API_TOKEN>
 *
 * Returns:
 *   - env presence (so we can confirm Vercel still has PayOS creds)
 *   - last 10 orders sorted by createdAt (status PENDING vs PAID)
 *   - aggregate revenue counters
 *
 * Use this after a real test payment to confirm webhook fired without
 * having to crawl Vercel logs. No PII is exposed beyond truncated uid.
 */
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!process.env.ADMIN_API_TOKEN || token !== process.env.ADMIN_API_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const env = {
    PAYOS_CLIENT_ID: !!process.env.PAYOS_CLIENT_ID,
    PAYOS_API_KEY: !!process.env.PAYOS_API_KEY,
    PAYOS_CHECKSUM_KEY: !!process.env.PAYOS_CHECKSUM_KEY,
    FIREBASE_SERVICE_ACCOUNT_JSON: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || null,
  };

  const db = adminDb();
  let snap;
  try {
    snap = await db
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      env,
      error: err?.message || String(err),
    });
  }

  const orders = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      orderCode: d.id,
      uid: data.uid ? `${String(data.uid).slice(0, 6)}…` : null,
      amount: data.amount,
      coins: data.coins,
      packId: data.packId || null,
      isMonthly: !!data.isMonthly,
      status: data.status,
      createdAt: data.createdAt?.toMillis?.() || null,
      paidAt: data.paidAt?.toMillis?.() || null,
    };
  });

  // Aggregate revenue from PAID orders only.
  let totalPaidVnd = 0;
  let totalPaidCount = 0;
  let totalPendingCount = 0;
  for (const o of orders) {
    if (o.status === 'PAID') {
      totalPaidVnd += Number(o.amount) || 0;
      totalPaidCount++;
    } else {
      totalPendingCount++;
    }
  }

  return NextResponse.json({
    ok: true,
    env,
    counters: {
      paidInLast10: totalPaidCount,
      pendingInLast10: totalPendingCount,
      paidVndInLast10: totalPaidVnd,
    },
    orders,
  });
}
