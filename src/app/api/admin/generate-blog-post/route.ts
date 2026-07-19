/**
 * POST /api/admin/generate-blog-post
 *
 * Generates an AI blog draft. P0 rule: do not publish directly to blog_posts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { generateListiclePost, generateNovelReviewPost } from '@/services/aiBlogService';
import { buildCoverUrl } from '@/services/aiCoverService';
import { slugifyWithSuffix } from '@/lib/slug';
import { createOperatorDraft } from '@/lib/operator/drafts';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const maxDuration = 60;

type BlogKind = 'review' | 'listicle';

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const kind: BlogKind = body.kind === 'listicle' ? 'listicle' : 'review';
    const db = adminDb();
    let post: Record<string, unknown>;

    if (kind === 'review') {
      let novel: Record<string, unknown> | null = null;
      if (typeof body.novelSlug === 'string') {
        const snap = await db.collection('novels').doc(body.novelSlug).get();
        if (snap.exists) novel = { id: snap.id, ...snap.data() };
      } else {
        const snap = await db.collection('novels')
          .where('aiAssisted', '==', true)
          .orderBy('updatedAt', 'desc')
          .limit(5)
          .get();
        if (!snap.empty) {
          const docs = snap.docs;
          const pick = docs[Math.floor(Math.random() * docs.length)];
          novel = { id: pick.id, ...pick.data() };
        }
      }

      if (!novel) {
        return NextResponse.json({ error: 'Khong tim thay truyen AI nao de review' }, { status: 404 });
      }

      const novelId = String(novel.id || '');
      const generated = await generateNovelReviewPost({
        novelTitle: String(novel.title || ''),
        novelSlug: novelId,
        novelDescription: String(novel.description || ''),
        genres: Array.isArray(novel.genres) ? novel.genres.filter((item): item is string => typeof item === 'string') : [],
        author: String(novel.author || 'Tac gia an danh'),
      });
      post = { ...generated, kind: 'review', relatedNovelSlug: novelId };
    } else {
      const genre = typeof body.genre === 'string' ? body.genre : 'Ngon Tinh';
      const count = Math.min(Math.max(Number(body.count) || 10, 3), 15);
      const snap = await db.collection('novels')
        .where('genres', 'array-contains', genre)
        .orderBy('updatedAt', 'desc')
        .limit(count)
        .get();
      const novels = snap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        return {
          title: String(data.title || ''),
          slug: doc.id,
          description: typeof data.description === 'string' ? data.description : '',
        };
      });
      if (novels.length < 3) {
        return NextResponse.json(
          { error: `Can it nhat 3 truyen the loai "${genre}" de lam listicle. Hien co ${novels.length}.` },
          { status: 400 }
        );
      }
      const generated = await generateListiclePost({ genre, novels });
      post = { ...generated, kind: 'listicle', genre };
    }

    const title = String(post.title || '');
    const slug = slugifyWithSuffix(title);
    const coverPrompt = String(post.coverPrompt || title);
    const coverUrl = buildCoverUrl(coverPrompt, { width: 1200, height: 630 });
    const contentMarkdown = String(post.contentMarkdown || '');
    const excerpt = String(post.excerpt || '');
    const tags = Array.isArray(post.tags) ? post.tags.filter((item): item is string => typeof item === 'string') : [];

    const draft = await createOperatorDraft(db, {
      type: 'blog',
      title,
      slug,
      content: contentMarkdown,
      summary: excerpt,
      source: 'ai_blog',
      aiAssisted: true,
      createdBy: auth.email || auth.uid || 'system',
      targetCollection: 'blog_posts',
      targetDocId: slug,
      metadata: {
        excerpt,
        tags,
        coverUrl,
        coverPrompt,
        estimatedReadMinutes: post.estimatedReadMinutes,
        kind: post.kind,
        relatedNovelSlug: post.relatedNovelSlug || null,
        genre: post.genre || null,
        metaTitle: title,
        metaDescription: excerpt,
      },
    });

    return NextResponse.json({ ok: true, draftId: draft.id, draft, post: { ...post, slug, coverUrl } });
  } catch (error) {
    console.error('[admin/generate-blog-post] error', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Generation failed';
}
