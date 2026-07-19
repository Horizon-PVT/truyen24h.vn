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
  const publishLogDoc = await publishLogRef.get();

  if (!publishLogDoc.exists) {
    return NextResponse.json({ error: 'Publish log not found' }, { status: 404 });
  }

  const logData = publishLogDoc.data();
  if (!logData) {
    return NextResponse.json({ error: 'Publish log data is empty' }, { status: 500 });
  }

  const { draftId, type, targetDocId, targetParentId } = logData;
  const adminEmail = auth.email || auth.uid || 'admin';
  const now = FieldValue.serverTimestamp();

  const rollbackLogRef = db.collection('operator_rollback_logs').doc();
  const rollbackLog = {
    publishLogId,
    draftId,
    rolledBackBy: adminEmail,
    createdAt: now,
  };

  const draftRef = db.collection('operator_drafts').doc(draftId);

  try {
    await db.runTransaction(async (transaction: any) => {
      // 1. Soft rollback published content
      if (type === 'blog') {
        const blogRef = db.collection('blog_posts').doc(targetDocId);
        transaction.update(blogRef, {
          published: false,
          hidden: true,
          status: 'DRAFT',
          updatedAt: now,
        });
      } else if (type === 'story') {
        const novelRef = db.collection('novels').doc(targetDocId);
        transaction.update(novelRef, {
          status: 'Tạm ẩn',
          hidden: true,
          isPrivate: true,
          updatedAt: now,
        });
      } else if (type === 'chapter') {
        if (targetParentId) {
          const chapterRef = db.doc(`novels/${targetParentId}/chapters/${targetDocId}`);
          transaction.update(chapterRef, {
            hidden: true,
            isPrivate: true,
            published: false,
            updatedAt: now,
          });

          const novelRef = db.collection('novels').doc(targetParentId);
          transaction.update(novelRef, {
            needsChapterRecount: true,
            updatedAt: now,
          });
        }
      }

      // 2. Revert draft status back to APPROVED so it can be fixed or re-published
      transaction.update(draftRef, {
        status: 'APPROVED',
        updatedAt: now,
      });

      // 3. Write rollback log
      transaction.set(rollbackLogRef, rollbackLog);
    });

    return NextResponse.json({
      ok: true,
      message: 'Soft rollback completed successfully',
      rollbackLogId: rollbackLogRef.id,
      draftStatus: 'APPROVED',
    });
  } catch (err: any) {
    console.error('[operator/rollback] error', err);
    return NextResponse.json({ error: err.message || 'Rollback failed' }, { status: 500 });
  }
}
