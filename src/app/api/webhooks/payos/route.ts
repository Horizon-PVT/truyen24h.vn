import { NextResponse } from 'next/server';
import type { Transaction as FirestoreTransaction } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { payos } from '@/services/payos';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

type PayOSWebhookData = {
  orderCode: number;
  amount: number;
  description?: string;
  reference?: string;
  paymentLinkId?: string;
  transactionDateTime?: string;
};

type PayOSWebhookPayload = Parameters<typeof payos.webhooks.verify>[0];

type PayOSOrder = {
  uid?: unknown;
  packId?: unknown;
  amount?: unknown;
  coins?: unknown;
  isMonthly?: unknown;
  vipDays?: unknown;
  status?: unknown;
};

function asPositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let webhookData: PayOSWebhookData;
  try {
    webhookData = (await payos.webhooks.verify(body as PayOSWebhookPayload)) as PayOSWebhookData;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const orderCode = asPositiveNumber(webhookData.orderCode);
  const paidAmount = asPositiveNumber(webhookData.amount);
  if (!orderCode || !paidAmount) {
    return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
  }

  const db = adminDb();
  const orderRef = db.doc(`orders/${orderCode}`);

  try {
    const result = await db.runTransaction(async (tx: FirestoreTransaction) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        return { message: 'Order not found but acknowledged' };
      }

      const order = orderSnap.data() as PayOSOrder;
      if (order.status === 'PAID') {
        return { message: 'Order already paid' };
      }

      const uid = typeof order.uid === 'string' ? order.uid : '';
      const expectedAmount = asPositiveNumber(order.amount);
      const coins = asPositiveNumber(order.coins);
      if (!uid || !expectedAmount || !coins) {
        tx.set(
          orderRef,
          {
            status: 'PAYMENT_REJECTED',
            rejectionReason: 'invalid_server_order',
            actualAmount: paidAmount,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return { message: 'Invalid server order data' };
      }

      if (paidAmount !== expectedAmount) {
        tx.set(
          orderRef,
          {
            status: 'PAYMENT_MISMATCH',
            actualAmount: paidAmount,
            expectedAmount,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return { message: 'Payment amount mismatch recorded' };
      }

      if (order.status !== 'PENDING') {
        return { message: 'Order is not pending' };
      }

      const userRef = db.doc(`users/${uid}`);
      const transactionRef = db.doc(`transactions/payos_${orderCode}`);
      const userUpdate: Record<string, unknown> = {
        coins: FieldValue.increment(coins),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (order.isMonthly === true) {
        const vipDays = asPositiveNumber(order.vipDays) || 30;
        userUpdate.vipPlan = 'monthly';
        userUpdate.vipUntil = Timestamp.fromDate(addDays(new Date(), vipDays));
      }

      tx.set(userRef, userUpdate, { merge: true });
      tx.set(
        orderRef,
        {
          status: 'PAID',
          paidAt: FieldValue.serverTimestamp(),
          actualAmount: paidAmount,
          paymentReference: webhookData.reference || '',
          paymentLinkId: webhookData.paymentLinkId || '',
          paymentDescription: webhookData.description || '',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(
        transactionRef,
        {
          type: order.isMonthly === true ? 'PAYOS_MONTHLY_VIP' : 'PAYOS_TOPUP',
          provider: 'payos',
          orderCode,
          uid,
          packId: typeof order.packId === 'string' ? order.packId : '',
          amount: expectedAmount,
          coins,
          isMonthly: order.isMonthly === true,
          status: 'PAID',
          reference: webhookData.reference || '',
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );

      return { message: 'Payment credited' };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'PayOS webhook processing failed' }, { status: 500 });
  }
}
