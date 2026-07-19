/**
 * POST /api/withdraw/request
 *
 * Author requests to convert their xu balance into VND via bank
 * transfer. Atomically (a) deducts the requested xu from the user
 * doc and (b) creates a PENDING withdraw_requests doc with their
 * bank info. Admin reviews + marks COMPLETED via /admin (existing).
 *
 * Body: {
 *   uid: string,
 *   amountXu: number,           // requested xu amount
 *   bankName: string,
 *   accountName: string,
 *   accountNumber: string,
 * }
 *
 * Returns: { ok, requestId, newBalance } or { error }
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, serverTimestamp, FieldValue } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

// Conversion rate: 1 xu = 100 VND. Minimum withdrawal 10,000 VND = 100 xu.
const XU_TO_VND = 100;
const MIN_XU = 100;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = body.uid as string | undefined;
    const amountXu = Math.floor(Number(body.amountXu));
    const bankName = (body.bankName || '').toString().trim().slice(0, 80);
    const accountName = (body.accountName || '').toString().trim().slice(0, 80);
    const accountNumber = (body.accountNumber || '').toString().trim().slice(0, 30);

    if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    if (!bankName || !accountName || !accountNumber) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin ngân hàng' }, { status: 400 });
    }
    if (!Number.isFinite(amountXu) || amountXu < MIN_XU) {
      return NextResponse.json({ error: `Số xu rút tối thiểu là ${MIN_XU}` }, { status: 400 });
    }

    const db = adminDb();
    const userRef = db.collection('users').doc(uid);
    const reqRef = db.collection('withdraw_requests').doc();

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error('User not found');
      const data = snap.data() as any;
      const currentCoins = Number(data.coins || 0);
      if (currentCoins < amountXu) {
        throw new Error(`Số dư không đủ. Hiện có ${currentCoins} xu.`);
      }

      tx.update(userRef, {
        coins: FieldValue.increment(-amountXu),
        updatedAt: serverTimestamp(),
      });

      tx.set(reqRef, {
        userId: uid,
        userName: data.displayName || 'Khuyết danh',
        userEmail: data.email || '',
        amountXu,
        amountVND: amountXu * XU_TO_VND,
        bankName,
        accountName,
        accountNumber,
        status: 'PENDING',
        createdAt: serverTimestamp(),
      });

      return { requestId: reqRef.id, newBalance: currentCoins - amountXu };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[withdraw/request] error', err);
    return NextResponse.json({ error: err.message || 'Withdraw failed' }, { status: 500 });
  }
}
