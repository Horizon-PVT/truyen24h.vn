import { FieldValue } from 'firebase-admin/firestore';

export const QUEUE_CONFIG = {
  INITIAL_LEASE_MS: 15 * 60 * 1000,
  HEARTBEAT_EXTENSION_MS: 5 * 60 * 1000,
  MAX_ATTEMPTS: 3,
  BACKOFF_TABLE: [
    0,
    5 * 60 * 1000,  // attempt 1 -> 5m
    15 * 60 * 1000, // attempt 2 -> 15m
  ],
  DISCOVERY_LIMIT_MAX: 100
};

export type QueueState = 'PENDING' | 'IN_PROGRESS' | 'RETRY_WAIT' | 'COMPLETED' | 'FAILED_TERMINAL';

export type SafeErrorCode = 'TIMEOUT' | 'PROVIDER_ERROR' | 'RATE_LIMITED' | 'UNKNOWN_EXECUTION_FAILURE' | 'MAX_ATTEMPTS_EXHAUSTED';
export type SafeResultCode = 'SUCCESS' | 'NO_OP' | 'UNKNOWN_EXECUTION_RESULT';

export function normalizeErrorCode(code: string): SafeErrorCode {
  if (code === 'TIMEOUT' || code === 'PROVIDER_ERROR' || code === 'RATE_LIMITED' || code === 'MAX_ATTEMPTS_EXHAUSTED') {
    return code;
  }
  return 'UNKNOWN_EXECUTION_FAILURE';
}

export function normalizeResultCode(code: string): SafeResultCode {
  if (code === 'SUCCESS' || code === 'NO_OP') {
    return code;
  }
  return 'UNKNOWN_EXECUTION_RESULT';
}

export interface QueueJob {
  schemaVersion: number;
  jobId: string;
  pipeline: string;
  scheduledSlot: string;
  idempotencyKey: string;
  status: QueueState;
  attempt: number;
  ownerToken?: string;
  leaseGeneration?: number;
  leaseExpiresAt?: string;
  heartbeatAt?: string;
  nextAttemptAt?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  resultCode?: string;
  lastErrorCode?: string;
  updatedAt: string;
}

export interface Dependencies {
  db: any;
  now: () => Date;
  generateToken: () => string;
}

function isValidPipeline(pipeline: string): boolean {
  return pipeline === 'blog' || pipeline === 'story';
}

function isValidScheduledSlot(slot: string): boolean {
  if (!/^\d{8}_\d{4}$/.test(slot)) return false;

  const year = parseInt(slot.substring(0, 4), 10);
  const month = parseInt(slot.substring(4, 6), 10);
  const day = parseInt(slot.substring(6, 8), 10);
  const hour = parseInt(slot.substring(9, 11), 10);
  const minute = parseInt(slot.substring(11, 13), 10);

  if (month < 1 || month > 12) return false;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;

  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;

  const dt = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const yyyy = dt.getUTCFullYear().toString().padStart(4, '0');
  const MM = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = dt.getUTCDate().toString().padStart(2, '0');
  const HH = dt.getUTCHours().toString().padStart(2, '0');
  const mm = dt.getUTCMinutes().toString().padStart(2, '0');
  const canonical = `${yyyy}${MM}${dd}_${HH}${mm}`;

  return canonical === slot;
}

export function generateJobId(pipeline: string, scheduledSlot: string): string {
  if (!isValidPipeline(pipeline)) {
    throw new Error('INVALID_PIPELINE');
  }
  if (!isValidScheduledSlot(scheduledSlot)) {
    throw new Error('INVALID_SCHEDULED_SLOT');
  }
  return `job_${pipeline}_${scheduledSlot}`;
}

function isCanonicalIsoDate(value: any): boolean {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return false;
  return parsed.toISOString() === value;
}

