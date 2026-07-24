import { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebaseAdmin';
import { getAndValidateGlobalSettings } from './settings';
import {
  reserveDailyCapSlot,
  releaseDailyCapSlot,
  getAsiaHoChiMinhDateKey,
} from './dailyCap';
import {
  normalizeVietnameseText,
  generateRequestFingerprint,
  generateIdempotencyKey,
  claimIdempotencyKeyAtomic,
  releaseClaimSafelyWithOwnerCheck,
  checkExactDuplicate,
} from './dedup';
import { createOperatorDraft } from '@/lib/operator/drafts';
import { generateNovelReviewPost } from '@/services/aiBlogService';
import { generateNovelOutline } from '@/services/aiStoryService';
import { buildCoverUrl } from '@/services/aiCoverService';
import { slugifyWithSuffix } from '@/lib/slug';
import { createHash } from 'crypto';

export interface ExecuteRunInput {
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

export type ExecuteRunResult =
  | {
      ok: true;
      runId: string;
      draftId: string;
      status: 'DRAFT_CREATED' | 'NEEDS_RECONCILIATION' | 'ALREADY_EXISTS';
      dateKey: string;
    }
  | {
      ok: false;
      errorCode: string;
      reason: string;
      runId?: string;
      matchedId?: string;
    };

export type RunStage = 
  | 'PRE_PROVIDER'
  | 'PROVIDER_IN_FLIGHT'
  | 'PROVIDER_RETURNED'
  | 'DRAFT_CREATED'
  | 'FINALIZING'
  | 'FENCING_FAILED'
  | 'FAILED'
  | 'COMPLETED';

async function syncStage(
  db: Firestore, 
  runId: string, 
  idempotencyKey: string, 
  stage: RunStage, 
  updates: Record<string, any> = {}
) {
  const runRef = db.collection('ops_automation_runs').doc(runId);
  const claimRef = db.collection('ops_automation_claims').doc(idempotencyKey);
  const now = FieldValue.serverTimestamp();
  try {
    await db.runTransaction(async (t) => {
      t.update(runRef, { status: stage, updatedAt: now, ...updates });
      const claimSnap = await t.get(claimRef);
      if (claimSnap.exists) {
        const claimData = claimSnap.data();
        if (claimData?.runId === runId) {
          t.update(claimRef, { status: stage, updatedAt: now, ...updates });
        }
      }
    });
  } catch (err) {
    console.error('Failed to sync stage', stage, err);
  }
}

export async function executeAutomationRun(
  db: Firestore,
  input: ExecuteRunInput
): Promise<ExecuteRunResult> {
  const { pipeline, topic, trigger = 'MANUAL', requestedBy, providedIdempotencyKey, generatorOverride } = input;

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return {
      ok: false,
      errorCode: 'AUTOMATION_INVALID_INPUT',
      reason: 'Thiếu chủ đề (topic) hoặc chủ đề không hợp lệ.',
    };
  }

  // 1. Load and validate global settings (Fail closed)
  const settingsResult = await getAndValidateGlobalSettings(db, pipeline);
  if (!settingsResult.ok) {
    return {
      ok: false,
      errorCode: settingsResult.errorCode,
      reason: settingsResult.reason,
    };
  }
  const settings = settingsResult.settings;

  // 2. Normalization & Fingerprinting
  const dateKey = getAsiaHoChiMinhDateKey();
  const topicNormalized = normalizeVietnameseText(topic);
  const fingerprint = generateRequestFingerprint(pipeline, topicNormalized);
  const idempotencyKey = providedIdempotencyKey || generateIdempotencyKey(pipeline, topicNormalized, dateKey);

  // 3. Atomic Idempotency Claiming (Transaction / Doc Create)
  const runRef = db.collection('ops_automation_runs').doc();
  const runId = runRef.id;

  const claimResult = await claimIdempotencyKeyAtomic(db, idempotencyKey, runId, topicNormalized);
  if (!claimResult.claimed) {
    // RECONCILIATION LOGIC
    const existingRunId = claimResult.existingRunId;
    if (existingRunId) {
      const claimSnap = await db.collection('ops_automation_claims').doc(idempotencyKey).get();
      const runSnap = await db.collection('ops_automation_runs').doc(existingRunId).get();
      
      const claimData = claimSnap.data();
      const runData = runSnap.data();

      // Check if draft was created
      const draftId = claimData?.draftId || runData?.draftId;
      if (draftId) {
        const draftSnap = await db.collection('operator_drafts').doc(draftId).get();
        if (draftSnap.exists) {
          // Draft exists -> Safely return existing
          return {
            ok: true,
            runId: existingRunId,
            draftId,
            status: 'ALREADY_EXISTS',
            dateKey
          };
        }
      }

      const stage = claimData?.status || runData?.status;
      const errorCode = claimData?.errorCode || runData?.errorCode;
      if (stage === 'PROVIDER_IN_FLIGHT' || stage === 'PROVIDER_RETURNED' || errorCode === 'AUTOMATION_AMBIGUOUS_PROVIDER_RESULT') {
        // Ambiguous -> DO NOT retry provider.
        return {
          ok: true,
          runId: existingRunId,
          draftId: '',
          status: 'NEEDS_RECONCILIATION',
          dateKey
        };
      }
      
      if (stage === 'PRE_PROVIDER' && !draftId) {
         // Stale claim without side effect, we should ideally reclaim, but for safety in Phase 3B we reject.
         // Real reclamation would check timestamp (e.g. > 15 mins).
         return {
           ok: false,
           errorCode: 'AUTOMATION_DUPLICATE_REQUEST',
           reason: 'Yêu cầu đang được xử lý (PRE_PROVIDER).',
           matchedId: existingRunId
         };
      }
    }
    
    return {
      ok: false,
      errorCode: claimResult.errorCode || 'AUTOMATION_DUPLICATE_REQUEST',
      reason: 'Yêu cầu đã được tạo bởi một tiến trình khác (Trùng idempotencyKey).',
      matchedId: claimResult.existingRunId,
    };
  }

  const releaseClaim = () => releaseClaimSafelyWithOwnerCheck(db, idempotencyKey, runId);

  // Everything below here is inside try/catch so if anything fails in PRE_PROVIDER, claim is released.
  try {
    // 4. Exact Deduplication Check against existing drafts/content
    const dedupResult = await checkExactDuplicate(db, pipeline, topic, idempotencyKey, fingerprint);
    if (dedupResult.isDuplicate) {
      await releaseClaim();
      return {
        ok: false,
        errorCode: dedupResult.errorCode || 'AUTOMATION_DUPLICATE_CONTENT',
        reason: 'Phát hiện nội dung trùng lặp trong hệ thống.',
        matchedId: dedupResult.matchedId,
      };
    }

    // 5. Reserve Daily Cap Slot (Atomic Transaction with runId Fencing)
    const capResult = await reserveDailyCapSlot(db, settings, pipeline, runId);
    if (!capResult.ok) {
      await releaseClaim();
      return {
        ok: false,
        errorCode: capResult.errorCode,
        reason: 'Hệ thống đã đạt giới hạn bài viết AI trong ngày.',
      };
    }

    // 6. Create Run Record in PRE_PROVIDER status
    const now = FieldValue.serverTimestamp();
    const initialRunData = {
      schemaVersion: 1,
      runId,
      pipeline,
      trigger,
      operatingMode: settings.operatingMode,
      status: 'PRE_PROVIDER',
      idempotencyKey,
      requestFingerprint: fingerprint,
      topicNormalized,
      requestedBy,
      draftId: null,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      errorFingerprint: null,
      errorCode: null,
      retryCount: 0,
      dateKey,
      timezone: 'Asia/Ho_Chi_Minh',
    };

    try {
      await runRef.set(initialRunData);
    } catch (err: unknown) {
      // Release cap slot and claim if run record creation failed (PRE_PROVIDER)
      await releaseDailyCapSlot(db, dateKey, pipeline, runId);
      await releaseClaim();
      return {
        ok: false,
        errorCode: 'AUTOMATION_RUN_CREATE_FAILED',
        reason: 'Không thể khởi tạo nhật ký tiến trình (Database Error).',
      };
    }

    // 7. Execute Generator Logic with Lifecycle Stages
    let currentStage: RunStage = 'PRE_PROVIDER';
    let draftId: string | null = null;
    let generatedData: {
      title: string;
      content: string;
      summary: string;
      metadata?: Record<string, unknown>;
    } | null = null;

    try {
      // PRE_PROVIDER setup
      let novelDataForBlog: any = null;
      let novelIdForBlog: string = '';

      if (!generatorOverride && pipeline === 'blog') {
        const snap = await db
          .collection('novels')
          .orderBy('updatedAt', 'desc')
          .limit(5)
          .get();

        if (snap.empty) {
          throw new Error('PRE_PROVIDER_NO_NOVEL: Không tìm thấy truyện nào trong database để viết blog review.');
        }

        const pickDoc = snap.docs[Math.floor(Math.random() * snap.docs.length)];
        novelDataForBlog = pickDoc.data();
        novelIdForBlog = pickDoc.id;
      }

      // PROVIDER_IN_FLIGHT (Mark just before calling provider)
      // STALE-OWNER FENCING: Verify ownership atomically before transitioning to PROVIDER_IN_FLIGHT
      try {
        await db.runTransaction(async (transaction) => {
          const claimRef = db.collection('ops_automation_claims').doc(idempotencyKey);
          const claimSnap = await transaction.get(claimRef);
          if (!claimSnap.exists) {
            throw new Error('CLAIM_NOT_FOUND');
          }
          const claimData = claimSnap.data();
          if (claimData?.runId !== runId) {
            throw new Error('LOST_CLAIM_OWNERSHIP');
          }
          if (claimData?.status !== 'PRE_PROVIDER') {
            throw new Error('INVALID_CLAIM_STATUS');
          }
          transaction.update(claimRef, { status: 'PROVIDER_IN_FLIGHT', updatedAt: FieldValue.serverTimestamp() });
          
          const runRefTx = db.collection('ops_automation_runs').doc(runId);
          transaction.update(runRefTx, { status: 'PROVIDER_IN_FLIGHT', updatedAt: FieldValue.serverTimestamp() });
        });
      } catch (fencingError: any) {
        currentStage = 'FENCING_FAILED';
        throw new Error(`LOST_CLAIM_OWNERSHIP: ${fencingError.message}`);
      }
      
      currentStage = 'PROVIDER_IN_FLIGHT';

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
          title,
          content: String(generated.contentMarkdown || ''),
          summary: String(generated.excerpt || topic),
          metadata: {
            coverUrl,
            coverPrompt,
            tags: generated.tags || [],
            kind: 'review',
            relatedNovelSlug: novelIdForBlog,
          },
        };
      } else {
        const novel = await generateNovelOutline({ topic, genres: ['Ngôn Tình', 'Hệ Thống'] });
        const title = String(novel.title || topic);
        const coverUrl = buildCoverUrl(novel.coverPrompt || title, { width: 600, height: 800 });

        generatedData = {
          title,
          content: String(novel.description || topic),
          summary: String(novel.hook || topic),
          metadata: {
            author: novel.author || 'Tác giả AI',
            coverUrl,
            tags: novel.tags || [],
            hook: novel.hook || '',
          },
        };
      }

      // PROVIDER_RETURNED
      currentStage = 'PROVIDER_RETURNED';
      await syncStage(db, runId, idempotencyKey, currentStage);

      const slug = slugifyWithSuffix(generatedData.title);
      const draft = await createOperatorDraft(db, {
        type: pipeline,
        title: generatedData.title,
        slug,
        content: generatedData.content,
        summary: generatedData.summary,
        source: `automation_run:${runId}`,
        aiAssisted: true,
        createdBy: requestedBy,
        metadata: generatedData.metadata || {},
      });

      draftId = draft.id;
      
      // DRAFT_CREATED
      currentStage = 'DRAFT_CREATED';
      await syncStage(db, runId, idempotencyKey, currentStage, { draftId });
      
      // FINALIZING
      currentStage = 'FINALIZING';
      await syncStage(db, runId, idempotencyKey, 'COMPLETED', { draftId, completedAt: FieldValue.serverTimestamp() });

      return {
        ok: true,
        runId,
        draftId,
        status: 'DRAFT_CREATED',
        dateKey,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorHash = createHash('sha256').update(errorMessage).digest('hex').substring(0, 16);
      
      let finalErrorCode = 'AUTOMATION_INTERNAL_ERROR';
      
      // Recovery Policy Implementation
      if ((currentStage as string) === 'FENCING_FAILED' || errorMessage.includes('LOST_CLAIM_OWNERSHIP')) {
        // DO NOT release claim (belongs to new owner).
        // Hướng B: release daily cap slot cho runIdA
        await releaseDailyCapSlot(db, dateKey, pipeline, runId);
        finalErrorCode = 'AUTOMATION_LOST_CLAIM_OWNERSHIP';
      } else if (currentStage === 'PRE_PROVIDER' || errorMessage.includes('PRE_PROVIDER_NO_NOVEL')) {
        await releaseDailyCapSlot(db, dateKey, pipeline, runId);
        await releaseClaim();
        finalErrorCode = 'AUTOMATION_PRE_PROVIDER_FAILED';
      } else if (currentStage === 'PROVIDER_IN_FLIGHT') {
        // DO NOT release slot or claim. DO NOT retry blindly.
        finalErrorCode = 'AUTOMATION_AMBIGUOUS_PROVIDER_RESULT';
      } else if (currentStage === 'PROVIDER_RETURNED') {
        // Provider succeeded, but draft creation failed. DO NOT release slot or claim.
        finalErrorCode = 'AUTOMATION_DRAFT_WRITE_FAILED';
      } else if (currentStage === 'DRAFT_CREATED' || currentStage === 'FINALIZING') {
        // Draft exists, run update failed. DO NOT release slot or claim.
        finalErrorCode = 'AUTOMATION_FINALIZATION_FAILED';
      }

      try {
        await syncStage(db, runId, idempotencyKey, 'FAILED', {
          errorCode: finalErrorCode,
          errorFingerprint: errorHash,
          completedAt: FieldValue.serverTimestamp(),
        });
      } catch (runErr) {
        console.error('Failed to record run failure status:', runErr);
      }

      // Do NOT return raw provider error to client.
      return {
        ok: false,
        errorCode: finalErrorCode,
        reason: 'Lỗi trong quá trình sinh nội dung AI. Vui lòng kiểm tra log hệ thống.',
        runId,
      };
    }
  } catch (error: unknown) {
    // If anything before daily cap or run creation threw (e.g. checkExactDuplicate db failure)
    await releaseClaim();
    return {
      ok: false,
      errorCode: 'AUTOMATION_INTERNAL_ERROR',
      reason: 'Lỗi trong quá trình sinh nội dung AI. Vui lòng kiểm tra log hệ thống.',
    };
  }
}
