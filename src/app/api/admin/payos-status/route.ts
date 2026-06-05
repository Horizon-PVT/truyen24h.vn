/**
 * Diagnostic endpoint for the PayOS pipeline.
 *
 *   GET /api/admin/payos-status?token=<ADMIN_API_TOKEN>
 *
 * Returns env presence, last 10 orders, and aggregate revenue counters.
 * No secret values are exposed.
 */
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FirestoreTimestampLike = {
  toMillis?: () => number;
};

type OrderData = Record<string, FirestoreTimestampLike | string | number | boolean | undefined>;

function toMillisOrNull(value: OrderData[string]): number | null {
  return typeof value === 'object' ? value?.toMillis?.() || null : null;
}

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
  let snap: QuerySnapshot<DocumentData>;
  try {
    snap = await db
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
  } catch (err: unknown) {
    return NextResponse.json({
      ok: false,
      env,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const orders = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
    const data = d.data() as OrderData;
    return {
      orderCode: d.id,
      uid: data.uid ? `${String(data.uid).slice(0, 6)}...` : null,
      amount: data.amount,
      coins: data.coins,
      packId: data.packId || null,
      isMonthly: !!data.isMonthly,
      status: data.status,
      createdAt: toMillisOrNull(data.createdAt),
      paidAt: toMillisOrNull(data.paidAt),
    };
  });

  let totalPaidVnd = 0;
  let totalPaidCount = 0;
  let totalPendingCount = 0;
  for (const order of orders) {
    if (order.status === 'PAID') {
      totalPaidVnd += Number(order.amount) || 0;
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