function validateSchema(data: any): string | null {
  if (data.schemaVersion !== 1) return 'UNSUPPORTED_SCHEMA';

  const validStatuses = ['PENDING', 'IN_PROGRESS', 'RETRY_WAIT', 'COMPLETED', 'FAILED_TERMINAL'];
  if (!data.status || !validStatuses.includes(data.status)) {
    return 'INVALID_STATE';
  }

  if (typeof data.attempt !== 'number' ||
      !Number.isInteger(data.attempt) ||
      data.attempt < 0 ||
      data.attempt > QUEUE_CONFIG.MAX_ATTEMPTS) {
    return 'INVALID_STATE';
  }

  if (data.status === 'IN_PROGRESS' || data.status === 'RETRY_WAIT') {
    if (typeof data.leaseGeneration !== 'number' ||
        !Number.isInteger(data.leaseGeneration) ||
        data.leaseGeneration < 0) {
      return 'INVALID_STATE';
    }
  } else if (data.status === 'PENDING') {
    if (data.leaseGeneration !== undefined &&
        (typeof data.leaseGeneration !== 'number' ||
         !Number.isInteger(data.leaseGeneration) ||
         data.leaseGeneration < 0)) {
      return 'INVALID_STATE';
    }
  }

  if (data.status === 'IN_PROGRESS') {
    if (!isCanonicalIsoDate(data.leaseExpiresAt)) {
      return 'INVALID_STATE';
    }
  }

  if (data.status === 'RETRY_WAIT') {
    if (!isCanonicalIsoDate(data.nextAttemptAt)) {
      return 'INVALID_STATE';
    }
  }

  return null;
}

export function isValidJobId(jobId: string): boolean {
  if (!jobId || typeof jobId !== 'string') return false;
  const match = jobId.match(/^job_(blog|story)_(\d{8}_\d{4})$/);
  if (!match) return false;
  const pipeline = match[1];
  const slot = match[2];
  return isValidPipeline(pipeline) && isValidScheduledSlot(slot);
}

