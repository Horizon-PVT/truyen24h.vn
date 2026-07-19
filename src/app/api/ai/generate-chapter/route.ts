/**
 * POST /api/ai/generate-chapter
 *
 * Generates a single chapter for an existing novel.
 *
 * Body: {
 *   novelTitle, novelDescription, genres,
 *   chapterNumber, previousSummary?, targetWordCount?
 * }
 *
 * Returns: { title, content, wordCount, cliffhanger }
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { generateChapter } from '@/services/aiStoryService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  try {
    const body = await req.json();
    const { novelTitle, novelDescription, genres, chapterNumber, previousSummary, targetWordCount } = body;

    if (!novelTitle || !novelDescription || !chapterNumber) {
      return NextResponse.json({ error: 'Missing novelTitle / novelDescription / chapterNumber' }, { status: 400 });
    }

    const chapter = await generateChapter({
      novelTitle,
      novelDescription,
      genres: Array.isArray(genres) ? genres : [],
      chapterNumber: Number(chapterNumber),
      previousSummary,
      targetWordCount: Number(targetWordCount) || 1800,
    });

    return NextResponse.json({ ok: true, chapter });
  } catch (err: unknown) {
    console.error('[ai/generate-chapter] error', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
