/**
 * PayOS webhook — credits coins (and optionally a 30-day VIP window)
 * to a user after a confirmed payment.
 *
 *   POST /api/webhooks/payos
 *
 * Migrated from Firebase client SDK → Admin SDK on 2026-05-29. The client
 * SDK uses long-lived gRPC streams which fail intermittently on Vercel
 * serverless ("Failed to get document because the client is offline"),
 * meaning paid users would sometimes never receive their coins. Admin
 * SDK uses plain HTTPS and is reliable.
 *
 * The webhook is idempotent: if it ever fires twice for the same order
 * we short-circuit at the `status === "PAID"` check.
 */
import { NextResponse } from 'next/server';
import { payos } from '@/services/payos';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1) Drop PayOS's own webhook ping (orderCode 123 is their test value).
    if (body?.data?.orderCode === 123) {
      return NextResponse.json({ message: 'Test Webhook: OK' });
    }

    // 2) Verify HMAC signature so a bad actor can't credit themselves.
    let webhookData;
    try {
      webhookData = await payos.webhooks.verify(body);
    } catch (e) {
      console.error('[PayOS] Invalid webhook signature:', e);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const orderCode = webhookData.orderCode;
    const amount = webhookData.amount;
    const description = webhookData.description;

    console.log(`[PayOS] Payment ${amount}đ for order ${orderCode}`);

    const db = adminDb();
    const orderRef = db.collection('orders').doc(String(orderCode));
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      // 200 here, not 404 — PayOS retries non-2xx and we don't want loops
      // if the order document was wiped or wasn't created by our app.
      console.warn(`[PayOS] order ${orderCode} not found in Firestore`);
      return NextResponse.json(
        { message: 'Order not found but acknowledged' },
        { status: 200 },
      );
    }

    const orderData = orderSnap.data() as {
      uid: string;
      coins: number;
      amount: number;
      packId?: string;
      isMonthly?: boolean;
      status: string;
    };

    if (orderData.status === 'PAID') {
      return NextResponse.json({ message: 'Order already paid' });
    }

    if (!orderData.uid || !orderData.coins) {
      console.error(`[PayOS] Order ${orderCode} missing uid/coins`, orderData);
      return NextResponse.json({ message: 'Order malformed' }, { status: 200 });
    }

    // 3) Credit the user. Use a transaction so we never race against
    //    another path that mutates the same user doc.
    await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(orderData.uid);
      const userSnap = await tx.get(userRef);

      // Compute the new VIP window for monthly packs. We extend off the
      // existing expiry if it's still in the future, otherwise start fresh
      // from "now". 30 days = 2_592_000_000 ms.
      const updates: any = {
        coins: FieldValue.increment(orderData.coins),
        lastTopUpAt: FieldValue.serverTimestamp(),
        totalSpentVnd: FieldValue.increment(orderData.amount || amount || 0),
      };

      if (orderData.isMonthly || orderData.packId === 'monthly') {
        const nowMs = Date.now();
        const existing = userSnap.exists
          ? userSnap.data()?.vipUntil
          : undefined;
        const baseMs =
          existing instanceof Timestamp ? existing.toMillis() : nowMs;
        const fromMs = baseMs > nowMs ? baseMs : nowMs;
        const newMs = fromMs + 30 * 24 * 60 * 60 * 1000;
        updates.vipUntil = Timestamp.fromMillis(newMs);
        updates.vipPlan = 'monthly';
      }

      if (userSnap.exists) {
        tx.update(userRef, updates);
      } else {
        // Edge case: user document was deleted but they paid anyway.
        tx.set(userRef, { ...updates, uid: orderData.uid }, { merge: true });
      }

      tx.update(orderRef, {
        status: 'PAID',
        paidAt: FieldValue.serverTimestamp(),
        actualAmount: amount,
        webhookDescription: description || null,
      });
    });

    console.log(
      `[PayOS] +${orderData.coins} xu → user ${orderData.uid}` +
        (orderData.isMonthly ? ' (+30d VIP)' : ''),
    );

    return NextResponse.json({ message: 'Giao dịch thành công' });
  } catch (error: any) {
    console.error('[PayOS Webhook] System error:', error);
    // Return 500 so PayOS retries — we want to recover transient failures.
    return NextResponse.json(
      { error: error?.message || 'Internal error' },
      { status: 500 },
    );
  }
}
