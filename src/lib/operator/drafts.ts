import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebaseAdmin';
import {
  runBasicQualityGate,
  type OperatorDraftType,
  type QualityReport,
} from './qualityGate';

export type OperatorDraftStatus = 'DRAFT' | 'NEEDS_FIX' | 'NEEDS_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';

export type CreateOperatorDraftInput = {
  type: OperatorDraftType;
  title: string;
  slug?: string;
  content: string;
  summary?: string;
  source: string;
  aiAssisted?: true;
  createdBy: string;
  targetCollection?: string;
  targetParentId?: string | null;
  targetDocId?: string | null;
  metadata?: Record<string, unknown>;
  qualityReport?: QualityReport;
};

export async function createOperatorDraft(db: Firestore, input: CreateOperatorDraftInput) {
  const qualityReport = input.qualityReport || runBasicQualityGate({
    type: input.type,
    title: input.title,
    slug: input.slug,
    content: input.content,
    summary: input.summary,
    source: input.source,
    aiAssisted: input.aiAssisted,
    targetParentId: input.targetParentId,
    metaTitle: getString(input.metadata?.metaTitle),
    metaDescription: getString(input.metadata?.metaDescription),
  });

  const ref = db.collection('operator_drafts').doc();
  const now = FieldValue.serverTimestamp();
  const draft = {
    type: input.type,
    title: input.title,
    slug: input.slug || null,
    content: input.content,
    summary: input.summary || '',
    source: input.source,
    aiAssisted: true,
    status: qualityReport.blockers.length > 0 ? 'NEEDS_FIX' : 'NEEDS_REVIEW',
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    qualityReport,
    targetCollection: input.targetCollection || defaultTargetCollection(input.type),
    targetParentId: input.targetParentId || null,
    targetDocId: input.targetDocId || null,
    metadata: input.metadata || {},
  };

  await ref.set(draft);
  return { id: ref.id, ...draft, qualityReport, status: draft.status };
}

function defaultTargetCollection(type: OperatorDraftType): string {
  if (type === 'story') return 'novels';
  if (type === 'chapter') return 'novels/{id}/chapters';
  return 'blog_posts';
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
