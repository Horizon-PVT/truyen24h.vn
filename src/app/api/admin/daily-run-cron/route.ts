/**
 * GET /api/admin/daily-run-cron
 *
 * Vercel Cron wrapper for AI daily generation. P0 rule: generate operator
 * drafts only. No public novels/chapters/blog posts are published here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';
import { discoverTrendingTopics, generateChapter, generateNovelOutline } from '@/services/aiStoryService';
import { buildBannerUrl, buildCoverUrl } from '@/services/aiCoverService';
import { createOperatorDraft } from '@/lib/operator/drafts';

export const runtime = 'nodejs';
export const maxDuration = 60;

type DailyRunSummary = {
  startedAt: string;
  finishedAt: string;
  newNovelsCreated: Array<{ slug: string; title: string; chapters: number }>;
  chaptersContinued: Array<{ slug: string; chapterNumber: number }>;
  errors: Array<{ stage: string; message: string }>;
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
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function persistDailyRunReport(
  db: ReturnType<typeof adminDb>,
  summary: DailyRunSummary,
  source: 'cron'
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
    console.error('Failed to persist cron daily run report:', error);
  }

  return report;
}

export async function GET(req: NextRequest) {
  return handleDailyRunCron(req);
}

export async function POST(req: NextRequest) {
  return handleDailyRunCron(req);
}

async function handleDailyRunCron(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  const { searchParams } = new URL(req.url);
  let newNovelsVal = Number(searchParams.get('newNovels'));
  let continueNovelsVal = Number(searchParams.get('continueNovels'));

  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.newNovels !== undefined) newNovelsVal = Number(body.newNovels);
      if (body.continueNovels !== undefined) continueNovelsVal = Number(body.continueNovels);
    } catch {}
  }

  const newNovels = Math.min(Math.max(newNovelsVal || 2, 0), 5);
  const continueNovels = Math.min(Math.max(continueNovelsVal || 5, 0), 20);
  const db = adminDb();
  const createdBy = 'cron';

  const summary: DailyRunSummary = {
    startedAt: new Date().toISOString(),
    finishedAt: '',
    newNovelsCreated: [],
    chaptersContinued: [],
    errors: [],
  };

  try {
    if (newNovels > 0) {
      const topics = await discoverTrendingTopics({ count: newNovels });
      for (const topic of topics) {
        try {
          const outline = await generateNovelOutline({ topic: topic.topic, genres: topic.suggestedGenres });
          const slug = `${slugify(outline.title)}-${Date.now().toString(36).slice(-4)}`;
          const coverUrl = buildCoverUrl(outline.coverPrompt);
          const bannerUrl = buildBannerUrl(outline.coverPrompt, outline.title);
          const storyDraft = await createOperatorDraft(db, {
            type: 'story',
            title: outline.title,
            slug,
            content: outline.description,
            summary: outline.hook,
            source: 'daily_run_cron',
            aiAssisted: true,
            createdBy,
            targetCollection: 'novels',
            targetDocId: slug,
            metadata: {
              author: outline.author,
              genres: outline.genres,
              tags: outline.tags,
              coverPrompt: outline.coverPrompt,
              coverUrl,
              bannerUrl,
              status: outline.status,
            },
          });

          let previousSummary = '';
          let chaptersWritten = 0;
          for (let chapterNumber = 1; chapterNumber <= 2; chapterNumber++) {
            const chapter = await generateChapter({
              novelTitle: outline.title,
              novelDescription: outline.description,
              genres: outline.genres,
              chapterNumber,
              previousSummary,
              targetWordCount: 1700,
            });
            previousSummary = chapter.cliffhanger;
            await createOperatorDraft(db, {
              type: 'chapter',
              title: chapter.title,
              content: chapter.content,
              summary: chapter.cliffhanger,
              source: 'daily_run_cron',
              aiAssisted: true,
              createdBy,
              targetCollection: 'novels/{id}/chapters',
              targetParentId: slug,
              targetDocId: `c${chapterNumber}`,
              metadata: {
                chapterNumber,
                isVip: false,
                price: 0,
                wordCount: chapter.wordCount,
                parentDraftId: storyDraft.id,
              },
            });
            chaptersWritten++;
          }
          summary.newNovelsCreated.push({ slug, title: outline.title, chapters: chaptersWritten });
        } catch (error) {
          summary.errors.push({ stage: `new-novel:${topic.topic}`, message: getErrorMessage(error) });
        }
      }
    }

    if (continueNovels > 0) {
      const snap = await db.collection('novels')
        .where('aiAssisted', '==', true)
        .orderBy('updatedAt', 'asc')
        .limit(continueNovels)
        .get();

      for (const docSnap of snap.docs) {
        try {
          const data = docSnap.data() as ExistingAiNovel;
          const nextNum = (data.latestChapterNumber || 0) + 1;
          const chapter = await generateChapter({
            novelTitle: data.title || 'Truyen chua dat ten',
            novelDescription: data.description || '',
            genres: data.genres || [],
            chapterNumber: nextNum,
            previousSummary: data.lastCliffhanger || '',
            targetWordCount: 1800,
          });
          const isVip = nextNum >= 4;
          const price = isVip ? 50 : 0;

          await createOperatorDraft(db, {
            type: 'chapter',
            title: chapter.title,
            content: chapter.content,
            summary: chapter.cliffhanger,
            source: 'daily_run_cron',
            aiAssisted: true,
            createdBy,
            targetCollection: 'novels/{id}/chapters',
            targetParentId: docSnap.id,
            targetDocId: `c${nextNum}`,
            metadata: {
              chapterNumber: nextNum,
              isVip,
              price,
              wordCount: chapter.wordCount,
            },
          });

          summary.chaptersContinued.push({ slug: docSnap.id, chapterNumber: nextNum });
        } catch (error) {
          summary.errors.push({ stage: `continue:${docSnap.id}`, message: getErrorMessage(error) });
        }
      }
    }
  } catch (error) {
    summary.errors.push({ stage: 'top-level', message: getErrorMessage(error) });
  }

  const report = await persistDailyRunReport(db, summary, 'cron');
  return NextResponse.json(report);
}
