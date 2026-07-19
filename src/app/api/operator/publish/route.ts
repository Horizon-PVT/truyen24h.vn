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
  const draftDoc = await draftRef.get();

  if (!draftDoc.exists) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const draftData = draftDoc.data();
  if (!draftData) {
    return NextResponse.json({ error: 'Draft content is empty' }, { status: 500 });
  }

  if (draftData.status !== 'APPROVED') {
    return NextResponse.json({ error: `Only APPROVED drafts can be published. Current status is ${draftData.status}` }, { status: 400 });
  }

  const type = draftData.type;
  const adminEmail = auth.email || auth.uid || 'admin';
  const now = FieldValue.serverTimestamp();

  const publishLogRef = db.collection('operator_publish_logs').doc();

  try {
    if (type === 'blog') {
      const targetDocId = draftData.targetDocId || draftData.slug || slugifyWithSuffix(draftData.title);
      const postDoc = {
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
      };

      const blogRef = db.collection('blog_posts').doc(targetDocId);
      const publishLog = {
        draftId,
        type,
        targetCollection: 'blog_posts',
        targetDocId,
        targetParentId: null,
        publishedBy: adminEmail,
        createdAt: now,
      };

      await db.runTransaction(async (transaction: any) => {
        transaction.set(blogRef, postDoc, { merge: true });
        transaction.update(draftRef, {
          status: 'PUBLISHED',
          updatedAt: now,
          targetDocId,
          lastPublishLogId: publishLogRef.id,
        });
        transaction.set(publishLogRef, publishLog);
      });

      return NextResponse.json({ ok: true, type, targetDocId, publishLogId: publishLogRef.id });

    } else if (type === 'story') {
      const targetDocId = draftData.targetDocId || draftData.slug || (slugify(draftData.title) + '-' + Date.now().toString(36));
      const novelDoc = {
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
      };

      const novelRef = db.collection('novels').doc(targetDocId);
      const publishLog = {
        draftId,
        type,
        targetCollection: 'novels',
        targetDocId,
        targetParentId: null,
        publishedBy: adminEmail,
        createdAt: now,
      };

      await db.runTransaction(async (transaction: any) => {
        transaction.set(novelRef, novelDoc, { merge: true });
        transaction.update(draftRef, {
          status: 'PUBLISHED',
          updatedAt: now,
          targetDocId,
          lastPublishLogId: publishLogRef.id,
        });
        transaction.set(publishLogRef, publishLog);
      });

      return NextResponse.json({ ok: true, type, targetDocId, publishLogId: publishLogRef.id });

    } else if (type === 'chapter') {
      const targetParentId = draftData.targetParentId;
      if (!targetParentId) {
        return NextResponse.json({ error: 'Chapter draft is missing targetParentId' }, { status: 400 });
      }

      const chapterNumberVal = draftData.metadata?.chapterNumber;
      if (chapterNumberVal === undefined || chapterNumberVal === null) {
        return NextResponse.json({ error: 'Chapter draft is missing chapterNumber in metadata' }, { status: 400 });
      }

      const num = Number(chapterNumberVal);
      if (isNaN(num)) {
        return NextResponse.json({ error: `Invalid chapterNumber: ${chapterNumberVal}` }, { status: 400 });
      }

      const isVip = typeof draftData.metadata?.isVip === 'boolean' ? draftData.metadata.isVip : num >= 4;
      const price = isVip ? Number(draftData.metadata?.price) || 50 : 0;
      const chapterId = `c${num}`;

      const chapterDoc = {
        id: chapterId,
        title: draftData.title,
        content: draftData.content,
        chapterNumber: num,
        isVip,
        price,
        publishDate: now,
        aiAssisted: true,
      };

      const chapterRef = db.doc(`novels/${targetParentId}/chapters/${chapterId}`);
      const novelRef = db.doc(`novels/${targetParentId}`);
      
      const publishLog = {
        draftId,
        type,
        targetCollection: `novels/${targetParentId}/chapters`,
        targetDocId: chapterId,
        targetParentId,
        publishedBy: adminEmail,
        createdAt: now,
      };

      await db.runTransaction(async (transaction: any) => {
        transaction.set(chapterRef, chapterDoc, { merge: true });
        transaction.update(novelRef, {
          latestChapterNumber: num,
          updatedAt: now,
          lastUpdated: new Date().toISOString(),
        });
        transaction.update(draftRef, {
          status: 'PUBLISHED',
          updatedAt: now,
          targetDocId: chapterId,
          lastPublishLogId: publishLogRef.id,
        });
        transaction.set(publishLogRef, publishLog);
      });

      return NextResponse.json({ ok: true, type, targetDocId: chapterId, targetParentId, publishLogId: publishLogRef.id });

    } else {
      return NextResponse.json({ error: `Unknown draft type: ${type}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[operator/publish] error', err);
    return NextResponse.json({ error: err.message || 'Publish failed' }, { status: 500 });
  }
}
