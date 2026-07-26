import { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebaseAdmin';
import { getAndValidateGlobalSettings } from './settings';
import {
  reserveDailyCapSlot,
  getAsiaHoChiMinhDateKey,
} from './dailyCap';
import {
  generateRequestFingerprint,
  generateIdempotencyKey,
  checkExactDuplicate,
  normalizeVietnameseText,
} from './dedup';
import { createOperatorDraft } from '@/lib/operator/drafts';
import { generateNovelReviewPost } from '@/services/aiBlogService';
import { generateNovelOutline } from '@/services/aiStoryService';
import { buildCoverUrl } from '@/services/aiCoverService';
import { slugifyWithSuffix } from '@/lib/slug';
import { randomUUID } from 'crypto';

export class OwnershipFencingError extends Error {
  constructor(message: string = 'Lost claim ownership') {
    super(message);
    this.name = 'OwnershipFencingError';
  }
}

export type RunStage =
  | 'PRE_PROVIDER'
  | 'PROVIDER_IN_FLIGHT'
  | 'PROVIDER_RETURNED'
  | 'DRAFT_CREATED'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED';

export interface SyncUpdates {
  draftId?: string;
  retryDisposition?: 'RETRYABLE' | 'AMBIGUOUS' | 'NON_RETRYABLE';
  terminalResult?: string;
  errorCode?: string;
  completedAt?: any;
}

export type ClaimAcquireResult =
  | { kind: 'CLAIM_ACQUIRED'; runId: string; ownerToken: string; reclaimed: false }
  | { kind: 'STALE_PRE_PROVIDER_CLAIM_RECLAIMED'; runId: string; ownerToken: string; reclaimed: true }
  | { kind: 'ACTIVE_PRE_PROVIDER_CLAIM'; runId: string }
  | { kind: 'COMPLETED_CLAIM'; runId: string; draftId?: string; dateKey?: string }
  | { kind: 'AMBIGUOUS_POST_PROVIDER_CLAIM'; runId: string }
  | { kind: 'NON_RETRYABLE_CLAIM'; runId: string; reasonCode: string };

export async function claimIdempotencyKeyAtomicCore(
  db: Firestore,
  idempotencyKey: string,
  newRunId: string,
  topicNormalized: string,
  clockFn: () => number
): Promise<ClaimAcquireResult> {
  const claimRef = db.collection('ops_automation_claims').doc(idempotencyKey);
  const newOwnerToken = randomUUID();
  const nowMs = clockFn();

  try {
    return await db.runTransaction(async (transaction): Promise<ClaimAcquireResult> => {
      const doc = await transaction.get(claimRef);
      if (doc.exists) {
        const data = doc.data();
        const existingRunId = data?.runId || '';

        if (data?.claimVersion !== 2) {
          if (data?.status === 'COMPLETED' || data?.draftId) {
            return { kind: 'COMPLETED_CLAIM', runId: existingRunId, draftId: data?.draftId, dateKey: data?.dateKey };
          }
          if (data?.status === 'PRE_PROVIDER') {
            return { kind: 'ACTIVE_PRE_PROVIDER_CLAIM', runId: existingRunId };
          }
          return { kind: 'AMBIGUOUS_POST_PROVIDER_CLAIM', runId: existingRunId };
        }

        if (data?.claimState === 'COMPLETED') {
          return { kind: 'COMPLETED_CLAIM', runId: existingRunId, draftId: data?.draftId, dateKey: data?.dateKey };
        }

        if (data?.retryDisposition === 'NON_RETRYABLE') {
          return { kind: 'NON_RETRYABLE_CLAIM', runId: existingRunId, reasonCode: data?.terminalResult || 'UNKNOWN' };
        }

        if (data?.claimState === 'PROVIDER_IN_FLIGHT' || data?.claimState === 'AMBIGUOUS' || data?.retryDisposition === 'AMBIGUOUS') {
          return { kind: 'AMBIGUOUS_POST_PROVIDER_CLAIM', runId: existingRunId };
        }

        if (data?.claimState === 'PRE_PROVIDER' || data?.retryDisposition === 'RETRYABLE') {
          if (data?.providerStartedAt) {
            return { kind: 'AMBIGUOUS_POST_PROVIDER_CLAIM', runId: existingRunId };
          }

          if (typeof data?.leaseExpiresAt === 'number' && nowMs >= data.leaseExpiresAt) {
            const expiresAt = nowMs + 15 * 60 * 1000;
            transaction.update(claimRef, {
              claimState: 'PRE_PROVIDER',
              ownerToken: newOwnerToken,
              leaseExpiresAt: expiresAt,
              updatedAt: FieldValue.serverTimestamp()
            });
            return { kind: 'STALE_PRE_PROVIDER_CLAIM_RECLAIMED', runId: existingRunId, ownerToken: newOwnerToken, reclaimed: true };
          } else {
            return { kind: 'ACTIVE_PRE_PROVIDER_CLAIM', runId: existingRunId };
          }
        }

        return { kind: 'AMBIGUOUS_POST_PROVIDER_CLAIM', runId: existingRunId };
      }

      const expiresAt = nowMs + 15 * 60 * 1000;
      transaction.set(claimRef, {
        claimVersion: 2,
        idempotencyKey,
        runId: newRunId,
        ownerToken: newOwnerToken,
        topicNormalized,
        claimState: 'PRE_PROVIDER',
        claimedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        leaseExpiresAt: expiresAt,
        draftId: null,
      });
      return { kind: 'CLAIM_ACQUIRED', runId: newRunId, ownerToken: newOwnerToken, reclaimed: false };
    });
  } catch (error: any) {
    return { kind: 'NON_RETRYABLE_CLAIM', runId: newRunId, reasonCode: 'AUTOMATION_INTERNAL_ERROR' };
  }
}

export async function syncStageCore(
  db: Firestore,
  runId: string,
  idempotencyKey: string,
  ownerToken: string,
  expectedStage: RunStage,
  nextStage: RunStage,
  updates: SyncUpdates = {}
): Promise<void> {
  const runRef = db.collection('ops_automation_runs').doc(runId);
  const claimRef = db.collection('ops_automation_claims').doc(idempotencyKey);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (t) => {
    const claimSnap = await t.get(claimRef);
    if (!claimSnap.exists) throw new OwnershipFencingError('LOST_CLAIM_OWNERSHIP');
    const claimData = claimSnap.data();
    if (claimData?.claimVersion !== 2 || claimData?.runId !== runId || claimData?.ownerToken !== ownerToken || claimData?.claimState !== expectedStage) {
      throw new OwnershipFencingError('LOST_CLAIM_OWNERSHIP');
    }
    if (expectedStage === 'PRE_PROVIDER' && claimData?.providerStartedAt) {
      throw new OwnershipFencingError('LOST_CLAIM_OWNERSHIP');
    }

    const validTransitions: Record<string, string[]> = {
      'PRE_PROVIDER': ['PROVIDER_IN_FLIGHT', 'FAILED'],
      'PROVIDER_IN_FLIGHT': ['PROVIDER_RETURNED', 'FAILED'],
      'PROVIDER_RETURNED': ['DRAFT_CREATED', 'FAILED'],
      'DRAFT_CREATED': ['FINALIZING', 'FAILED', 'COMPLETED'],
      'FINALIZING': ['COMPLETED', 'FAILED'],
      'FAILED': [],
      'COMPLETED': []
    };

    if (!validTransitions[expectedStage]?.includes(nextStage)) {
      throw new OwnershipFencingError('LOST_CLAIM_OWNERSHIP');
    }

    const claimUpdates: any = { claimState: nextStage, updatedAt: now };
    if (nextStage === 'PROVIDER_IN_FLIGHT') claimUpdates.providerStartedAt = now;
    if (updates.draftId !== undefined) claimUpdates.draftId = updates.draftId;
    if (updates.retryDisposition !== undefined) claimUpdates.retryDisposition = updates.retryDisposition;
    if (updates.terminalResult !== undefined) claimUpdates.terminalResult = updates.terminalResult;

    t.update(claimRef, claimUpdates);

    const runUpdates: any = { status: nextStage, updatedAt: now };
    if (updates.draftId !== undefined) runUpdates.draftId = updates.draftId;
    if (updates.completedAt !== undefined) runUpdates.completedAt = updates.completedAt;
    if (updates.errorCode !== undefined) runUpdates.errorCode = updates.errorCode;

    t.set(runRef, runUpdates, { merge: true });
  });
}

