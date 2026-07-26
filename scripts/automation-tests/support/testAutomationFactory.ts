import { Firestore } from 'firebase-admin/firestore';
import { executeAutomationRunCore, claimIdempotencyKeyAtomicCore, syncStageCore, OwnershipFencingError } from '../../../src/lib/automation/automationCore';

export { OwnershipFencingError };

export interface TestDependencies {
  clockFn: () => number;
  preProviderBarrier?: () => Promise<void>;
}

export function createTestAutomationService(deps: TestDependencies) {
  return {
    executeAutomationRun: (db: Firestore, input: any) =>
      executeAutomationRunCore(db, input, deps.clockFn, deps.preProviderBarrier || (async () => {})),
    claimIdempotencyKeyAtomic: (db: Firestore, idempotencyKey: string, newRunId: string, topicNormalized: string) =>
      claimIdempotencyKeyAtomicCore(db, idempotencyKey, newRunId, topicNormalized, deps.clockFn),
    syncStage: (db: Firestore, runId: string, idempotencyKey: string, expectedOwnerToken: string, expectedState: string, nextState: string) =>
      syncStageCore(db, runId, idempotencyKey, expectedOwnerToken, expectedState as any, nextState as any),
  };
}
