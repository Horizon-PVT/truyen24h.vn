import { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebaseAdmin';
import { getAndValidateGlobalSettings } from './settings';
import { executeAutomationRun, ExecuteRunInput, ExecuteRunResult } from './runService';
import { getAsiaHoChiMinhDateKey } from './dailyCap';
import { createHash, randomUUID } from 'crypto';

export const SCHEDULE_CONFIG = {
  blog: { hour: 6, minute: 0 },
  story: { hour: 6, minute: 30 }
};

export function getScheduledTimeUtc(dateKey: string, hour: number, minute: number): Date {
  const year = parseInt(dateKey.slice(0, 4), 10);
  const month = parseInt(dateKey.slice(4, 6), 10) - 1;
  const day = parseInt(dateKey.slice(6, 8), 10);
  return new Date(Date.UTC(year, month, day, hour - 7, minute, 0, 0));
}

function getDeterministicEventId(pipeline: string, slotId: string, attemptId: string, result: string) {
  return createHash('sha256').update(`${pipeline}:${slotId}:${attemptId}:${result}`).digest('hex');
}

export async function logScheduleEvent(
  db: Firestore,
  pipeline: string,
  slotId: string,
  attemptId: string,
  result: string,
  reason: string,
  runId?: string
) {
  const eventId = getDeterministicEventId(pipeline, slotId, attemptId, result);
  const data: Record<string, any> = {
    pipeline,
    slotId,
    attemptId,
    scheduledFor: slotId.split('_').pop() || '',
    result,
    reason,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (runId) data.runId = runId;
  await db.collection('ops_automation_scheduler_events').doc(eventId).set(data, { merge: true });
}

export async function processPipelineSchedule(
  db: Firestore,
  pipeline: 'blog' | 'story',
  executeFn = executeAutomationRun
): Promise<{ result: string; reason: string }> {
  const dateKey = getAsiaHoChiMinhDateKey();
  const config = SCHEDULE_CONFIG[pipeline];
  if (!config) {
    return { result: 'SKIPPED_INVALID_CONFIG', reason: 'NO_CONFIG' };
  }

  const scheduledTime = getScheduledTimeUtc(dateKey, config.hour, config.minute);
  const slotId = `sched_daily-v1_${pipeline}_${scheduledTime.toISOString()}`;
  const now = new Date();
  
  const tomorrow = new Date(scheduledTime);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const skipEvent = async (result: string, reason: string) => {
    const skipAttempt = `skip_${slotId}_${result}`;
    await logScheduleEvent(db, pipeline, slotId, skipAttempt, result, reason);
    return { result, reason };
  };

  const scheduleRef = db.collection('ops_automation_schedules').doc(pipeline);

  const settingsRes = await getAndValidateGlobalSettings(db, pipeline);
  if (!settingsRes.ok) {
    await scheduleRef.set({ nextRunAt: tomorrow.toISOString(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return skipEvent('SKIPPED_CONFIG_INVALID', settingsRes.errorCode);
  }

  if (settingsRes.settings.operatingMode !== 'ASSISTED') {
    await scheduleRef.set({ nextRunAt: tomorrow.toISOString(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return skipEvent('SKIPPED_NOT_ASSISTED', 'MODE_NOT_ASSISTED');
  }

  let shouldRun = false;
  let finalResult = '';
  let finalReason = '';
  const attemptId = randomUUID();
  const nowTimestamp = FieldValue.serverTimestamp();

  await db.runTransaction(async (t) => {
    const doc = await t.get(scheduleRef);
    const data = doc.data() || {};
    
    let attempts = 1;
    if (data.activeSlotId === slotId) {
      if (data.lastResult === 'COMPLETED') {
        finalResult = 'SKIPPED_COMPLETED';
        finalReason = 'ALREADY_COMPLETED';
        t.update(scheduleRef, { nextRunAt: tomorrow.toISOString(), updatedAt: nowTimestamp });
        return;
      }
      if (data.lastResult === 'FAILED_TERMINAL') {
        finalResult = 'SKIPPED_FAILED_TERMINAL';
        finalReason = 'TERMINAL_FAILURE_BLOCKED';
        t.update(scheduleRef, { nextRunAt: tomorrow.toISOString(), updatedAt: nowTimestamp });
        return;
      }
      if (data.lastResult === 'STARTED') {
        const lastAttemptMs = data.lastAttemptAt?.toMillis?.() || (typeof data.lastAttemptAt === 'number' ? data.lastAttemptAt : 0);
        const isStale = now.getTime() - lastAttemptMs > 15 * 60000;
        if (!isStale) {
          finalResult = 'SKIPPED_DUPLICATE';
          finalReason = 'RUNNING_NOT_STALE';
          return;
        }
      }
      
      attempts = (data.attempts || 0) + 1;
      
      if (attempts > 3) {
        finalResult = 'SKIPPED_MAX_RETRIES';
        finalReason = 'MAX_RETRIES_REACHED';
        t.update(scheduleRef, { 
          lastResult: 'FAILED_TERMINAL', 
          lastReason: finalReason,
          nextRunAt: tomorrow.toISOString(), 
          updatedAt: nowTimestamp 
        });
        return;
      }
    }

    let nextRunAt = data.nextRunAt ? new Date(data.nextRunAt) : scheduledTime;

    if (now.getTime() < nextRunAt.getTime()) {
      finalResult = 'SKIPPED_NOT_DUE';
      finalReason = 'BEFORE_NEXT_RUN_AT';
      return;
    }

    t.set(
      scheduleRef,
      {
        pipeline,
        activeSlotId: slotId,
        activeAttemptId: attemptId,
        scheduledFor: scheduledTime.toISOString(),
        lastAttemptAt: now.getTime(), // Ensure reliable number for stale check
        lastResult: 'STARTED',
        lastReason: 'SCHEDULER_TRIGGERED',
        attempts,
        updatedAt: nowTimestamp,
      },
      { merge: true }
    );
    shouldRun = true;
  });

  if (!shouldRun) {
    if (finalResult.startsWith('SKIPPED')) {
      return skipEvent(finalResult, finalReason);
    }
    return { result: finalResult, reason: finalReason };
  }

  await logScheduleEvent(db, pipeline, slotId, attemptId, 'STARTED', 'EXECUTION_STARTED');

  const topic = `Scheduled auto-generation for ${dateKey}`;
  let runRes: ExecuteRunResult;
  try {
    runRes = await executeFn(db, {
      pipeline,
      topic,
      trigger: 'SCHEDULED',
      requestedBy: 'cron',
      providedIdempotencyKey: slotId,
    });
  } catch (error: unknown) {
    runRes = {
      ok: false,
      errorCode: 'AUTOMATION_INTERNAL_ERROR',
      reason: 'EXECUTION_EXCEPTION',
    };
  }

  const isComplete = runRes.ok === true && (runRes.status === 'DRAFT_CREATED' || runRes.status === 'ALREADY_EXISTS');
  
  let isTerminal = false;
  if (!runRes.ok) {
    if ((runRes as any).disposition === 'NON_RETRYABLE') {
      isTerminal = true;
    }
  }

  let termResult = isComplete ? 'COMPLETED' : (isTerminal ? 'FAILED_TERMINAL' : 'FAILED');
  let termReason = runRes.ok ? (isComplete ? 'SUCCESS' : runRes.status) : (runRes as any).errorCode;
  let termRunId = runRes.ok ? runRes.runId : (runRes as any).runId;

  const newNextRunAt = (isComplete || isTerminal) ? tomorrow : new Date(now.getTime() + 15 * 60000);

  let stateAccepted = false;
  await db.runTransaction(async (t) => {
    const doc = await t.get(scheduleRef);
    const data = doc.data();
    if (data?.activeSlotId === slotId && data?.activeAttemptId === attemptId) {
      const updates: Record<string, any> = {
        lastResult: termResult,
        lastReason: termReason,
        nextRunAt: newNextRunAt.toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (isComplete) {
        updates.lastCompletedAt = FieldValue.serverTimestamp();
      }
      if (termRunId) {
        updates.lastRunId = termRunId;
      }
      t.update(scheduleRef, updates);
      stateAccepted = true;
    }
  });

  if (stateAccepted) {
    await logScheduleEvent(db, pipeline, slotId, attemptId, termResult, termReason, termRunId);
  }

  return { result: termResult, reason: termReason };
}