export async function enqueueJob(deps: Dependencies, pipeline: string, scheduledSlot: string): Promise<{ ok: boolean, status: string }> {
  let jobId: string;
  try {
    jobId = generateJobId(pipeline, scheduledSlot);
  } catch (err: any) {
    return { ok: false, status: err.message };
  }

  const ref = deps.db.collection('ops_automation_jobs').doc(jobId);
  const now = deps.now();

  try {
    await ref.create({
      schemaVersion: 1,
      jobId,
      pipeline,
      scheduledSlot,
      idempotencyKey: jobId,
      status: 'PENDING',
      attempt: 0,
      nextAttemptAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return { ok: true, status: 'CREATED' };
  } catch (err: any) {
    if (err.code === 6 || err.message?.includes('ALREADY_EXISTS') || err.message?.includes('already exists')) {
      return { ok: true, status: 'ALREADY_EXISTS' };
    }
    throw err;
  }
}

export async function acquireLease(deps: Dependencies, jobId: string): Promise<{ ok: boolean, reason?: string, ownerToken?: string, leaseGeneration?: number }> {
  if (!isValidJobId(jobId)) {
    return { ok: false, reason: 'INVALID_JOB_ID' };
  }
  const ref = deps.db.collection('ops_automation_jobs').doc(jobId);

  return deps.db.runTransaction(async (t: any) => {
    const doc = await t.get(ref);
    if (!doc.exists) return { ok: false, reason: 'NOT_FOUND' };

    const data = doc.data();
    const schemaErr = validateSchema(data);
    if (schemaErr) return { ok: false, reason: schemaErr };

    const now = deps.now();

    if (data.status === 'COMPLETED' || data.status === 'FAILED_TERMINAL') {
      return { ok: false, reason: 'TERMINAL_STATE' };
    }

    let isEligible = false;
    let isRecovery = false;

    if (data.status === 'PENDING') {
      isEligible = true;
    } else if (data.status === 'RETRY_WAIT') {
      if (new Date(data.nextAttemptAt).getTime() <= now.getTime()) {
        isEligible = true;
      } else {
        return { ok: false, reason: 'NOT_DUE' };
      }
    } else if (data.status === 'IN_PROGRESS') {
      if (data.leaseExpiresAt && new Date(data.leaseExpiresAt).getTime() <= now.getTime()) {
        isEligible = true;
        isRecovery = true;
      } else {
        return { ok: false, reason: 'LEASE_ACTIVE' };
      }
    }

    if (!isEligible) {
      return { ok: false, reason: 'INELIGIBLE' };
    }

    if (data.attempt >= QUEUE_CONFIG.MAX_ATTEMPTS) {
      if (isRecovery) {
        t.update(ref, {
          status: 'FAILED_TERMINAL',
          lastErrorCode: 'MAX_ATTEMPTS_EXHAUSTED',
          updatedAt: now.toISOString(),
          ownerToken: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete(),
          heartbeatAt: FieldValue.delete(),
          nextAttemptAt: FieldValue.delete()
        });
        return { ok: false, reason: 'MAX_ATTEMPTS_EXCEEDED' };
      }
      return { ok: false, reason: 'MAX_ATTEMPTS_EXCEEDED' };
    }

    const ownerToken = deps.generateToken();
    let prevGeneration = 0;
    if (data.leaseGeneration !== undefined) {
      prevGeneration = data.leaseGeneration;
    }
    const leaseGeneration = prevGeneration + 1;
    const attempt = data.attempt + 1;

    t.update(ref, {
      status: 'IN_PROGRESS',
      ownerToken,
      leaseGeneration,
      attempt,
      startedAt: now.toISOString(),
      heartbeatAt: now.toISOString(),
      leaseExpiresAt: new Date(now.getTime() + QUEUE_CONFIG.INITIAL_LEASE_MS).toISOString(),
      updatedAt: now.toISOString(),
      nextAttemptAt: FieldValue.delete()
    });

    return { ok: true, ownerToken, leaseGeneration };
  });
}

export async function heartbeatLease(deps: Dependencies, jobId: string, ownerToken: string, leaseGeneration: number): Promise<{ ok: boolean, reason?: string }> {
  if (!isValidJobId(jobId)) {
    return { ok: false, reason: 'INVALID_JOB_ID' };
  }
  const ref = deps.db.collection('ops_automation_jobs').doc(jobId);
  return deps.db.runTransaction(async (t: any) => {
    const doc = await t.get(ref);
    if (!doc.exists) return { ok: false, reason: 'NOT_FOUND' };

    const data = doc.data();
    const schemaErr = validateSchema(data);
    if (schemaErr) return { ok: false, reason: schemaErr };

    if (data.status !== 'IN_PROGRESS') return { ok: false, reason: 'NOT_IN_PROGRESS' };

    if (data.ownerToken !== ownerToken || data.leaseGeneration !== leaseGeneration) return { ok: false, reason: 'FENCED' };

    const now = deps.now();
    if (new Date(data.leaseExpiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: 'LEASE_EXPIRED' };
    }

    const proposedExpiresMs = now.getTime() + QUEUE_CONFIG.HEARTBEAT_EXTENSION_MS;
    const currentExpiresMs = new Date(data.leaseExpiresAt).getTime();

    const updates: Record<string, any> = {
      heartbeatAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    if (proposedExpiresMs > currentExpiresMs) {
      updates.leaseExpiresAt = new Date(proposedExpiresMs).toISOString();
    }

    t.update(ref, updates);
    return { ok: true };
  });
}

export async function completeJob(deps: Dependencies, jobId: string, ownerToken: string, leaseGeneration: number, resultCode: string): Promise<{ ok: boolean, reason?: string }> {
  if (!isValidJobId(jobId)) {
    return { ok: false, reason: 'INVALID_JOB_ID' };
  }
  const ref = deps.db.collection('ops_automation_jobs').doc(jobId);
  return deps.db.runTransaction(async (t: any) => {
    const doc = await t.get(ref);
    if (!doc.exists) return { ok: false, reason: 'NOT_FOUND' };

    const data = doc.data();
    const schemaErr = validateSchema(data);
    if (schemaErr) return { ok: false, reason: schemaErr };

    if (data.status !== 'IN_PROGRESS') return { ok: false, reason: 'NOT_IN_PROGRESS' };

    if (data.ownerToken !== ownerToken || data.leaseGeneration !== leaseGeneration) return { ok: false, reason: 'FENCED' };

    const now = deps.now();
    if (new Date(data.leaseExpiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: 'LEASE_EXPIRED' };
    }

    t.update(ref, {
      status: 'COMPLETED',
      resultCode: normalizeResultCode(resultCode),
      completedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ownerToken: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      heartbeatAt: FieldValue.delete()
    });
    return { ok: true };
  });
}

export async function failJob(deps: Dependencies, jobId: string, ownerToken: string, leaseGeneration: number, errorCode: string): Promise<{ ok: boolean, reason?: string }> {
  if (!isValidJobId(jobId)) {
    return { ok: false, reason: 'INVALID_JOB_ID' };
  }
  const ref = deps.db.collection('ops_automation_jobs').doc(jobId);
  return deps.db.runTransaction(async (t: any) => {
    const doc = await t.get(ref);
    if (!doc.exists) return { ok: false, reason: 'NOT_FOUND' };

    const data = doc.data();
    const schemaErr = validateSchema(data);
    if (schemaErr) return { ok: false, reason: schemaErr };

    if (data.status !== 'IN_PROGRESS') return { ok: false, reason: 'NOT_IN_PROGRESS' };

    if (data.ownerToken !== ownerToken || data.leaseGeneration !== leaseGeneration) return { ok: false, reason: 'FENCED' };

    const now = deps.now();
    if (new Date(data.leaseExpiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: 'LEASE_EXPIRED' };
    }

    const isTerminal = data.attempt >= QUEUE_CONFIG.MAX_ATTEMPTS;

    const safeCode = normalizeErrorCode(errorCode);

    const updates: Record<string, any> = {
      status: isTerminal ? 'FAILED_TERMINAL' : 'RETRY_WAIT',
      lastErrorCode: safeCode,
      updatedAt: now.toISOString(),
      ownerToken: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      heartbeatAt: FieldValue.delete()
    };

    if (isTerminal) {
      updates.nextAttemptAt = FieldValue.delete();
    } else {
      const backoff = QUEUE_CONFIG.BACKOFF_TABLE[data.attempt] || QUEUE_CONFIG.BACKOFF_TABLE[QUEUE_CONFIG.BACKOFF_TABLE.length - 1];
      updates.nextAttemptAt = new Date(now.getTime() + backoff).toISOString();
    }

    t.update(ref, updates);
    return { ok: true };
  });
}

function validateLimit(limit: number): void {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > QUEUE_CONFIG.DISCOVERY_LIMIT_MAX) {
    throw new Error('INVALID_LIMIT');
  }
}

function validateNow(now: Date): void {
  if (!(now instanceof Date) || isNaN(now.getTime())) {
    throw new Error('INVALID_NOW');
  }
}

export function buildRetryDiscoveryQuery(db: any, limit: number, now: Date) {
  validateLimit(limit);
  validateNow(now);
  return db.collection('ops_automation_jobs')
    .where('status', 'in', ['PENDING', 'RETRY_WAIT'])
    .where('nextAttemptAt', '<=', now.toISOString())
    .orderBy('nextAttemptAt', 'asc')
    .limit(limit);
}

export function buildExpiredLeaseDiscoveryQuery(db: any, limit: number, now: Date) {
  validateLimit(limit);
  validateNow(now);
  return db.collection('ops_automation_jobs')
    .where('status', '==', 'IN_PROGRESS')
    .where('leaseExpiresAt', '<=', now.toISOString())
    .orderBy('leaseExpiresAt', 'asc')
    .limit(limit);
}
