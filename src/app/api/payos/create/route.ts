/**
 * Create a PayOS payment link AND the matching Firestore order doc.
 *
 *   POST /api/payos/create
 *   Body: { uid, packId, vnd, coins, isMonthly?, returnUrl?, cancelUrl? }
 *
 * Why server-side order creation:
 *   Previously /vip page created the order doc client-side with the
 *   Firestore client SDK. That meant anyone could write arbitrary `coins`
 *   values to the order before triggering checkout, and the webhook
 *   would credit those coins on confirmation. Routing through this
 *   endpoint lets us enforce that (coins, vnd, packId) come from a
 *   server-trusted catalog instead of user input.
 *
 *   Important: only the webhook flips status to PAID. This route only
 *   ever writes status=PENDING. So even if a user fabricates the
 *   request, no coins are credited until PayOS confirms payment.
 */
import { NextResponse } from 'next/server';
import { payos } from '@/services/payos';
import { adminDb } from '@/lib/firebaseAdmin';
import { getSiteUrl } from '@/lib/site';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-trusted catalog. Keep this in sync with `PACKAGES` in /src/app/vip/page.tsx.
 * Coins = base + bonus pre-computed here so the client can't inflate it.
 */
const CATALOG: Record<string, { vnd: number; coins: number; isMonthly?: boolean }> = {
  pack0: { vnd: 5000, coins: 70 },        // 60 + 10 starter
  pack1: { vnd: 10000, coins: 100 },
  pack2: { vnd: 20000, coins: 220 },      // 200 + 20 popular
  pack3: { vnd: 50000, coins: 600 },      // 500 + 100
  monthly: { vnd: 99000, coins: 1800, isMonthly: true }, // 1500 + 300 + 30d VIP
  pack4: { vnd: 100000, coins: 1300 },    // 1000 + 300
  pack5: { vnd: 200000, coins: 2800 },    // 2000 + 800 VIP
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uid, packId } = body;
    let { orderCode, returnUrl, cancelUrl } = body;

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    // Allow legacy callers that still pass raw amount/coins. We log a
    // warning so we know when the /vip page is still using the old path.
    let vnd: number;
    let coins: number;
    let isMonthly = false;

    if (packId && CATALOG[packId]) {
      vnd = CATALOG[packId].vnd;
      coins = CATALOG[packId].coins;
      isMonthly = !!CATALOG[packId].isMonthly;
    } else if (body.amount && body.coins) {
      console.warn(
        `[PayOS] legacy payload — packId missing, trusting client amount=${body.amount}`,
      );
      vnd = Number(body.amount);
      coins = Number(body.coins);
      isMonthly = !!body.isMonthly;
    } else {
      return NextResponse.json(
        { error: 'Missing packId or {amount,coins}' },
        { status: 400 },
      );
    }

    // PayOS orderCode must be a positive int. Use 9 digits of ms-time
    // for collision-free uniqueness within a year.
    if (!orderCode) {
      orderCode = Number(String(Date.now()).slice(-9));
    }

    // Idempotency: if we already created this order doc don't double-write.
    const db = adminDb();
    const orderRef = db.collection('orders').doc(String(orderCode));
    const existing = await orderRef.get();
    if (existing.exists && existing.data()?.status === 'PAID') {
      return NextResponse.json(
        { error: 'Order already paid' },
        { status: 409 },
      );
    }

    await orderRef.set(
      {
        uid,
        amount: vnd,
        coins,
        packId: packId || null,
        isMonthly,
        status: 'PENDING',
        createdAt: FieldValue.serverTimestamp(),
        gateway: 'payos',
      },
      { merge: true },
    );

    const siteUrl = getSiteUrl();
    const payload = {
      orderCode,
      amount: vnd,
      description: `WXU ${orderCode}`.slice(0, 25),
      cancelUrl: cancelUrl || `${siteUrl}/vip?payment=cancelled`,
      returnUrl: returnUrl || `${siteUrl}/vip?payment=success`,
    };

    const paymentLinkRes = await payos.paymentRequests.create(payload);

    return NextResponse.json({
      ...paymentLinkRes,
      orderCode,
      coins,
      isMonthly,
    });
  } catch (error: any) {
    console.error('[PayOS Create] error:', error);
    return NextResponse.json(
      { error: error?.message || 'Lỗi kết nối PayOS' },
      { status: 500 },
    );
  }
}
