import { NextResponse } from 'next/server';
import { payos } from '@/services/payos';
import { getSiteUrl } from '@/lib/site';
import { requireFirebaseUser } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

type PaymentPack = {
  id: string;
  amount: number;
  coins: number;
  isMonthly: boolean;
  title: string;
  description: string;
  vipDays?: number;
};

const PAYMENT_PACKS: Record<string, PaymentPack> = {
  pack0: {
    id: 'pack0',
    amount: 5000,
    coins: 70,
    isMonthly: false,
    title: 'Goi khoi dau',
    description: 'Nap 70 Xu',
  },
  pack1: {
    id: 'pack1',
    amount: 10000,
    coins: 100,
    isMonthly: false,
    title: 'Goi 100 Xu',
    description: 'Nap 100 Xu',
  },
  pack2: {
    id: 'pack2',
    amount: 20000,
    coins: 220,
    isMonthly: false,
    title: 'Goi pho bien',
    description: 'Nap 220 Xu',
  },
  pack3: {
    id: 'pack3',
    amount: 50000,
    coins: 600,
    isMonthly: false,
    title: 'Goi 600 Xu',
    description: 'Nap 600 Xu',
  },
  monthly: {
    id: 'monthly',
    amount: 99000,
    coins: 1800,
    isMonthly: true,
    vipDays: 30,
    title: 'Combo thang',
    description: 'VIP thang va 1800 Xu',
  },
  pack4: {
    id: 'pack4',
    amount: 100000,
    coins: 1300,
    isMonthly: false,
    title: 'Goi 1300 Xu',
    description: 'Nap 1300 Xu',
  },
  pack5: {
    id: 'pack5',
    amount: 200000,
    coins: 2800,
    isMonthly: false,
    title: 'Goi toi da',
    description: 'Nap 2800 Xu',
  },
};

type CreatePayOSBody = {
  packId?: unknown;
};

function readPackId(body: CreatePayOSBody): string | null {
  if (typeof body.packId !== 'string') return null;
  const packId = body.packId.trim();
  return PAYMENT_PACKS[packId] ? packId : null;
}

function createOrderCode(): number {
  const randomPart = Math.floor(Math.random() * 1000);
  return Date.now() * 1000 + randomPart;
}

export async function POST(request: Request) {
  const auth = await requireFirebaseUser(request);
  if (!auth.ok) return auth.response;

  let body: CreatePayOSBody;
  try {
    body = (await request.json()) as CreatePayOSBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const packId = readPackId(body);
  if (!packId) {
    return NextResponse.json({ error: 'Invalid packId' }, { status: 400 });
  }

  const pack = PAYMENT_PACKS[packId];
  const orderCode = createOrderCode();
  const siteUrl = getSiteUrl();
  const returnUrl = `${siteUrl}/vip?payment=success&orderCode=${orderCode}`;
  const cancelUrl = `${siteUrl}/vip?payment=cancelled&orderCode=${orderCode}`;
  const orderRef = adminDb().doc(`orders/${orderCode}`);

  try {
    await orderRef.set({
      uid: auth.user.uid,
      email: auth.user.email || '',
      packId: pack.id,
      amount: pack.amount,
      coins: pack.coins,
      isMonthly: pack.isMonthly,
      vipDays: pack.vipDays || 0,
      title: pack.title,
      description: pack.description,
      orderCode,
      status: 'PENDING',
      provider: 'payos',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const paymentLink = await payos.paymentRequests.create({
      orderCode,
      amount: pack.amount,
      description: `T24H ${orderCode}`,
      cancelUrl,
      returnUrl,
      items: [
        {
          name: pack.title,
          quantity: 1,
          price: pack.amount,
        },
      ],
      buyerEmail: auth.user.email,
    });

    await orderRef.set(
      {
        paymentLinkId: paymentLink.paymentLinkId,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        payosStatus: paymentLink.status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      orderCode,
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      amount: pack.amount,
      coins: pack.coins,
      isMonthly: pack.isMonthly,
    });
  } catch {
    await orderRef.set(
      {
        status: 'CREATE_FAILED',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return NextResponse.json({ error: 'PayOS payment link creation failed' }, { status: 500 });
  }
}
