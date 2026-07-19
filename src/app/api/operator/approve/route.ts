import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';
import { Transaction } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEEDS_REVIEW: ['APPROVED', 'REJECTED', 'NEEDS_FIX'],
  NEEDS_FIX: ['APPROVED', 'REJECTED'],
};

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { draftId, action, note } = body;

  if (typeof draftId !== 'string' || !draftId) {
    return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
  }

  if (action !== 'approve' && action !== 'reject' && action !== 'needs_fix') {
    return NextResponse.json({ error: 'Invalid action. Must be approve, reject, or needs_fix' }, { status: 400 });
  }

  let newStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_FIX';
  if (action === 'approve') {
    newStatus = 'APPROVED';
  } else if (action === 'reject') {
    newStatus = 'REJECTED';
  } else if (action === 'needs_fix') {
    newStatus = 'NEEDS_FIX';
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const db = adminDb();
    const draftRef = db.collection('operator_drafts').doc(draftId);
    const reviewLogRef = db.collection('operator_reviews').doc();
    const adminEmail = auth.email || auth.uid || 'admin';
    const now = FieldValue.serverTimestamp();

    const result = await db.runTransaction(async (transaction: Transaction) => {
      const draftDoc = await transaction.get(draftRef);
      if (!draftDoc.exists) {
        return { error: 'Draft not found', status: 404 };
      }

      const currentStatus = draftDoc.get('status') || 'NEEDS_REVIEW';

      // 1. Kiểm tra idempotent trước tiên
      if (currentStatus === newStatus) {
        return { ok: true, status: currentStatus, idempotent: true };
      }

      // 2. Chặn trạng thái PUBLISHED
      if (currentStatus === 'PUBLISHED') {
        return { error: 'INVALID_STATUS_TRANSITION', status: 409 };
      }

      // 3. Kiểm tra transition được phép
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(newStatus)) {
        return { error: 'INVALID_STATUS_TRANSITION', status: 409 };
      }

      const reviewLog = {
        draftId,
        action,
        note: typeof note === 'string' ? note : '',
        statusAfter: newStatus,
        reviewedBy: adminEmail,
        createdAt: now,
      };

      transaction.set(reviewLogRef, reviewLog);
      transaction.update(draftRef, {
        status: newStatus,
        updatedAt: now,
      });

      return { ok: true, status: newStatus, reviewLogId: reviewLogRef.id };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Approve transaction failed:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
