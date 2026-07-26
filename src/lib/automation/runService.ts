import { Firestore } from 'firebase-admin/firestore';
import { executeAutomationRunCore } from './automationCore';

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

export async function executeAutomationRun(
  db: Firestore,
  input: ExecuteRunInput
): Promise<ExecuteRunResult> {
  return executeAutomationRunCore(db, input, () => Date.now(), async () => {});
}
