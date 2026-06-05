import { NextRequest, NextResponse } from 'next/server';
import type { Transaction } from 'firebase-admin/firestore';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

type ReviewWithdrawBody = {
  requestId?: unknown;
  status?: unknown;
  note?: unknown;
};

const REVIEWABLE_STATUSES = new Set(['COMPLETED', 'REJECTED']);

function isSafeDocId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !value.includes('/');
}

function parseStatus(value: unknown): 'COMPLETED' | 'REJECTED' | null {
  if (typeof value !== 'string' || !REVIEWABLE_STATUSES.has(value)) {
    return null;
  }
  return value as 'COMPLETED' | 'REJECTED';
}

export async function POST(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const body = (await request.json()) as ReviewWithdrawBody;
    const requestId = isSafeDocId(body.requestId) ? body.requestId.trim() : null;
    const nextStatus = parseStatus(body.status);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

    if (!requestId || !nextStatus) {
      return NextResponse.json({ error: 'Invalid withdrawal review request' }, { status: 400 });
    }

    const db = adminDb();
    const requestRef = db.doc(`withdraw_requests/${requestId}`);
    const auditRef = db.collection('admin_audit_logs').doc();

    await db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) {
        throw new Error('WITHDRAW_REQUEST_NOT_FOUND');
      }

      const currentStatus = snapshot.get('status');
      if (currentStatus !== 'PENDING') {
        throw new Error('WITHDRAW_REQUEST_ALREADY_REVIEWED');
      }

      const reviewedBy = auth.email || auth.uid || 'machine-token';
      const reviewPayload = {
        status: nextStatus,
        reviewedBy,
        reviewedByUid: auth.uid || null,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(note ? { reviewNote: note } : {}),
      };

      transaction.update(requestRef, reviewPayload);
      transaction.set(auditRef, {
        action: 'WITHDRAW_REQUEST_REVIEW',
        requestId,
        status: nextStatus,
        reviewedBy,
        reviewedByUid: auth.uid || null,
        createdAt: FieldValue.serverTimestamp(),
        ...(note ? { note } : {}),
      });
    });

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'WITHDRAW_REQUEST_NOT_FOUND') {
        return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
      }
      if (error.message === 'WITHDRAW_REQUEST_ALREADY_REVIEWED') {
        return NextResponse.json({ error: 'Withdrawal request already reviewed' }, { status: 409 });
      }
    }

    console.error('Withdraw review route failed');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
