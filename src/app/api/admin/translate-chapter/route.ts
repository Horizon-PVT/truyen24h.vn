/**
 * POST /api/admin/translate-chapter
 *
 * Translates a single chapter. If persist=true, P0 stores an operator draft
 * instead of writing directly to public chapter documents.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { createOperatorDraft } from '@/lib/operator/drafts';
import { translateChapter } from '@/services/aiTranslateService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  try {
    const body = await req.json();
    const { raw, chapterNumber, novelTitle, glossary, persist, novelId, isVip, price } = body;
    if (!raw || !chapterNumber) {
      return NextResponse.json({ error: 'Missing raw or chapterNumber' }, { status: 400 });
    }

    const num = Number(chapterNumber);
    const translated = await translateChapter({
      raw: String(raw),
      chapterNumber: num,
      novelTitle,
      glossary,
    });

    let savedAs: string | null = null;
    let draftId: string | null = null;
    if (persist && novelId) {
      const finalIsVip = typeof isVip === 'boolean' ? isVip : num >= 4;
      const finalPrice = finalIsVip ? Number(price) || 50 : 0;
      const draft = await createOperatorDraft(adminDb(), {
        type: 'chapter',
        title: translated.title,
        content: translated.content,
        summary: '',
        source: 'translator',
        aiAssisted: true,
        createdBy: auth.email || auth.uid || 'system',
        targetCollection: 'novels/{id}/chapters',
        targetParentId: String(novelId),
        targetDocId: `c${num}`,
        metadata: {
          chapterNumber: num,
          isVip: finalIsVip,
          price: finalPrice,
          translatedFromChinese: true,
          novelTitle: novelTitle || '',
        },
      });
      draftId = draft.id;
      savedAs = `operator_drafts/${draft.id}`;
    }

    return NextResponse.json({ ok: true, ...translated, savedAs, draftId });
  } catch (error) {
    console.error('[admin/translate-chapter] error', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Translate failed';
}
