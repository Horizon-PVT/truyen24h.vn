/**
 * POST /api/admin/daily-run
 *
 * Admin-triggered AI pipeline. P0 rule: generate operator drafts only. This
 * route must not publish directly to novels, chapters, or blog_posts.
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
  const createdBy = auth.email || auth.uid || 'system';
  const db = adminDb();

  const summary: DailyRunSummary = {
    startedAt: new Date().toISOString(),
    finishedAt: '',
    newNovelsCreated: [],
    chaptersContinued: [],
    errors: [],
    dryRun,
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
          let parentDraftId = '';

          if (!dryRun) {
            const storyDraft = await createOperatorDraft(db, {
              type: 'story',
              title: outline.title,
              slug,
              content: outline.description,
              summary: outline.hook,
              source: 'daily_run',
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
            parentDraftId = storyDraft.id;
          }

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

            if (!dryRun) {
              await createOperatorDraft(db, {
                type: 'chapter',
                title: chapter.title,
                content: chapter.content,
                summary: chapter.cliffhanger,
                source: 'daily_run',
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
                  parentDraftId,
                },
              });
            }
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

          if (!dryRun) {
            await createOperatorDraft(db, {
              type: 'chapter',
              title: chapter.title,
              content: chapter.content,
              summary: chapter.cliffhanger,
              source: 'daily_run',
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
          }

          summary.chaptersContinued.push({ slug: docSnap.id, chapterNumber: nextNum });
        } catch (error) {
          summary.errors.push({ stage: `continue:${docSnap.id}`, message: getErrorMessage(error) });
        }
      }
    }
  } catch (error) {
    summary.errors.push({ stage: 'top-level', message: getErrorMessage(error) });
  }

  const report = await persistDailyRunReport(db, summary, 'admin-ui');
  return NextResponse.json(report);
}
