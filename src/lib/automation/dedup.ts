import { createHash, randomUUID } from 'crypto';
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

import { claimIdempotencyKeyAtomicCore } from './automationCore';

export async function claimIdempotencyKeyAtomic(
  db: Firestore,
  idempotencyKey: string,
  newRunId: string,
  topicNormalized: string
) {
  return claimIdempotencyKeyAtomicCore(db, idempotencyKey, newRunId, topicNormalized, () => Date.now());
}

export async function releaseClaimSafelyWithOwnerCheck(
  db: Firestore,
  idempotencyKey: string,
  ownerToken: string
): Promise<void> {
  const claimRef = db.collection('ops_automation_claims').doc(idempotencyKey);
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(claimRef);
      if (doc.exists) {
        const data = doc.data();
        if (data && data.ownerToken === ownerToken) {
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