export type CoreExecuteRunResult =
  | {
      ok: true;
      runId: string;
      status: 'DRAFT_CREATED' | 'NEEDS_RECONCILIATION' | 'ALREADY_EXISTS';
      draftId?: string;
      dateKey?: string;
    }
  | {
      ok: false;
      errorCode: string;
      reason?: string;
      runId?: string;
      matchedId?: string;
      retryable?: boolean;
      disposition?: 'ACTIVE_DUPLICATE' | 'AMBIGUOUS' | 'NON_RETRYABLE' | 'RETRYABLE_FAILURE' | 'LOST_OWNERSHIP';
    };

export interface CoreExecuteRunInput {
  pipeline: 'blog' | 'story';
  topic: string;
  trigger?: 'MANUAL' | 'SCHEDULED';
  requestedBy: string;
  providedIdempotencyKey?: string;
  generatorOverride?: (pipeline: 'blog' | 'story', topic: string) => Promise<{
    title: string;
    content: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }>;
}

export async function executeAutomationRunCore(
  db: Firestore,
  input: CoreExecuteRunInput,
  clockFn: () => number,
  barrierFn: () => Promise<void>
): Promise<CoreExecuteRunResult> {
  const { pipeline, topic, trigger = 'MANUAL', requestedBy, providedIdempotencyKey, generatorOverride } = input;

  const settingsRes = await getAndValidateGlobalSettings(db, pipeline);
  if (!settingsRes.ok) {
    return { ok: false, errorCode: settingsRes.errorCode, disposition: 'NON_RETRYABLE', retryable: false };
  }
  const settings = settingsRes.settings;

  const dateKey = getAsiaHoChiMinhDateKey();
  const topicNormalized = normalizeVietnameseText(topic);
  const fingerprint = generateRequestFingerprint(pipeline, topic);
  const idempotencyKey = providedIdempotencyKey || generateIdempotencyKey(pipeline, topicNormalized, dateKey);

  const initialRunId = db.collection('ops_automation_runs').doc().id;
  const claimResult = await claimIdempotencyKeyAtomicCore(db, idempotencyKey, initialRunId, topicNormalized, clockFn);

  if (claimResult.kind === 'COMPLETED_CLAIM') {
    return { ok: true, runId: claimResult.runId, draftId: claimResult.draftId, status: 'ALREADY_EXISTS', dateKey: claimResult.dateKey };
  }
  if (claimResult.kind === 'AMBIGUOUS_POST_PROVIDER_CLAIM') {
    return { ok: true, runId: claimResult.runId, status: 'NEEDS_RECONCILIATION' };
  }
  if (claimResult.kind === 'ACTIVE_PRE_PROVIDER_CLAIM') {
    return { ok: false, errorCode: 'AUTOMATION_DUPLICATE_REQUEST', runId: claimResult.runId, disposition: 'ACTIVE_DUPLICATE', retryable: false };
  }
  if (claimResult.kind === 'NON_RETRYABLE_CLAIM') {
    return { ok: false, errorCode: claimResult.reasonCode, runId: claimResult.runId, disposition: 'NON_RETRYABLE', retryable: false };
  }

  const runId = claimResult.runId;
  const ownerToken = claimResult.ownerToken;
  const isReclaimed = claimResult.kind === 'STALE_PRE_PROVIDER_CLAIM_RECLAIMED';
  const runRef = db.collection('ops_automation_runs').doc(runId);

  let currentStage: RunStage = 'PRE_PROVIDER';

  try {
    const dedupResult = await checkExactDuplicate(db, pipeline, topic, idempotencyKey, fingerprint);
    if (dedupResult.isDuplicate) {
      const code = dedupResult.errorCode || 'AUTOMATION_DUPLICATE_CONTENT';
      await syncStageCore(db, runId, idempotencyKey, ownerToken, 'PRE_PROVIDER', 'FAILED', {
         retryDisposition: 'NON_RETRYABLE',
         terminalResult: code,
         completedAt: FieldValue.serverTimestamp()
      });
      return { ok: false, errorCode: code, matchedId: dedupResult.matchedId, disposition: 'NON_RETRYABLE', retryable: false, runId };
    }

    if (!isReclaimed) {
      const capResult = await reserveDailyCapSlot(db, settings, pipeline, runId);
      if (!capResult.ok) {
        await syncStageCore(db, runId, idempotencyKey, ownerToken, 'PRE_PROVIDER', 'FAILED', {
           retryDisposition: 'NON_RETRYABLE',
           terminalResult: capResult.errorCode,
           completedAt: FieldValue.serverTimestamp()
        });
        return { ok: false, errorCode: capResult.errorCode, disposition: 'NON_RETRYABLE', retryable: false, runId };
      }
    }

    const now = FieldValue.serverTimestamp();
    const runData = {
      schemaVersion: 1, runId, pipeline, trigger, operatingMode: settings.operatingMode,
      status: 'PRE_PROVIDER', idempotencyKey, requestFingerprint: fingerprint,
      topicNormalized, requestedBy, draftId: null, startedAt: now, updatedAt: now,
      completedAt: null, errorFingerprint: null, errorCode: null, dateKey, timezone: 'Asia/Ho_Chi_Minh',
    };

    if (isReclaimed) {
      await runRef.update({ ...runData, retryCount: FieldValue.increment(1) });
    } else {
      await runRef.set({ ...runData, retryCount: 0 });
    }

    let novelDataForBlog: any = null;
    let novelIdForBlog: string = '';

    if (!generatorOverride && pipeline === 'blog') {
      const snap = await db.collection('novels').orderBy('updatedAt', 'desc').limit(5).get();
      if (snap.empty) {
        throw new Error('PRE_PROVIDER_NO_NOVEL: Không tìm thấy truyện nào.');
      }
      const pickDoc = snap.docs[Math.floor(Math.random() * snap.docs.length)];
      novelDataForBlog = pickDoc.data();
      novelIdForBlog = pickDoc.id;
    }

    if (barrierFn) {
      await barrierFn();
    }

    await syncStageCore(db, runId, idempotencyKey, ownerToken, 'PRE_PROVIDER', 'PROVIDER_IN_FLIGHT');
    currentStage = 'PROVIDER_IN_FLIGHT';

    let generatedData: { title: string; content: string; summary: string; metadata?: Record<string, unknown>; } | null = null;
    if (generatorOverride) {
      generatedData = await generatorOverride(pipeline, topic);
    } else if (pipeline === 'blog') {
      const generated = await generateNovelReviewPost({
        novelTitle: String(novelDataForBlog.title || topic),
        novelSlug: novelIdForBlog,
        novelDescription: String(novelDataForBlog.description || topic),
        genres: Array.isArray(novelDataForBlog.genres) ? novelDataForBlog.genres : ['Ngôn Tình'],
        author: String(novelDataForBlog.author || 'Tác giả AI'),
      });
      const title = String(generated.title || topic);
      const coverPrompt = String(generated.coverPrompt || title);
      const coverUrl = buildCoverUrl(coverPrompt, { width: 1200, height: 630 });
      generatedData = {
        title, content: String(generated.contentMarkdown || ''), summary: String(generated.excerpt || topic),
        metadata: { coverUrl, coverPrompt, tags: generated.tags || [], kind: 'review', relatedNovelSlug: novelIdForBlog },
      };
    } else {
      const novel = await generateNovelOutline({ topic, genres: ['Ngôn Tình', 'Hệ Thống'] });
      const title = String(novel.title || topic);
      const coverUrl = buildCoverUrl(novel.coverPrompt || title, { width: 600, height: 800 });
      generatedData = {
        title, content: String(novel.description || topic), summary: String(novel.hook || topic),
        metadata: { author: novel.author || 'Tác giả AI', coverUrl, tags: novel.tags || [], hook: novel.hook || '' },
      };
    }

    await syncStageCore(db, runId, idempotencyKey, ownerToken, 'PROVIDER_IN_FLIGHT', 'PROVIDER_RETURNED');
    currentStage = 'PROVIDER_RETURNED';

    const slug = slugifyWithSuffix(generatedData.title);
    const draft = await createOperatorDraft(db, {
      type: pipeline, title: generatedData.title, slug, content: generatedData.content,
      summary: generatedData.summary, source: `automation_run:${runId}`, aiAssisted: true,
      createdBy: requestedBy, metadata: generatedData.metadata || {},
    });

    const draftId = draft.id;
    await syncStageCore(db, runId, idempotencyKey, ownerToken, 'PROVIDER_RETURNED', 'DRAFT_CREATED', { draftId });
    currentStage = 'DRAFT_CREATED';

    await syncStageCore(db, runId, idempotencyKey, ownerToken, 'DRAFT_CREATED', 'FINALIZING');
    currentStage = 'FINALIZING';

    await syncStageCore(db, runId, idempotencyKey, ownerToken, 'FINALIZING', 'COMPLETED', { draftId, completedAt: FieldValue.serverTimestamp() });
    currentStage = 'COMPLETED';

    return { ok: true, runId, draftId, status: 'DRAFT_CREATED', dateKey };

  } catch (error: unknown) {
    if (error instanceof OwnershipFencingError) {
      return { ok: false, errorCode: 'AUTOMATION_LOST_CLAIM_OWNERSHIP', runId, disposition: 'LOST_OWNERSHIP', retryable: false };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    let finalErrorCode = 'AUTOMATION_INTERNAL_ERROR';
    let disposition: 'RETRYABLE' | 'AMBIGUOUS' | 'NON_RETRYABLE' = 'AMBIGUOUS';

    if (currentStage === 'PRE_PROVIDER' || errorMessage.includes('PRE_PROVIDER_NO_NOVEL')) {
      finalErrorCode = 'AUTOMATION_PRE_PROVIDER_FAILED';
      disposition = 'RETRYABLE';
      try {
        await syncStageCore(db, runId, idempotencyKey, ownerToken, currentStage, 'FAILED', {
           retryDisposition: disposition,
           terminalResult: finalErrorCode,
           errorCode: finalErrorCode,
           completedAt: FieldValue.serverTimestamp()
        });
      } catch (cleanupError) {
        if (cleanupError instanceof OwnershipFencingError) {
          return { ok: false, errorCode: 'AUTOMATION_LOST_CLAIM_OWNERSHIP', runId, disposition: 'LOST_OWNERSHIP', retryable: false };
        }
        console.warn('Failed to sync FAILED stage:', cleanupError);
      }
    } else {
      if (currentStage === 'PROVIDER_IN_FLIGHT') {
        finalErrorCode = 'AUTOMATION_AMBIGUOUS_PROVIDER_RESULT';
        disposition = 'AMBIGUOUS';
      } else if (currentStage === 'PROVIDER_RETURNED') {
        finalErrorCode = 'AUTOMATION_DRAFT_WRITE_FAILED';
        disposition = 'AMBIGUOUS';
      } else if (currentStage === 'DRAFT_CREATED' || currentStage === 'FINALIZING') {
        finalErrorCode = 'AUTOMATION_FINALIZATION_FAILED';
        disposition = 'AMBIGUOUS';
      }

      try {
        await syncStageCore(db, runId, idempotencyKey, ownerToken, currentStage, 'FAILED', {
           retryDisposition: disposition,
           terminalResult: finalErrorCode,
           errorCode: finalErrorCode,
           completedAt: FieldValue.serverTimestamp()
        });
      } catch (cleanupError) {
        if (cleanupError instanceof OwnershipFencingError) {
          return { ok: false, errorCode: 'AUTOMATION_LOST_CLAIM_OWNERSHIP', runId, disposition: 'LOST_OWNERSHIP', retryable: false };
        }
        console.warn('Failed to sync FAILED stage:', cleanupError);
      }
    }

    return {
      ok: false,
      errorCode: finalErrorCode,
      runId,
      retryable: disposition === 'RETRYABLE',
      disposition: disposition === 'RETRYABLE' ? 'RETRYABLE_FAILURE' : disposition
    };
  }
}
