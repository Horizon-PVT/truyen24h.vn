/**
 * POST /api/admin/daily-run
 *
 * The "daily admin" pipeline. One call:
 *   1. Discover N trending topics
 *   2. Generate N new novels (outline + first 2 chapters each)
 *   3. Pick M existing AI novels and write +1 chapter for each
 *   4. Write everything to Firestore
 *
 * Used by the in-browser AI Studio button. Cron uses the GET variant
 * at /api/admin/daily-run-cron with bearer-token auth.
 *
 * Body (all optional):
 *   { newNovels?: number, continueNovels?: number, dryRun?: boolean }
 *
 * Auth: verified admin user or server-only machine token.
 * DB: Firebase Admin SDK — bypasses Firestore security rules.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';
import {
  discoverTrendingTopics,
  generateNovelOutline,
  generateChapter,
} from '@/services/aiStoryService';
import { buildCoverUrl, buildBannerUrl } from '@/services/aiCoverService';

export const runtime = 'nodejs';
// Vercel Hobby plan caps at 60s; setting 300 silently breaks the build.
// Daily-run keeps payload small (1 novel + 3 chapters) to fit comfortably.
export const maxDuration = 60;

type DailyRunSummary = {
  startedAt: string;
  finishedAt: string;
  newNovelsCreated: Array<{ slug: string; title: string; chapters: number }>;
  chaptersContinued: Array<{ slug: string; chapterNumber: number }>;
  errors: Array<{ stage: string; message: string }>;
  dryRun: boolean;
};

type ExistingAiNovel = {
  title?: string;
  description?: string;
  genres?: string[];
  latestChapterNumber?: number;
  lastCliffhanger?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function persistDailyRunReport(
  db: ReturnType<typeof adminDb>,
  summary: DailyRunSummary,
  source: 'admin-ui' | 'cron'
) {
  const finishedAt = new Date();
  const startedAt = new Date(summary.startedAt);
  const report = {
    ...summary,
    finishedAt: finishedAt.toISOString(),
    source,
    ok: summary.errors.length === 0,
    totals: {
      newNovels: summary.newNovelsCreated.length,
      newChaptersFromNewNovels: summary.newNovelsCreated.reduce((sum, item) => sum + item.chapters, 0),
      continuedChapters: summary.chaptersContinued.length,
      errors: summary.errors.length,
    },
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };

  try {
    const id = report.startedAt.replace(/[:.]/g, '-');
    await db.collection('ops_daily_runs').doc(id).set({
      ...report,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to persist daily run report:', error);
  }

  return report;
}

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  const body = await req.json().catch(() => ({}));
  const newNovels = Math.min(Math.max(Number(body.newNovels) || 2, 0), 5);
  const continueNovels = Math.min(Math.max(Number(body.continueNovels) || 5, 0), 20);
  const dryRun = !!body.dryRun;

  const db = adminDb();

  const summary: DailyRunSummary = {
    startedAt: new Date().toISOString(),
    finishedAt: '',
    newNovelsCreated: [] as Array<{ slug: string; title: string; chapters: number }>,
    chaptersContinued: [] as Array<{ slug: string; chapterNumber: number }>,
    errors: [] as Array<{ stage: string; message: string }>,
    dryRun,
  };

  try {
    /* ---------- 1. NEW NOVELS ---------- */
    if (newNovels > 0) {
      const topics = await discoverTrendingTopics({ count: newNovels });
      for (const t of topics) {
        try {
          const outline = await generateNovelOutline({ topic: t.topic, genres: t.suggestedGenres });
          const slug = `${slugify(outline.title)}-${Date.now().toString(36).slice(-4)}`;
          const coverUrl = buildCoverUrl(outline.coverPrompt);
          const bannerUrl = buildBannerUrl(outline.coverPrompt, outline.title);

          if (!dryRun) {
            await db.collection('novels').doc(slug).set({
              id: slug,
              title: outline.title,
              author: outline.author,
              authorId: 'system-ai',
              description: outline.description,
              coverUrl,
              bannerUrl,
              genres: outline.genres,
              tags: outline.tags,
              status: 'Đang ra',
              views: '0',
              rating: 0,
              isHot: true,
              isFull: false,
              latestChapterNumber: 0,
              aiAssisted: true,
              publishedBy: auth.email || 'system',
              hook: outline.hook,
              coverPrompt: outline.coverPrompt,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          let previousSummary = '';
          let chaptersWritten = 0;
          for (let n = 1; n <= 2; n++) {
            const chapter = await generateChapter({
              novelTitle: outline.title,
              novelDescription: outline.description,
              genres: outline.genres,
              chapterNumber: n,
              previousSummary,
              targetWordCount: 1700,
            });
            previousSummary = chapter.cliffhanger;

            if (!dryRun) {
              const batch = db.batch();
              batch.set(db.doc(`novels/${slug}/chapters/c${n}`), {
                id: `c${n}`,
                title: chapter.title,
                content: chapter.content,
                chapterNumber: n,
                isVip: false,
                price: 0,
                publishDate: serverTimestamp(),
                aiAssisted: true,
              });
              batch.update(db.doc(`novels/${slug}`), {
                latestChapterNumber: n,
                updatedAt: serverTimestamp(),
                lastUpdated: new Date().toISOString(),
                lastCliffhanger: chapter.cliffhanger,
              });
              await batch.commit();
            }
            chaptersWritten++;
          }

          summary.newNovelsCreated.push({ slug, title: outline.title, chapters: chaptersWritten });
        } catch (e: unknown) {
          summary.errors.push({ stage: `new-novel:${t.topic}`, message: getErrorMessage(e) });
        }
      }
    }

    /* ---------- 2. CONTINUE EXISTING ---------- */
    if (continueNovels > 0) {
      const snap = await db.collection('novels')
        .where('aiAssisted', '==', true)
        .where('status', '==', 'Đang ra')
        .orderBy('updatedAt', 'asc')
        .limit(continueNovels)
        .get();
      for (const docSnap of snap.docs) {
        try {
          const data = docSnap.data() as ExistingAiNovel;
          const nextNum = (data.latestChapterNumber || 0) + 1;
          const chapter = await generateChapter({
            novelTitle: data.title || 'Truyện chưa đặt tên',
            novelDescription: data.description || '',
            genres: data.genres || [],
            chapterNumber: nextNum,
            previousSummary: data.lastCliffhanger || '',
            targetWordCount: 1800,
          });

          const isVip = nextNum >= 4;
          const price = isVip ? 50 : 0;

          if (!dryRun) {
            const batch = db.batch();
            batch.set(db.doc(`novels/${docSnap.id}/chapters/c${nextNum}`), {
              id: `c${nextNum}`,
              title: chapter.title,
              content: chapter.content,
              chapterNumber: nextNum,
              isVip,
              price,
              publishDate: serverTimestamp(),
              aiAssisted: true,
            });
            batch.update(db.doc(`novels/${docSnap.id}`), {
              latestChapterNumber: nextNum,
              updatedAt: serverTimestamp(),
              lastUpdated: new Date().toISOString(),
              lastCliffhanger: chapter.cliffhanger,
            });
            await batch.commit();
          }

          summary.chaptersContinued.push({ slug: docSnap.id, chapterNumber: nextNum });
        } catch (e: unknown) {
          summary.errors.push({ stage: `continue:${docSnap.id}`, message: getErrorMessage(e) });
        }
      }
    }
  } catch (err: unknown) {
    summary.errors.push({ stage: 'top-level', message: getErrorMessage(err) });
  }

  const report = await persistDailyRunReport(db, summary, 'admin-ui');
  return NextResponse.json(report);
}
