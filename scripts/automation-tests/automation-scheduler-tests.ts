import assert from 'node:assert/strict';
import { processPipelineSchedule, getScheduledTimeUtc, SCHEDULE_CONFIG } from '../../src/lib/automation/schedulerService';
import { getAsiaHoChiMinhDateKey } from '../../src/lib/automation/dailyCap';

console.log('▶ Running Phase 3C Scheduler Tests...');

class MockDocSnapshot {
  constructor(public readonly id: string, private _exists: boolean, private _data: Record<string, any> | undefined) {}
  get exists(): boolean { return this._exists; }
  data(): Record<string, any> | undefined { return this._data ? Object.assign({}, this._data) : undefined; }
}

class MockDocRef {
  constructor(private store: Map<string, Map<string, Record<string, any>>>, public colName: string, public id: string) {}
  async get(): Promise<MockDocSnapshot> {
    const col = this.store.get(this.colName);
    const data = col?.get(this.id);
    return new MockDocSnapshot(this.id, !!data, data);
  }
  async set(data: Record<string, any>, opts?: { merge?: boolean }): Promise<void> {
    let col = this.store.get(this.colName);
    if (!col) { col = new Map(); this.store.set(this.colName, col); }
    if (opts?.merge && col.has(this.id)) {
      col.set(this.id, Object.assign({}, col.get(this.id), data));
    } else {
      col.set(this.id, Object.assign({}, data));
    }
  }
  async update(data: Record<string, any>): Promise<void> {
    const col = this.store.get(this.colName);
    if (!col || !col.has(this.id)) throw new Error('NOT_FOUND');
    col.set(this.id, Object.assign({}, col.get(this.id), data));
  }
}

class MockTransaction {
  constructor(private store: Map<string, Map<string, Record<string, any>>>) {}
  async get(ref: any) { return ref.get(); }
  set(ref: any, data: any, opts?: any) { ref.set(data, opts); }
  update(ref: any, data: any) { ref.update(data); }
  delete(ref: any) { 
    const col = this.store.get(ref.colName);
    if (col) col.delete(ref.id);
  }
}

class MockFirestore {
  store = new Map<string, Map<string, Record<string, any>>>();
  private lock = Promise.resolve();

  collection(colName: string) {
    return {
      doc: (id?: string) => {
        const docId = id || Math.random().toString(36).substring(7);
        return new MockDocRef(this.store, colName, docId);
      },
      add: async (data: any) => {
        const id = Math.random().toString(36).substring(7);
        const ref = new MockDocRef(this.store, colName, id);
        await ref.set(data);
        return ref;
      }
    };
  }

  async runTransaction(updateFunction: (t: any) => Promise<any>): Promise<any> {
    let releaseLock: () => void;
    const acquireLock = new Promise<void>(resolve => releaseLock = resolve);
    const prevLock = this.lock;
    this.lock = this.lock.then(() => acquireLock);
    
    await prevLock;
    try {
      const t = new MockTransaction(this.store);
      return await updateFunction(t);
    } finally {
      releaseLock!();
    }
  }
}

// Intercept Date to mock time
const OriginalDate = Date;
let mockedTime: number | null = null;
global.Date = class extends OriginalDate {
  constructor(...args: any[]) {
    if (args.length === 0 && mockedTime !== null) {
      super(mockedTime);
    } else {
      super(...(args as [any]));
    }
  }
  static now() {
    return mockedTime !== null ? mockedTime : OriginalDate.now();
  }
} as any;

function setMockTime(time: Date) {
  mockedTime = time.getTime();
}

