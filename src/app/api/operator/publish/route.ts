import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb, FieldValue } from '@/lib/firebaseAdmin';
import { slugify, slugifyWithSuffix } from '@/lib/slug';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { draftId } = body;

  if (typeof draftId !== 'string' || !draftId) {
    return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
  }

  const db = adminDb();
  const draftRef = db.collection('operator_drafts').doc(draftId);
  const publishLogRef = db.collection('operator_publish_logs').doc();

  try {
    const result = await db.runTransaction(async (transaction: any) => {
      const draftDoc = await transaction.get(draftRef);
      if (!draftDoc.exists) {
        return { error: 'Draft not found', status: 404 };
      }

      const draftData = draftDoc.data();
      if (!draftData) {
        return { error: 'Draft content is empty', status: 500 };
      }

      // Check if draft is already published
      if (draftData.status === 'PUBLISHED') {
        const targetDocId = draftData.targetDocId;
        const type = draftData.type;
        const targetParentId = draftData.targetParentId || null;
        return {
          ok: true,
          type,
          targetDocId,
          targetParentId,
          publishLogId: draftData.lastPublishLogId || null,
          idempotent: true,
        };
      }

      if (draftData.status !== 'APPROVED') {
        return {
          error: `Only APPROVED drafts can be published. Current status is ${draftData.status}`,
          status: 400,
        };
      }

      const type = draftData.type;
      const adminEmail = auth.email || auth.uid || 'admin';
      const now = FieldValue.serverTimestamp();

      let targetRef;
      let targetDocId = '';
      let targetParentId = null;
      let targetCollection = '';
      let targetDocData: any = {};

      if (type === 'blog') {
        targetDocId = draftData.targetDocId || draftData.slug || slugifyWithSuffix(draftData.title);
        targetCollection = 'blog_posts';
        targetRef = db.collection('blog_posts').doc(targetDocId);
        targetDocData = {
          title: draftData.title,
          contentMarkdown: draftData.content,
          excerpt: draftData.summary || draftData.metadata?.excerpt || '',
          coverUrl: draftData.metadata?.coverUrl || '',
          coverPrompt: draftData.metadata?.coverPrompt || '',
          tags: draftData.metadata?.tags || [],
          kind: draftData.metadata?.kind || 'review',
          relatedNovelSlug: draftData.metadata?.relatedNovelSlug || null,
          genre: draftData.metadata?.genre || null,
          createdAt: now,
          updatedAt: now,
          aiAssisted: true,
          publishedBy: adminEmail,
          publishedFromDraftId: draftId,
        };
      } else if (type === 'story') {
        targetDocId = draftData.targetDocId || draftData.slug || (slugify(draftData.title) + '-' + Date.now().toString(36));
        targetCollection = 'novels';
        targetRef = db.collection('novels').doc(targetDocId);
        targetDocData = {
          id: targetDocId,
          title: draftData.title,
          author: draftData.metadata?.author || 'Tác giả AI',
          authorId: draftData.metadata?.authorId || 'system-ai',
          description: draftData.content,
          coverUrl: draftData.metadata?.coverUrl || '',
          bannerUrl: draftData.metadata?.bannerUrl || '',
          genres: draftData.metadata?.genres || [],
          status: 'Đang ra',
          views: '0',
          rating: 0,
          isHot: draftData.metadata?.isHot ?? true,
          isFull: false,
          lastUpdated: new Date().toISOString(),
          latestChapterNumber: 0,
          tags: draftData.metadata?.tags || [],
          aiAssisted: true,
          hook: draftData.metadata?.hook || '',
          coverPrompt: draftData.metadata?.coverPrompt || '',
          publishedBy: adminEmail,
          createdAt: now,
          updatedAt: now,
          publishedFromDraftId: draftId,
        };
      } else if (type === 'chapter') {
        targetParentId = draftData.targetParentId;
        if (!targetParentId) {
          return { error: 'Chapter draft is missing targetParentId', status: 400 };
        }
        const chapterNumberVal = draftData.metadata?.chapterNumber;
        if (chapterNumberVal === undefined || chapterNumberVal === null) {
          return { error: 'Chapter draft is missing chapterNumber in metadata', status: 400 };
        }
        const num = Number(chapterNumberVal);
        if (isNaN(num)) {
          return { error: `Invalid chapterNumber: ${chapterNumberVal}`, status: 400 };
        }
        targetDocId = `c${num}`;
        targetCollection = `novels/${targetParentId}/chapters`;
        targetRef = db.doc(`novels/${targetParentId}/chapters/${targetDocId}`);

        const isVip = typeof draftData.metadata?.isVip === 'boolean' ? draftData.metadata.isVip : num >= 4;
        const price = isVip ? Number(draftData.metadata?.price) || 50 : 0;

        targetDocData = {
          id: targetDocId,
          title: draftData.title,
          content: draftData.content,
          chapterNumber: num,
          isVip,
          price,
          publishDate: now,
          aiAssisted: true,
          publishedFromDraftId: draftId,
        };
      } else {
        return { error: `Unknown draft type: ${type}`, status: 400 };
      }

      // Check if target doc already exists
      const targetDoc = await transaction.get(targetRef);
      if (targetDoc.exists) {
        const publishedFromDraftId = targetDoc.get('publishedFromDraftId');
        if (publishedFromDraftId === draftId) {
          // Idempotent retry
          return {
            ok: true,
            type,
            targetDocId,
            targetParentId,
            publishLogId: draftData.lastPublishLogId || null,
            idempotent: true,
          };
        } else if (publishedFromDraftId !== draftId) {
          // Conflict
          return {
            error: 'Target document already exists (published by another draft or source)',
            status: 409,
          };
        }
      }

      // Proceed with publishing
      transaction.set(targetRef, targetDocData, { merge: true });

      if (type === 'chapter' && targetParentId) {
        const novelRef = db.doc(`novels/${targetParentId}`);
        const chapterNumberVal = draftData.metadata?.chapterNumber;
        const num = Number(chapterNumberVal);
        transaction.update(novelRef, {
          latestChapterNumber: num,
          updatedAt: now,
          lastUpdated: new Date().toISOString(),
        });
      }

      const publishLog = {
        draftId,
        type,
        targetCollection,
        targetDocId,
        targetParentId,
        publishedBy: adminEmail,
        createdAt: now,
        status: 'ACTIVE',
      };

      transaction.set(publishLogRef, publishLog);

      transaction.update(draftRef, {
        status: 'PUBLISHED',
        updatedAt: now,
        targetDocId,
        lastPublishLogId: publishLogRef.id,
      });

      return { ok: true, type, targetDocId, targetParentId, publishLogId: publishLogRef.id };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[operator/publish] error', err);
    return NextResponse.json({ error: err.message || 'Publish failed' }, { status: 500 });
  }
}
