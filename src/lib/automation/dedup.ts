import { createHash } from 'crypto';
import { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebaseAdmin';

export function normalizeVietnameseText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'D') // Đ -> D
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // Giữ nguyên a-z0-9
}

export function generateRequestFingerprint(pipeline: 'blog' | 'story', topic: string): string {
  const normalized = normalizeVietnameseText(topic);
  return createHash('md5').update(`${pipeline}:${normalized}`).digest('hex');
}

export function generateIdempotencyKey(pipeline: string, topicNormalized: string, dateKey: string): string {
  return createHash('sha256').update(`v1:${pipeline}:${topicNormalized}:${dateKey}`).digest('hex');
}

export async function claimIdempotencyKeyAtomic(
  db: Firestore, 
  idempotencyKey: string,
  runId: string,
  topicNormalized: string
): Promise<{ claimed: boolean; errorCode?: string; existingRunId?: string }> {
  const claimRef = db.collection('ops_automation_claims').doc(idempotencyKey);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(claimRef);
      if (doc.exists) {
        const data = doc.data();
        const now = Date.now();
        // Policy A: Only PRE_PROVIDER stale claims can be reclaimed safely
        const isStale = data?.status === 'PRE_PROVIDER' && typeof data?.expiresAt === 'number' && data.expiresAt < now;
        
        if (!isStale) {
          throw new Error(`CLAIM_EXISTS:${data?.runId}`);
        }
      }
      
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes TTL for claim expiration
      
      transaction.set(claimRef, {
        idempotencyKey,
        runId,
        topicNormalized,
        status: 'PRE_PROVIDER',
        claimedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt, // numeric timestamp for simple stale check
        draftId: null,
      });
    });
    return { claimed: true };
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.startsWith('CLAIM_EXISTS:')) {
      return { claimed: false, errorCode: 'AUTOMATION_DUPLICATE_REQUEST', existingRunId: msg.split(':')[1] };
    }
    return { claimed: false, errorCode: 'AUTOMATION_INTERNAL_ERROR' };
  }
}

export async function releaseClaimSafelyWithOwnerCheck(
  db: Firestore,
  idempotencyKey: string,
  currentRunId: string
): Promise<void> {
  const claimRef = db.collection('ops_automation_claims').doc(idempotencyKey);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(claimRef);
      if (doc.exists) {
        const data = doc.data();
        if (data && data.runId === currentRunId) {
          transaction.delete(claimRef);
        }
      }
    });
  } catch (error) {
    console.error('Failed to safely release claim:', idempotencyKey, error);
  }
}

export async function checkExactDuplicate(
  db: Firestore, 
  pipeline: 'blog' | 'story', 
  topic: string,
  idempotencyKey: string,
  fingerprint: string
): Promise<{ isDuplicate: boolean; matchedId?: string; errorCode?: string }> {
  const normalized = normalizeVietnameseText(topic);

  // 1. Kiểm tra drafts chờ duyệt (chỉ check 3 ngày gần nhất để giảm contention)
  const draftsSnap = await db.collection('operator_drafts')
    .where('type', '==', pipeline)
    .where('status', 'in', ['NEEDS_REVIEW', 'APPROVED'])
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  for (const doc of draftsSnap.docs) {
    const data = doc.data();
    if (data.title && normalizeVietnameseText(data.title) === normalized) {
      return { isDuplicate: true, matchedId: doc.id, errorCode: 'AUTOMATION_DUPLICATE_CONTENT' };
    }
  }

  // 2. Kiểm tra content public (novel/blog)
  const colName = pipeline === 'blog' ? 'blogs' : 'novels';
  const publicSnap = await db.collection(colName)
    .orderBy('updatedAt', 'desc')
    .limit(20)
    .get();
    
  for (const doc of publicSnap.docs) {
    const data = doc.data();
    if (data.title && normalizeVietnameseText(data.title) === normalized) {
      return { isDuplicate: true, matchedId: doc.id, errorCode: 'AUTOMATION_DUPLICATE_CONTENT' };
    }
  }

  return { isDuplicate: false };
}
