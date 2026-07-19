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
  const { publishLogId } = body;

  if (typeof publishLogId !== 'string' || !publishLogId) {
    return NextResponse.json({ error: 'Missing publishLogId' }, { status: 400 });
  }

  const db = adminDb();
  const publishLogRef = db.collection('operator_publish_logs').doc(publishLogId);
  const rollbackLogRef = db.collection('operator_rollback_logs').doc();
  const adminEmail = auth.email || auth.uid || 'admin';
  const now = FieldValue.serverTimestamp();

  try {
    const result = await db.runTransaction(async (transaction: any) => {
      const publishLogDoc = await transaction.get(publishLogRef);
      if (!publishLogDoc.exists) {
        return { error: 'Publish log not found', status: 404 };
      }

      const logData = publishLogDoc.data();
      if (!logData) {
        return { error: 'Publish log data is empty', status: 500 };
      }

      // Check idempotent
      if (logData.status === 'ROLLED_BACK') {
        return {
          ok: true,
          message: 'Soft rollback already completed (idempotent)',
          idempotent: true,
        };
      }

      if (logData.status !== 'ACTIVE') {
        return {
          error: `Publish log is not ACTIVE. Current status is ${logData.status || 'undefined'}`,
          status: 400,
        };
      }

      const { draftId, type, targetDocId, targetParentId } = logData;
      const draftRef = db.collection('operator_drafts').doc(draftId);

      let targetRef;
      if (type === 'blog') {
        targetRef = db.collection('blog_posts').doc(targetDocId);
      } else if (type === 'story') {
        targetRef = db.collection('novels').doc(targetDocId);
      } else if (type === 'chapter') {
        if (!targetParentId) {
          return { error: 'Missing targetParentId in publish log', status: 400 };
        }
        targetRef = db.doc(`novels/${targetParentId}/chapters/${targetDocId}`);
      } else {
        return { error: `Unknown publish log type: ${type}`, status: 400 };
      }

      const targetDoc = await transaction.get(targetRef);
      if (!targetDoc.exists) {
        return { error: 'Target document not found. Cannot rollback', status: 404 };
      }

      const publishedFromDraftId = targetDoc.get('publishedFromDraftId');
      if (publishedFromDraftId !== draftId) {
        return {
          error: 'Cannot rollback: Target document was modified or published by another draft',
          status: 409,
        };
      }

      if (type === 'blog') {
        transaction.update(targetRef, {
          published: false,
          hidden: true,
          status: 'DRAFT',
          updatedAt: now,
        });
      } else if (type === 'story') {
        transaction.update(targetRef, {
          status: 'Tạm ẩn',
          hidden: true,
          isPrivate: true,
          updatedAt: now,
        });
      } else if (type === 'chapter') {
        transaction.update(targetRef, {
          hidden: true,
          isPrivate: true,
          published: false,
          updatedAt: now,
        });

        if (targetParentId) {
          const novelRef = db.collection('novels').doc(targetParentId);
          transaction.update(novelRef, {
            needsChapterRecount: true,
            updatedAt: now,
          });
        }
      }

      transaction.update(publishLogRef, {
        status: 'ROLLED_BACK',
        updatedAt: now,
      });

      transaction.update(draftRef, {
        status: 'APPROVED',
        updatedAt: now,
      });

      const rollbackLog = {
        publishLogId,
        draftId,
        rolledBackBy: adminEmail,
        createdAt: now,
      };
      transaction.set(rollbackLogRef, rollbackLog);

      return {
        ok: true,
        message: 'Soft rollback completed successfully',
        rollbackLogId: rollbackLogRef.id,
        draftStatus: 'APPROVED',
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[operator/rollback] error', err);
    return NextResponse.json({ error: err.message || 'Rollback failed' }, { status: 500 });
  }
}
