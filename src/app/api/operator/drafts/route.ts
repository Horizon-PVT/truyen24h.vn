import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { createOperatorDraft } from '@/lib/operator/drafts';
import type { OperatorDraftType } from '@/lib/operator/qualityGate';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

const VALID_TYPES = new Set<OperatorDraftType>(['story', 'chapter', 'blog']);

export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  const snap = await adminDb()
    .collection('operator_drafts')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const drafts = snap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ ok: true, drafts });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  const body = await req.json().catch(() => ({}));
  const type = typeof body.type === 'string' && VALID_TYPES.has(body.type) ? body.type : null;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!type || !title || !content) {
    return NextResponse.json({ error: 'Missing type/title/content' }, { status: 400 });
  }

  const draft = await createOperatorDraft(adminDb(), {
    type,
    title,
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    content,
    summary: typeof body.summary === 'string' ? body.summary : '',
    source: typeof body.source === 'string' ? body.source : 'operator_api',
    aiAssisted: true,
    createdBy: auth.email || auth.uid || 'machine-token',
    targetCollection: typeof body.targetCollection === 'string' ? body.targetCollection : undefined,
    targetParentId: typeof body.targetParentId === 'string' ? body.targetParentId : null,
    targetDocId: typeof body.targetDocId === 'string' ? body.targetDocId : null,
    metadata: isRecord(body.metadata) ? body.metadata : {},
  });

  return NextResponse.json({ ok: true, draftId: draft.id, draft });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