async function runTests() {
  const db = new MockFirestore() as any;

  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1,
    emergencyStop: false,
    operatingMode: 'ASSISTED',
    timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 10, blogDrafts: 5, storyDrafts: 5 },
    pipelines: { blog: { enabled: true }, story: { enabled: true } }
  });

  const dateKey = getAsiaHoChiMinhDateKey(new OriginalDate());
  const blogTime = getScheduledTimeUtc(dateKey, SCHEDULE_CONFIG.blog.hour, SCHEDULE_CONFIG.blog.minute);
  
  console.log('Test: Not-due leaves execution and state unchanged');
  setMockTime(new OriginalDate(blogTime.getTime() - 1000));
  let res = await processPipelineSchedule(db, 'blog', async () => ({ ok: true as const, runId: 'run', draftId: 'draft', status: 'DRAFT_CREATED' as const, dateKey: 'mock-date' }));
  assert.equal(res.result, 'SKIPPED_NOT_DUE');

  console.log('Test: Due slot execution and exact mock invocation count');
  setMockTime(new OriginalDate(blogTime.getTime() + 1000));
  let callCount = 0;
  const mockExecute = async (db: any, input: any) => {
    callCount++;
    assert.ok(input.providedIdempotencyKey.includes('daily-v1'));
    return { ok: true as const, runId: 'run1', draftId: 'draft1', status: 'DRAFT_CREATED' as const, dateKey: 'mock-date' };
  };
  res = await processPipelineSchedule(db, 'blog', mockExecute);
  assert.equal(res.result, 'COMPLETED');
  assert.equal(callCount, 1);

  console.log('Test: Completed slot cannot rerun');
  res = await processPipelineSchedule(db, 'blog', mockExecute);
  assert.equal(res.result, 'SKIPPED_COMPLETED');
  assert.equal(callCount, 1);

  console.log('Test: Concurrent scheduler requests elect one winner');
  const storyTime = getScheduledTimeUtc(dateKey, SCHEDULE_CONFIG.story.hour, SCHEDULE_CONFIG.story.minute);
  setMockTime(new OriginalDate(storyTime.getTime() + 1000));
  
  let storyCallCount = 0;
  const mockSlowExecute = async (db: any, input: any) => {
    storyCallCount++;
    await new Promise(r => setTimeout(r, 50));
    return { ok: true as const, runId: 'run2', draftId: 'draft2', status: 'DRAFT_CREATED' as const, dateKey: 'mock-date' };
  };

  const [res1, res2] = await Promise.all([
    processPipelineSchedule(db, 'story', mockSlowExecute),
    processPipelineSchedule(db, 'story', mockSlowExecute)
  ]);
  
  assert.equal(storyCallCount, 1);
  const results = [res1.result, res2.result].sort();
  assert.deepEqual(results, ['COMPLETED', 'SKIPPED_DUPLICATE']);

  console.log('Test: Thrown execute function produces owned FAILED state and can be retried');
  await db.collection('ops_settings').doc('global').update({ pipelines: { blog: { enabled: false }, story: { enabled: true } } });
  
  setMockTime(new OriginalDate(storyTime.getTime() + 24 * 3600 * 1000));
  
  let throwCallCount = 0;
  const mockThrowExecute = async (db: any, input: any): Promise<any> => {
    throwCallCount++;
    throw new Error('Random provider crash');
  };
  
  res = await processPipelineSchedule(db, 'story', mockThrowExecute);
  assert.equal(res.result, 'FAILED');
  assert.equal(throwCallCount, 1);

  console.log('Test: Cannot retry before 15 mins (stale threshold)');
  setMockTime(new OriginalDate(storyTime.getTime() + 24 * 3600 * 1000 + 5 * 60000)); // +5 mins
  res = await processPipelineSchedule(db, 'story', mockThrowExecute);
  assert.equal(res.result, 'SKIPPED_NOT_DUE'); // nextRunAt advanced 15 mins from previous execution!
  assert.equal(throwCallCount, 1);

  console.log('Test: Retry after 15 mins (stale threshold)');
  setMockTime(new OriginalDate(storyTime.getTime() + 24 * 3600 * 1000 + 16 * 60000)); // +16 mins
  res = await processPipelineSchedule(db, 'story', mockThrowExecute);
  assert.equal(res.result, 'FAILED');
  assert.equal(throwCallCount, 2);

  console.log('Test: Phase 3B ambiguous/active duplicate maps to FAILED, NOT FAILED_TERMINAL');
  const mockDuplicateExecute = async (db: any, input: any) => {
    throwCallCount++;
    return { ok: false as const, errorCode: 'AUTOMATION_DUPLICATE_REQUEST', disposition: 'ACTIVE_DUPLICATE' as const };
  };
  setMockTime(new OriginalDate(storyTime.getTime() + 24 * 3600 * 1000 + 32 * 60000)); // +16 mins from last
  res = await processPipelineSchedule(db, 'story', mockDuplicateExecute);
  assert.equal(res.result, 'FAILED');
  assert.equal(throwCallCount, 3);
  
  console.log('Test: Max retries (4 attempts) produces FAILED_TERMINAL');
  setMockTime(new OriginalDate(storyTime.getTime() + 24 * 3600 * 1000 + 48 * 60000)); // +16m
  res = await processPipelineSchedule(db, 'story', mockDuplicateExecute); // Attempt 4
  assert.equal(res.result, 'SKIPPED_MAX_RETRIES');
  assert.equal(throwCallCount, 3); // Intercepted before execution

  console.log('Test: FAILED_TERMINAL skips future retries');
  setMockTime(new OriginalDate(storyTime.getTime() + 24 * 3600 * 1000 + 64 * 60000)); // +16m
  res = await processPipelineSchedule(db, 'story', mockThrowExecute);
  assert.equal(res.result, 'SKIPPED_FAILED_TERMINAL');
  assert.equal(throwCallCount, 3); // Intercepted before execution

  console.log('Test: Delayed worker resumption (A vs B claim reconciliation)');
  // Advance to Day 4 to ensure a fresh slot
  const day4Time = new OriginalDate(storyTime.getTime() + 72 * 3600 * 1000);
  setMockTime(day4Time);
  
  let resolveA: any;
  const promiseAExec = new Promise(r => resolveA = r);
  let sideEffectCount = 0;
  
  const mockSlowA = async (db: any, input: any) => {
    sideEffectCount++;
    await promiseAExec;
    return { ok: true as const, runId: 'run-A', draftId: 'draft-A', status: 'DRAFT_CREATED' as const, dateKey: 'mock-date' };
  };

  const pA = processPipelineSchedule(db, 'story', mockSlowA);
  await new Promise(r => setTimeout(r, 20));
  
  setMockTime(new OriginalDate(day4Time.getTime() + 16 * 60000));
  
  const mockDuplicateForB = async (db: any, input: any) => {
    return { ok: false as const, errorCode: 'AUTOMATION_DUPLICATE_REQUEST', disposition: 'ACTIVE_DUPLICATE' as const };
  };
  
  const resB = await processPipelineSchedule(db, 'story', mockDuplicateForB);
  assert.equal(resB.result, 'FAILED'); // B backs off, leaves it retryable/active
  assert.equal(sideEffectCount, 1);
  
  resolveA();
  const resA = await pA;
  assert.equal(resA.result, 'COMPLETED'); // A successfully updates state to completed
  
  setMockTime(new OriginalDate(day4Time.getTime() + 32 * 60000));
  const mockAlreadyExistsForC = async (db: any, input: any) => {
    return { ok: true as const, runId: 'run-A', draftId: 'draft-A', status: 'ALREADY_EXISTS' as const, dateKey: 'mock-date' };
  };
  
  const resC = await processPipelineSchedule(db, 'story', mockAlreadyExistsForC);
  assert.equal(resC.result, 'COMPLETED'); // C runs, checks Phase 3B natively (gets ALREADY_EXISTS) and reconciles!
  assert.equal(sideEffectCount, 1); // Side effects for A were exactly once!

  console.log('Test: MANUAL, emergency stop and disabled pipeline skips and advances nextRunAt');
  setMockTime(new OriginalDate(blogTime.getTime() + 48 * 3600 * 1000)); // Day 3
  await db.collection('ops_settings').doc('global').update({ emergencyStop: true });
  res = await processPipelineSchedule(db, 'blog', mockExecute);
  assert.equal(res.result, 'SKIPPED_CONFIG_INVALID');
  
  await db.collection('ops_settings').doc('global').update({ 
    emergencyStop: false, 
    operatingMode: 'MANUAL',
    pipelines: { blog: { enabled: true }, story: { enabled: true } }
  });
  res = await processPipelineSchedule(db, 'blog', mockExecute);
  assert.equal(res.result, 'SKIPPED_NOT_ASSISTED'); // nextRunAt is now day 4

  console.log('All tests passed safely.');
}

runTests().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
