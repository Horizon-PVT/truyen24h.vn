import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

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

  const db = adminDb();
  const draftRef = db.collection('operator_drafts').doc(draftId);
  const draftDoc = await draftRef.get();

  if (!draftDoc.exists) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
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

  const adminEmail = auth.email || auth.uid || 'admin';
  const now = FieldValue.serverTimestamp();

  // Create review log
  const reviewLogRef = db.collection('operator_reviews').doc();
  const reviewLog = {
    draftId,
    action,
    note: typeof note === 'string' ? note : '',
    statusAfter: newStatus,
    reviewedBy: adminEmail,
    createdAt: now,
  };

  await db.runTransaction(async (transaction: any) => {
    transaction.set(reviewLogRef, reviewLog);
    transaction.update(draftRef, {
      status: newStatus,
      updatedAt: now,
    });
  });

  return NextResponse.json({
    ok: true,
    status: newStatus,
    reviewLogId: reviewLogRef.id,
  });
}
