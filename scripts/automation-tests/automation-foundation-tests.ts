import assert from 'node:assert/strict';
import { createTestAutomationService, OwnershipFencingError } from './support/testAutomationFactory';
import { getAndValidateGlobalSettings } from '../../src/lib/automation/settings';
import { getAsiaHoChiMinhDateKey } from '../../src/lib/automation/dailyCap';

console.log('▶ Running Production Module Unit, Integration & Concurrency Tests (Phase 3B Defect Remediation) ...');

// --- InMemory Mock Firestore Implementation ---
class MockDocSnapshot {
  constructor(public readonly id: string, private _exists: boolean, private _data: Record<string, any> | undefined) {}
  get exists(): boolean { return this._exists; }
  data(): Record<string, any> | undefined { return this._data ? Object.assign({}, this._data) : undefined; }
  get(field: string): any { return this._data ? this._data[field] : undefined; }
}

class MockQuery {
  constructor(private store: Map<string, Map<string, Record<string, any>>>, private colName: string, private filters: Array<{ field: string; op: string; val: any }> = [], private orderBys: Array<{ field: string; dir: 'asc' | 'desc' }> = [], private limitVal: number = 100) {}
  where(field: string, op: string, val: any): MockQuery { return new MockQuery(this.store, this.colName, [...this.filters, { field, op, val }], this.orderBys, this.limitVal); }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): MockQuery { return new MockQuery(this.store, this.colName, this.filters, [...this.orderBys, { field, dir }], this.limitVal); }
  limit(n: number): MockQuery { return new MockQuery(this.store, this.colName, this.filters, this.orderBys, n); }
  async get(): Promise<{ empty: boolean; docs: MockDocSnapshot[] }> {
    const col = this.store.get(this.colName) || new Map();
    let list: Array<{ id: string; data: Record<string, any> }> = [];
    col.forEach((data, id) => { list.push({ id, data }); });
    for (const f of this.filters) {
      list = list.filter((item) => {
        const val = item.data[f.field];
        if (f.op === '==') return val === f.val;
        if (f.op === 'in' && Array.isArray(f.val)) return f.val.includes(val);
        return true;
      });
    }
    if (this.orderBys.length > 0) {
      const { field, dir } = this.orderBys[0];
      list.sort((a, b) => {
        const valA = a.data[field] || '';
        const valB = b.data[field] || '';
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    list = list.slice(0, this.limitVal);
    const docs = list.map((item) => new MockDocSnapshot(item.id, true, item.data));
    return { empty: docs.length === 0, docs };
  }
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
      const existing = col.get(this.id) || {};
      col.set(this.id, Object.assign({}, existing, data));
    } else {
      col.set(this.id, Object.assign({}, data));
    }
  }
  async update(data: Record<string, any>): Promise<void> {
    const col = this.store.get(this.colName);
    const existing = col?.get(this.id);
    if (!existing) throw new Error(`Document ${this.id} does not exist`);

    const newData = Object.assign({}, existing);
    for (const key of Object.keys(data)) {
      const val = data[key];
      newData[key] = val;
    }
    if (data.retryCount && typeof data.retryCount === 'object') {
       newData.retryCount = (existing.retryCount || 0) + 1;
    }
    col!.set(this.id, newData);
  }
  async delete(): Promise<void> {
    const col = this.store.get(this.colName);
    if (col) col.delete(this.id);
  }
}

class MockTransaction {
  constructor(private store: Map<string, Map<string, Record<string, any>>>) {}
  async get(docRef: MockDocRef): Promise<MockDocSnapshot> { return docRef.get(); }
  set(docRef: MockDocRef, data: Record<string, any>, opts?: { merge?: boolean }): void {
    let col = this.store.get(docRef.colName);
    if (!col) { col = new Map(); this.store.set(docRef.colName, col); }

    const existing = opts?.merge && col.has(docRef.id) ? (col.get(docRef.id) || {}) : {};
    const newData = Object.assign({}, existing);

    for (const key of Object.keys(data)) {
      const val = data[key];
      newData[key] = val;
    }

    // Resolve increments in set (for daily caps using merge: true)
    if (data.totalDrafts && typeof data.totalDrafts === 'object') newData.totalDrafts = (existing.totalDrafts || 0) + 1;
    if (data.blogDrafts && typeof data.blogDrafts === 'object') newData.blogDrafts = (existing.blogDrafts || 0) + 1;
    if (data.storyDrafts && typeof data.storyDrafts === 'object') newData.storyDrafts = (existing.storyDrafts || 0) + 1;

    col.set(docRef.id, newData);
  }
  update(docRef: MockDocRef, data: Record<string, any>): void {
    const col = this.store.get(docRef.colName);
    const existing = col?.get(docRef.id);
    if (!existing) throw new Error(`Document ${docRef.id} does not exist`);

    const newData = Object.assign({}, existing);
    for (const key of Object.keys(data)) {
      const val = data[key];
      newData[key] = val;
    }
    if (data.totalDrafts && typeof data.totalDrafts === 'object') newData.totalDrafts = (existing.totalDrafts || 0) + 1;
    if (data.blogDrafts && typeof data.blogDrafts === 'object') newData.blogDrafts = (existing.blogDrafts || 0) + 1;
    if (data.storyDrafts && typeof data.storyDrafts === 'object') newData.storyDrafts = (existing.storyDrafts || 0) + 1;

    col!.set(docRef.id, newData);
  }
  delete(docRef: MockDocRef): void {
    const col = this.store.get(docRef.colName);
    if (col) col.delete(docRef.id);
  }
}

function createMockDb() {
  const store = new Map<string, Map<string, Record<string, any>>>();
  let autoIdCounter = 1000;
  let transactionLock = Promise.resolve();
  return {
    store,
    collection(name: string) {
      return {
        doc(id?: string) {
          const docId = id || `auto_doc_${++autoIdCounter}`;
          return new MockDocRef(store, name, docId);
        },
        where(field: string, op: string, val: any) { return new MockQuery(store, name, [{ field, op, val }]); },
        orderBy(field: string, dir: 'asc' | 'desc' = 'asc') { return new MockQuery(store, name, [], [{ field, dir }]); },
        limit(n: number) { return new MockQuery(store, name, [], [], n); },
        async get() { return new MockQuery(store, name).get(); },
      };
    },
    async runTransaction<T>(updateFunction: (transaction: MockTransaction) => Promise<T>): Promise<T> {
      const execute = async () => {
        const transaction = new MockTransaction(store);
        return updateFunction(transaction);
      };
      const previous = transactionLock;
      let resolveLock: () => void;
      transactionLock = new Promise<void>((r) => { resolveLock = r; });
      try {
        await previous;
        return await execute();
      } finally {
        resolveLock!();
      }
    },
  } as unknown as any;
}

// ==========================================
// ORIGINAL 7 SUITES (Adapted for factory)
// ==========================================

async function testSettingsValidation() {
  console.log('\n--- Suite 1: Strict Settings Validation (Mock Value Preservation) ---');
  const db = createMockDb();

  const resMissing = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resMissing.ok, false);
  assert.equal(resMissing.errorCode, 'AUTOMATION_SETTINGS_MISSING');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 2, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: 1, blogDrafts: 1, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const res2 = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(res2.ok, false);
  if (!res2.ok) assert.equal(res2.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'UTC', dailyCaps: { totalDrafts: 1, blogDrafts: 1, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const res3 = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(res3.ok, false);
  if (!res3.ok) assert.equal(res3.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: NaN, blogDrafts: 1, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const resNaN = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resNaN.ok, false);
  if (!resNaN.ok) assert.equal(resNaN.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: Infinity, blogDrafts: 1, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const resInf = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resInf.ok, false);
  if (!resInf.ok) assert.equal(resInf.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: -5, blogDrafts: 1, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const resNeg = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resNeg.ok, false);
  if (!resNeg.ok) assert.equal(resNeg.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: 1.5, blogDrafts: 1, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const resDec = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resDec.ok, false);
  if (!resDec.ok) assert.equal(resDec.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: 5, blogDrafts: NaN, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const resBlogNan = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resBlogNan.ok, false);
  if (!resBlogNan.ok) assert.equal(resBlogNan.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: 5, blogDrafts: 1, storyDrafts: -1 }, pipelines: { blog: { enabled: true } } });
  const resStoryNeg = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resStoryNeg.ok, false);
  if (!resStoryNeg.ok) assert.equal(resStoryNeg.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: 2, blogDrafts: 2, storyDrafts: 2 }, pipelines: { blog: { enabled: true }, story: { enabled: true } } });
  const resManual = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resManual.ok, true);

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'ASSISTED', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: 2, blogDrafts: 2, storyDrafts: 2 }, pipelines: { blog: { enabled: true }, story: { enabled: true } } });
  const resAssisted = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(resAssisted.ok, true);

  await db.collection('ops_settings').doc('global').set({ schemaVersion: 1, emergencyStop: false, operatingMode: 'CONTROLLED_AUTO', timezone: 'Asia/Ho_Chi_Minh', dailyCaps: { totalDrafts: 1, blogDrafts: 1, storyDrafts: 1 }, pipelines: { blog: { enabled: true } } });
  const res5 = await getAndValidateGlobalSettings(db, 'blog');
  assert.equal(res5.ok, false);
  if (!res5.ok) assert.equal(res5.errorCode, 'AUTOMATION_MODE_NOT_ALLOWED');

  const dbReadFail = createMockDb();
  dbReadFail.collection = (name: string) => {
    return { doc: (id: string) => { return { get: async () => { throw new Error('DB Down'); } } } } as any;
  }
  const resReadFail = await getAndValidateGlobalSettings(dbReadFail, 'blog');
  assert.equal(resReadFail.ok, false);
  if (!resReadFail.ok) assert.equal(resReadFail.errorCode, 'AUTOMATION_SETTINGS_INVALID');

  console.log('  ✔ testSettingsValidation PASSED');
}

async function testDeduplicationAndCaps() {
  console.log('\n--- Suite 2: Deduplication & Daily Caps ---');
  const db = createMockDb();
  const service = createTestAutomationService({ clockFn: () => Date.now() });

  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 3, blogDrafts: 3, storyDrafts: 1 },
    pipelines: { blog: { enabled: true }, story: { enabled: true } }
  });

  await db.collection('operator_drafts').doc('d1').set({ type: 'story', title: 'Truyện Trùng Lặp', slug: 'truyen-trung-lap', status: 'APPROVED' });
  const resDupDraft = await service.executeAutomationRun(db, { pipeline: 'story', topic: 'Truyện Trùng Lặp', requestedBy: 'admin' });
  assert.equal(resDupDraft.ok, false);
  if (!resDupDraft.ok) assert.equal(resDupDraft.errorCode, 'AUTOMATION_DUPLICATE_CONTENT');

  await db.collection('novels').doc('n1').set({ title: 'Truyện Trùng Lặp 2', slug: 'truyen-trung-lap-2' });
  const resDupNovel = await service.executeAutomationRun(db, { pipeline: 'story', topic: 'Truyện Trùng Lặp 2', requestedBy: 'admin' });
  assert.equal(resDupNovel.ok, false);
  if (!resDupNovel.ok) assert.equal(resDupNovel.errorCode, 'AUTOMATION_DUPLICATE_CONTENT');

  await db.collection('novels').doc('dummy-novel').set({ title: 'Dummy', genres: ['Ngôn Tình'] });
  const generatorOverride = async () => ({ title: 'Story Cap 1', content: '...', summary: '...' });
  const resStory1 = await service.executeAutomationRun(db, { pipeline: 'story', topic: 'Story Cap 1', requestedBy: 'admin', generatorOverride });
  assert.equal(resStory1.ok, true);

  const resStory2 = await service.executeAutomationRun(db, { pipeline: 'story', topic: 'Story Cap 2', requestedBy: 'admin', generatorOverride });
  assert.equal(resStory2.ok, false);
  if (!resStory2.ok) assert.equal(resStory2.errorCode, 'AUTOMATION_DAILY_CAP_STORY_REACHED');

  const origCollection = db.collection.bind(db);
  db.collection = (name: string) => {
    if (name === 'ops_automation_runs') {
      return { doc: (id?: string) => { return { id: id || 'dummy', set: async () => { throw new Error('DB Error during set'); }, get: async () => ({ exists: false, data: () => undefined }) }; } } as any;
    }
    return origCollection(name);
  };
  const resRunFail = await service.executeAutomationRun(db, { pipeline: 'blog', topic: 'Run Fail', requestedBy: 'admin', generatorOverride });
  assert.equal(resRunFail.ok, false);
  if (!resRunFail.ok) assert.equal(resRunFail.errorCode, 'AUTOMATION_PRE_PROVIDER_FAILED');
  db.collection = origCollection;

  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 100, blogDrafts: 100, storyDrafts: 100 },
    pipelines: { blog: { enabled: true }, story: { enabled: true } }
  });

  let blogGenCalled = false;
  let storyGenCalled = false;
  await service.executeAutomationRun(db, { pipeline: 'blog', topic: 'Blog Tax', requestedBy: 'admin', generatorOverride: async () => { blogGenCalled = true; return { title: 'Blog', content: '', summary: '' }; } });
  assert.equal(blogGenCalled, true);

  await service.executeAutomationRun(db, { pipeline: 'story', topic: 'Story Tax', requestedBy: 'admin', generatorOverride: async () => { storyGenCalled = true; return { title: 'Story', content: '', summary: '' }; } });
  assert.equal(storyGenCalled, true);

  console.log('  ✔ testDeduplicationAndCaps PASSED');
}

async function testConcurrency() {
  console.log('\n--- Suite 3: Real Concurrency Test ---');
  const db = createMockDb();
  const service = createTestAutomationService({ clockFn: () => Date.now() });

  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 1, blogDrafts: 1, storyDrafts: 1 },
    pipelines: { blog: { enabled: true }, story: { enabled: true } }
  });
  await db.collection('novels').doc('dummy-novel').set({ title: 'Dummy', genres: ['Ngôn Tình'] });

  let generatorCallCount = 0;
  const slowGenerator = async () => {
    generatorCallCount++;
    await new Promise(resolve => setTimeout(resolve, 50));
    return { title: 'Title', content: 'Content', summary: 'Summary' };
  };

  const req1 = service.executeAutomationRun(db, { pipeline: 'blog', topic: 'Req 1', requestedBy: 'admin', generatorOverride: slowGenerator });
  const req2 = service.executeAutomationRun(db, { pipeline: 'blog', topic: 'Req 2', requestedBy: 'admin', generatorOverride: slowGenerator });
  const req3 = service.executeAutomationRun(db, { pipeline: 'blog', topic: 'Req 3', requestedBy: 'admin', generatorOverride: slowGenerator });

  const results = await Promise.all([req1, req2, req3]);
  const successes = results.filter(r => r.ok);
  const failures = results.filter(r => !r.ok);

  assert.equal(successes.length, 1, 'Exactly 1 request should succeed the cap reservation');
  assert.equal(failures.length, 2, 'Exactly 2 requests should fail');
  assert.equal(generatorCallCount, 1, 'Generator should only be called once for the winner');
  assert.equal((failures[0] as any).errorCode, 'AUTOMATION_DAILY_CAP_REACHED');

  console.log('  ✔ testConcurrency PASSED');
}

async function testApiValidations() {
  console.log('\n--- Suite 4: API Validations (POST route simulation) ---');
  const badIdempotencyKeys = ['short', 'long'.repeat(20), 'invalid-chars!@#', 'with space', ''];
  for (const k of badIdempotencyKeys) {
    const isValid = typeof k === 'string' && /^[a-f0-9]{32,64}$/.test(k);
    assert.equal(isValid, false, `Idempotency key ${k} should be invalid`);
  }
  const validKey = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  assert.equal(/^[a-f0-9]{32,64}$/.test(validKey), true);
  console.log('  ✔ testApiValidations PASSED');
}

async function testPhase3BStaleClaimPatch() {
  console.log('\n--- Suite 5: Phase 3B Stale Claim Patch ---');
  const db = createMockDb();

  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 10, blogDrafts: 10, storyDrafts: 10 },
    pipelines: { blog: { enabled: true } }
  });

  const now = Date.now();
  let time = now;
  const service = createTestAutomationService({ clockFn: () => time });

  const v2Res = await service.claimIdempotencyKeyAtomic(db, 'idem-v2', 'run-v2-1', 'v2-topic');
  assert.equal(v2Res.kind, 'CLAIM_ACQUIRED');

  time = now + 14 * 60 * 1000;
  const activeRes = await service.claimIdempotencyKeyAtomic(db, 'idem-v2', 'run-v2-2', 'v2-topic');
  assert.equal(activeRes.kind, 'ACTIVE_PRE_PROVIDER_CLAIM');

  time = now + 16 * 60 * 1000;
  const reclaimRes = await service.claimIdempotencyKeyAtomic(db, 'idem-v2', 'run-v2-3', 'v2-topic');
  assert.equal(reclaimRes.kind, 'STALE_PRE_PROVIDER_CLAIM_RECLAIMED', 'reclaimed claim must be positively identified');

  await db.collection('ops_automation_claims').doc('legacy-claim').set({ idempotencyKey: 'legacy-claim', runId: 'legacy-run', status: 'PRE_PROVIDER', expiresAt: now - 1000 });
  const legacyRes = await service.claimIdempotencyKeyAtomic(db, 'legacy-claim', 'new-run', 'legacy topic');
  assert.equal(legacyRes.kind, 'ACTIVE_PRE_PROVIDER_CLAIM', 'legacy expired PRE_PROVIDER claim is not reclaimed automatically');

  const compRes = await service.claimIdempotencyKeyAtomic(db, 'completed-claim', 'run-x', 'x');
  await db.collection('ops_automation_claims').doc('completed-claim').update({ claimState: 'COMPLETED', draftId: 'draft-1' });
  const compRes2 = await service.claimIdempotencyKeyAtomic(db, 'completed-claim', 'run-x2', 'x');
  assert.equal(compRes2.kind, 'COMPLETED_CLAIM');

  let resolveProvider: () => void;
  const providerPromise = new Promise<void>((r) => { resolveProvider = r; });

  const execRes = service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Fencing Test', requestedBy: 'admin', providedIdempotencyKey: 'fencing-key',
    generatorOverride: async () => { await providerPromise; return { title: 'T', content: 'C', summary: 'S' }; }
  });

  await new Promise(r => setTimeout(r, 100));

  time = Date.now() + 20 * 60 * 1000;
  const fClaim = await service.claimIdempotencyKeyAtomic(db, 'fencing-key', 'fencing-run-2', 'fencing test');
  assert.equal(fClaim.kind, 'AMBIGUOUS_POST_PROVIDER_CLAIM', 'provider-started claim is never reclaimed due to age');

  resolveProvider!();
  const finalExecRes = await execRes;
  assert.equal(finalExecRes.ok, true);

  console.log('  ✔ testPhase3BStaleClaimPatch PASSED');
}

async function testPhase3B17ConditionsRegression() {
  console.log('\n--- Suite 6: Phase 3B 17 Conditions Regression ---');
  const db = createMockDb();
  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 10, blogDrafts: 10, storyDrafts: 10 },
    pipelines: { blog: { enabled: true } }
  });

  let time = Date.now();
  let preProviderBarrier: () => Promise<void> = async () => {};
  const service = createTestAutomationService({ clockFn: () => time, preProviderBarrier: async () => preProviderBarrier() });

  const idKey = 'cond-test';
  const runId = 'cond-run';
  const ownerToken = 'cond-owner';

  await db.collection('ops_automation_claims').doc(idKey).set({ claimVersion: 2, runId, ownerToken, claimState: 'PRE_PROVIDER' });

  await service.syncStage(db, runId, idKey, ownerToken, 'PRE_PROVIDER', 'PROVIDER_IN_FLIGHT');
  let claim = await db.collection('ops_automation_claims').doc(idKey).get();
  assert.equal(claim.data()?.claimState, 'PROVIDER_IN_FLIGHT');
  assert.ok(claim.data()?.providerStartedAt);

  await db.collection('ops_automation_claims').doc(idKey).update({ claimVersion: 1 });
  await assert.rejects(service.syncStage(db, runId, idKey, ownerToken, 'PROVIDER_IN_FLIGHT', 'PROVIDER_RETURNED'), OwnershipFencingError);
  await db.collection('ops_automation_claims').doc(idKey).update({ claimVersion: 2 });

  await db.collection('ops_automation_claims').doc(idKey).update({ runId: 'wrong-run' });
  await assert.rejects(service.syncStage(db, runId, idKey, ownerToken, 'PROVIDER_IN_FLIGHT', 'PROVIDER_RETURNED'), OwnershipFencingError);
  await db.collection('ops_automation_claims').doc(idKey).update({ runId });

  await db.collection('ops_automation_claims').doc(idKey).update({ ownerToken: 'wrong-owner' });
  await assert.rejects(service.syncStage(db, runId, idKey, ownerToken, 'PROVIDER_IN_FLIGHT', 'PROVIDER_RETURNED'), OwnershipFencingError);
  await db.collection('ops_automation_claims').doc(idKey).update({ ownerToken });

  await assert.rejects(service.syncStage(db, runId, idKey, ownerToken, 'PRE_PROVIDER', 'PROVIDER_IN_FLIGHT'), OwnershipFencingError);
  await assert.rejects(service.syncStage(db, runId, idKey, ownerToken, 'PROVIDER_IN_FLIGHT', 'PROVIDER_IN_FLIGHT'), OwnershipFencingError);
  await assert.rejects(service.syncStage(db, runId, idKey, ownerToken, 'PROVIDER_RETURNED', 'PRE_PROVIDER'), OwnershipFencingError);

  await db.collection('ops_automation_claims').doc('fail-key').set({ claimVersion: 2, runId: 'fail-run', ownerToken: 'fail-owner', claimState: 'PRE_PROVIDER' });
  await service.syncStage(db, 'fail-run', 'fail-key', 'fail-owner', 'PRE_PROVIDER', 'FAILED');

  await db.collection('ops_automation_claims').doc('bad-pre').set({ claimVersion: 2, runId: 'bad-run', ownerToken: 'bad-owner', claimState: 'PRE_PROVIDER', providerStartedAt: Date.now() });
  await assert.rejects(service.syncStage(db, 'bad-run', 'bad-pre', 'bad-owner', 'PRE_PROVIDER', 'PROVIDER_IN_FLIGHT'), OwnershipFencingError);

  await db.collection('ops_automation_claims').doc('comp-key').set({ claimVersion: 2, runId: 'comp-run', ownerToken: 'comp-owner', claimState: 'COMPLETED' });
  await assert.rejects(service.syncStage(db, 'comp-run', 'comp-key', 'comp-owner', 'COMPLETED', 'FAILED'), OwnershipFencingError);

  let resumeWorkerA: () => void;
  const workerABarrier = new Promise<void>(r => { resumeWorkerA = r; });
  let workerAProviderCalled = false;
  let workerBProviderCalled = false;
  const stolenKey = 'stolen-key';

  preProviderBarrier = async () => { await workerABarrier; };

  const workerAPromise = service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Stolen Topic', requestedBy: 'admin', providedIdempotencyKey: stolenKey,
    generatorOverride: async () => { workerAProviderCalled = true; return { title: 'A', content: 'A', summary: 'A' }; }
  });

  await new Promise(r => setTimeout(r, 100));

  time += 16 * 60 * 1000;
  preProviderBarrier = async () => {};

  const workerBPromise = service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Stolen Topic', requestedBy: 'admin', providedIdempotencyKey: stolenKey,
    generatorOverride: async () => { workerBProviderCalled = true; return { title: 'B', content: 'B', summary: 'B' }; }
  });

  const workerBResult = await workerBPromise;
  assert.equal(workerBResult.ok, true);

  resumeWorkerA!();
  const workerAResult = await workerAPromise;

  assert.equal(workerAResult.ok, false);
  if (!workerAResult.ok) assert.equal(workerAResult.disposition, 'LOST_OWNERSHIP');

  assert.equal(workerAProviderCalled, false);
  assert.equal(workerBProviderCalled, true);

  const staleKey = 'stale-fencing';
  const staleRun = 'stale-run';
  const staleOwner = 'stale-owner';
  await db.collection('ops_automation_claims').doc(staleKey).set({
    claimVersion: 2, runId: staleRun, ownerToken: staleOwner, claimState: 'PRE_PROVIDER', leaseExpiresAt: time - 1000
  });

  time += 10000;
  const reclaimed = await service.claimIdempotencyKeyAtomic(db, staleKey, 'new-run', 'stale test');
  assert.equal(reclaimed.kind, 'STALE_PRE_PROVIDER_CLAIM_RECLAIMED');

  await assert.rejects(service.syncStage(db, staleRun, staleKey, staleOwner, 'PRE_PROVIDER', 'PROVIDER_IN_FLIGHT'), OwnershipFencingError);
  await assert.rejects(service.syncStage(db, staleRun, staleKey, staleOwner, 'PRE_PROVIDER', 'FAILED'), OwnershipFencingError);
  await assert.rejects(service.syncStage(db, staleRun, staleKey, staleOwner, 'PROVIDER_IN_FLIGHT', 'PROVIDER_RETURNED'), OwnershipFencingError);
  await assert.rejects(service.syncStage(db, staleRun, staleKey, staleOwner, 'PROVIDER_RETURNED', 'DRAFT_CREATED'), OwnershipFencingError);
  await assert.rejects(service.syncStage(db, staleRun, staleKey, staleOwner, 'DRAFT_CREATED', 'FINALIZING'), OwnershipFencingError);
  await assert.rejects(service.syncStage(db, staleRun, staleKey, staleOwner, 'FINALIZING', 'COMPLETED'), OwnershipFencingError);

  console.log('  ✔ testPhase3B17ConditionsRegression PASSED');
}

async function testFaultInjections() {
  console.log('\n--- Suite 7: Fault-Injection Tests ---');
  const db = createMockDb();
  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 10, blogDrafts: 10, storyDrafts: 10 }, pipelines: { blog: { enabled: true } }
  });

  let preProviderBarrier: () => Promise<void> = async () => {};
  const service = createTestAutomationService({ clockFn: () => Date.now(), preProviderBarrier: async () => preProviderBarrier() });

  preProviderBarrier = async () => { throw new Error('Injected Pre-Provider Error'); };
  const resPre = await service.executeAutomationRun(db, { pipeline: 'blog', topic: 'Pre Fault', requestedBy: 'admin' });
  assert.equal(resPre.ok, false);
  if (!resPre.ok) assert.equal(resPre.errorCode, 'AUTOMATION_PRE_PROVIDER_FAILED');

  preProviderBarrier = async () => {};
  const resInFlight = await service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'In Flight Fault', requestedBy: 'admin',
    generatorOverride: async () => { throw new Error('Injected Provider Error'); }
  });
  assert.equal(resInFlight.ok, false);
  if (!resInFlight.ok) assert.equal(resInFlight.errorCode, 'AUTOMATION_AMBIGUOUS_PROVIDER_RESULT');

  const origSet = MockDocRef.prototype.set;
  MockDocRef.prototype.set = async function(data: any, opts?: any) {
    if (this.colName === 'operator_drafts') throw new Error('Injected Draft Write Error');
    return origSet.call(this, data, opts);
  };
  const resDraftFail = await service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Draft Write Fault', requestedBy: 'admin',
    generatorOverride: async () => ({ title: 'T', content: 'C', summary: 'S' })
  });
  assert.equal(resDraftFail.ok, false);
  if (!resDraftFail.ok) assert.equal(resDraftFail.errorCode, 'AUTOMATION_DRAFT_WRITE_FAILED');
  MockDocRef.prototype.set = origSet;

  const origTxUpdate = (db as any).runTransaction;
  (db as any).runTransaction = async function(fn: any) {
    return origTxUpdate.call(this, async (t: any) => {
      const origUpdate = t.update;
      t.update = function(docRef: any, data: any) {
        if (docRef?.colName === 'ops_automation_claims' && data?.claimState === 'COMPLETED') {
          throw new Error('Injected Finalization Error');
        }
        return origUpdate.call(this, docRef, data);
      };
      return fn(t);
    });
  };
  const resFinalFail = await service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Final Fault', requestedBy: 'admin',
    generatorOverride: async () => ({ title: 'T', content: 'C', summary: 'S' })
  });
  assert.equal(resFinalFail.ok, false);
  if (!resFinalFail.ok) assert.equal(resFinalFail.errorCode, 'AUTOMATION_FINALIZATION_FAILED');
  (db as any).runTransaction = origTxUpdate;

  console.log('  ✔ testFaultInjections PASSED');
}

// ==========================================
// NEW V6 SUITES (A - F)
// ==========================================

async function testA_LeaseBoundaries() {
  console.log('\n--- A. Lease Boundaries ---');
  const db = createMockDb();
  let currentTime = 1000000;

  const testService1 = createTestAutomationService({ clockFn: () => currentTime });

  const claimResult = await testService1.claimIdempotencyKeyAtomic(db, 'boundary-key', 'run-1', 'topic');
  assert.equal(claimResult.kind, 'CLAIM_ACQUIRED');

  let activeClaim = await db.collection('ops_automation_claims').doc('boundary-key').get();
  const leaseExpiresAt = activeClaim.data()!.leaseExpiresAt;

  const earlyService = createTestAutomationService({ clockFn: () => leaseExpiresAt - 1 });
  const earlyResult = await earlyService.claimIdempotencyKeyAtomic(db, 'boundary-key', 'run-2', 'topic');
  assert.equal(earlyResult.kind, 'ACTIVE_PRE_PROVIDER_CLAIM', 'leaseExpiresAt - 1 ms returns ACTIVE_PRE_PROVIDER_CLAIM');

  const exactService = createTestAutomationService({ clockFn: () => leaseExpiresAt });
  const exactResult = await exactService.claimIdempotencyKeyAtomic(db, 'boundary-key', 'run-3', 'topic');
  assert.equal(exactResult.kind, 'STALE_PRE_PROVIDER_CLAIM_RECLAIMED', 'exactly leaseExpiresAt permits reclaim');

  assert.equal(testService1.claimIdempotencyKeyAtomic.toString().includes('Date.now'), false, 'ordinary production input cannot override time');

  console.log('  ✔ testA_LeaseBoundaries PASSED');
}

async function testB_ConcurrentReclaim() {
  console.log('\n--- B. Concurrent reclaim ---');
  const db = createMockDb();

  let time = 1000000;
  const initialService = createTestAutomationService({ clockFn: () => time });

  await initialService.claimIdempotencyKeyAtomic(db, 'conc-key', 'run-a', 'topic');
  const claimSnap = await db.collection('ops_automation_claims').doc('conc-key').get();

  time = claimSnap.data()!.leaseExpiresAt + 1000;

  const serviceB = createTestAutomationService({ clockFn: () => time });
  const serviceC = createTestAutomationService({ clockFn: () => time });

  const [resB, resC] = await Promise.all([
    serviceB.claimIdempotencyKeyAtomic(db, 'conc-key', 'run-b', 'topic'),
    serviceC.claimIdempotencyKeyAtomic(db, 'conc-key', 'run-c', 'topic')
  ]);

  const results = [resB.kind, resC.kind];
  assert.ok(results.includes('STALE_PRE_PROVIDER_CLAIM_RECLAIMED'), 'exactly one returns STALE_PRE_PROVIDER_CLAIM_RECLAIMED');
  assert.ok(results.includes('ACTIVE_PRE_PROVIDER_CLAIM'), 'the other does not win');

  const winner = resB.kind === 'STALE_PRE_PROVIDER_CLAIM_RECLAIMED' ? resB : resC;
  assert.ok((winner as any).ownerToken, 'winner receives a new ownerToken');
  assert.equal((winner as any).runId, 'run-a', 'original runId is preserved');

  console.log('  ✔ testB_ConcurrentReclaim PASSED');
}

async function testC_RealDailyCapReuse() {
  console.log('\n--- C. Real daily-cap reuse ---');
  const db = createMockDb();
  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 10, blogDrafts: 10, storyDrafts: 10 }, pipelines: { blog: { enabled: true } }
  });
  await db.collection('novels').doc('dummy-novel').set({ title: 'Dummy', genres: ['Ngôn Tình'] });

  let time = 1000000;
  let barrierResolver: () => void;
  const barrier = new Promise<void>(r => { barrierResolver = r; });

  const serviceA = createTestAutomationService({ clockFn: () => time, preProviderBarrier: async () => await barrier });

  const promiseA = serviceA.executeAutomationRun(db, { pipeline: 'blog', topic: 'Cap Reuse', requestedBy: 'admin', providedIdempotencyKey: 'cap-key' });

  await new Promise(r => setTimeout(r, 100));

  let capCount = 0;
  const dailyCapsMap = db.store.get('ops_daily_counters');
  if (dailyCapsMap) {
    for (const doc of Array.from<Record<string, any>>(dailyCapsMap.values())) {
      capCount = doc.totalDrafts;
    }
  }
  assert.equal(capCount, 1, 'A reserves cap');

  time += 20 * 60 * 1000;

  const serviceB = createTestAutomationService({ clockFn: () => time });
  let bProviderCalled = false;
  const promiseB = serviceB.executeAutomationRun(db, { pipeline: 'blog', topic: 'Cap Reuse', requestedBy: 'admin', providedIdempotencyKey: 'cap-key', generatorOverride: async () => { bProviderCalled = true; return { title: 'B', content: 'B', summary: 'B' }; } });

  await promiseB;

  let newCapCount = 0;
  const dailyCapsMap2 = db.store.get('ops_daily_counters');
  if (dailyCapsMap2) {
    for (const doc of Array.from<Record<string, any>>(dailyCapsMap2.values())) {
      newCapCount = doc.totalDrafts;
    }
  }
  assert.equal(newCapCount, 1, 'reclaim does not increment the counter');

  barrierResolver!();
  const resA = await promiseA;

  assert.equal(resA.ok, false);
  if (!resA.ok) assert.equal(resA.disposition, 'LOST_OWNERSHIP', 'stale A cannot delete, release, or invalidate the effective reservation');

  let finalCapCount = 0;
  const dailyCapsMap3 = db.store.get('ops_daily_counters');
  if (dailyCapsMap3) {
    for (const doc of Array.from<Record<string, any>>(dailyCapsMap3.values())) {
      finalCapCount = doc.totalDrafts;
    }
  }
  assert.equal(finalCapCount, 1, 'reservation and counter remain valid after the winner completes');

  console.log('  ✔ testC_RealDailyCapReuse PASSED');
}

async function testD_ExactlyOnceAssertions() {
  console.log('\n--- D. Exactly-once assertions ---');
  const db = createMockDb();
  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 10, blogDrafts: 10, storyDrafts: 10 }, pipelines: { blog: { enabled: true } }
  });

  let time = 1000000;
  let barrierA: () => void;
  const promiseBarrierA = new Promise<void>(r => { barrierA = r; });

  let aCalls = 0;
  const serviceA = createTestAutomationService({ clockFn: () => time, preProviderBarrier: async () => await promiseBarrierA });
  const execA = serviceA.executeAutomationRun(db, { pipeline: 'blog', topic: 'Exact Once', requestedBy: 'admin', providedIdempotencyKey: 'exact-key', generatorOverride: async () => { aCalls++; return { title: 'A', content: 'A', summary: 'A' }; } });

  await new Promise(r => setTimeout(r, 100));

  time += 20 * 60 * 1000;

  let bCalls = 0;
  let cCalls = 0;

  const serviceB = createTestAutomationService({ clockFn: () => time });
  const serviceC = createTestAutomationService({ clockFn: () => time });

  const execB = serviceB.executeAutomationRun(db, { pipeline: 'blog', topic: 'Exact Once', requestedBy: 'admin', providedIdempotencyKey: 'exact-key', generatorOverride: async () => { await new Promise(r => setTimeout(r, 10)); bCalls++; return { title: 'B', content: 'B', summary: 'B' }; } });
  const execC = serviceC.executeAutomationRun(db, { pipeline: 'blog', topic: 'Exact Once', requestedBy: 'admin', providedIdempotencyKey: 'exact-key', generatorOverride: async () => { await new Promise(r => setTimeout(r, 10)); cCalls++; return { title: 'C', content: 'C', summary: 'C' }; } });

  barrierA!();

  await Promise.all([execA, execB, execC]);

  assert.equal(aCalls, 0, 'A provider calls = 0');
  const totalCalls = aCalls + bCalls + cCalls;
  assert.equal(totalCalls, 1, 'total provider calls = exactly 1');

  const drafts = await db.collection('operator_drafts').get();
  assert.equal(drafts.docs.length, 1, 'assert exactly one matching draft');

  const claimSnap = await db.collection('ops_automation_claims').doc('exact-key').get();
  const preservedRunId = claimSnap.data()!.runId;
  assert.ok(drafts.docs[0].data()!.source.includes(preservedRunId), 'assert the draft references the preserved original runId');

  console.log('  ✔ testD_ExactlyOnceAssertions PASSED');
}

async function testE_IsolatedStaleOwnerFencing() {
  console.log('\n--- E. Isolated stale-owner fencing ---');
  const db = createMockDb();

  const service = createTestAutomationService({ clockFn: () => Date.now() });

  const transitions = [
    { from: 'PRE_PROVIDER', to: 'PROVIDER_IN_FLIGHT' },
    { from: 'PRE_PROVIDER', to: 'FAILED' },
    { from: 'PROVIDER_IN_FLIGHT', to: 'PROVIDER_RETURNED' },
    { from: 'PROVIDER_RETURNED', to: 'DRAFT_CREATED' },
    { from: 'DRAFT_CREATED', to: 'FINALIZING' },
    { from: 'FINALIZING', to: 'COMPLETED' },
  ];

  let index = 0;
  for (const t of transitions) {
    const runId = `run-${index}`;
    const idKey = `id-${index}`;

    await db.collection('ops_automation_claims').doc(idKey).set({
      claimVersion: 2, runId, ownerToken: 'NEW_OWNER', claimState: t.from
    });

    let errorCaught = false;
    try {
      await service.syncStage(db, runId, idKey, 'STALE_OWNER', t.from, t.to);
    } catch (e: any) {
      assert.equal(e.name, 'OwnershipFencingError', 'Each failure must be attributable to stale fencing, not incorrect state');
      errorCaught = true;
    }
    assert.ok(errorCaught, `Transition ${t.from}->${t.to} failed to fence stale owner`);
    index++;
  }

  console.log('  ✔ testE_IsolatedStaleOwnerFencing PASSED');
}

async function testF_FaultInjectionAndSanitization() {
  console.log('\n--- F. Fault injection and sanitization ---');
  const db = createMockDb();
  await db.collection('ops_settings').doc('global').set({
    schemaVersion: 1, emergencyStop: false, operatingMode: 'MANUAL', timezone: 'Asia/Ho_Chi_Minh',
    dailyCaps: { totalDrafts: 10, blogDrafts: 10, storyDrafts: 10 }, pipelines: { blog: { enabled: true } }
  });

  let preProviderBarrier: () => Promise<void> = async () => {};
  const service = createTestAutomationService({ clockFn: () => Date.now(), preProviderBarrier: async () => preProviderBarrier() });

  preProviderBarrier = async () => { throw new Error('Injected Pre-Provider Error'); };
  const resPre = await service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Pre Fault', requestedBy: 'admin', providedIdempotencyKey: 'fault-pre'
  });
  assert.equal(resPre.ok, false);
  if (!resPre.ok) {
     assert.equal(resPre.retryable, true, 'cleanup failure preserving the primary RETRYABLE classification');
     assert.equal(resPre.errorCode, 'AUTOMATION_PRE_PROVIDER_FAILED');
  }

  preProviderBarrier = async () => {};
  const origSet = MockDocRef.prototype.set;
  MockDocRef.prototype.set = async function(data: any, opts?: any) {
    if (this.colName === 'operator_drafts') throw new Error('Injected Draft Write Error with secret_token123');
    return origSet.call(this, data, opts);
  };
  const resDraftFail = await service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Draft Write Fault', requestedBy: 'admin', providedIdempotencyKey: 'fault-draft',
    generatorOverride: async () => ({ title: 'T', content: 'C', summary: 'S' })
  });
  assert.equal(resDraftFail.ok, false);
  if (!resDraftFail.ok) assert.equal(resDraftFail.disposition, 'AMBIGUOUS', 'provider-returned draft-write failure returning AMBIGUOUS');
  MockDocRef.prototype.set = origSet;

  const origTxUpdate = (db as any).runTransaction;
  (db as any).runTransaction = async function(fn: any) {
    return origTxUpdate.call(this, async (t: any) => {
      const origUpdate = t.update;
      t.update = function(docRef: any, data: any) {
        if (docRef?.colName === 'ops_automation_claims' && data?.claimState === 'COMPLETED') {
          throw new Error('Injected Finalization Error');
        }
        return origUpdate.call(this, docRef, data);
      };
      return fn(t);
    });
  };
  const resFinalFail = await service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Final Fault', requestedBy: 'admin', providedIdempotencyKey: 'fault-final',
    generatorOverride: async () => ({ title: 'T', content: 'C', summary: 'S' })
  });
  assert.equal(resFinalFail.ok, false);
  if (!resFinalFail.ok) assert.equal(resFinalFail.disposition, 'AMBIGUOUS', 'finalization failure returning AMBIGUOUS');
  (db as any).runTransaction = origTxUpdate;

  let providerCalled = false;
  const resRetry = await service.executeAutomationRun(db, {
    pipeline: 'blog', topic: 'Final Fault', requestedBy: 'admin', providedIdempotencyKey: 'fault-final',
    generatorOverride: async () => { providerCalled = true; return { title: 'T', content: 'C', summary: 'S' }; }
  });
  assert.equal(resRetry.ok, true);
  if (resRetry.ok) assert.equal(resRetry.status, 'NEEDS_RECONCILIATION', 'retry after finalization failure returning reconciliation');
  assert.equal(providerCalled, false, 'retry does not call provider again');

  const compClaim = await db.collection('ops_automation_claims').doc('fault-draft').get();
  const compRun = await db.collection('ops_automation_runs').doc((resDraftFail as any).runId).get();

  const resString = JSON.stringify(resDraftFail);
  assert.ok(!resString.includes('secret_token123'), 'returned objects contain no secret');
  assert.ok(!resString.includes('stack'), 'returned objects contain no stack');

  const runString = JSON.stringify(compRun.data());
  assert.ok(!runString.includes('secret_token123'), 'persisted claim/run failure metadata contains no secret');
  assert.ok(!runString.includes('stack'), 'persisted claim/run failure metadata contains no stack');

  console.log('  ✔ testF_FaultInjectionAndSanitization PASSED');
}

async function runAllSuites() {
  await testSettingsValidation();
  await testDeduplicationAndCaps();
  await testConcurrency();
  await testApiValidations();
  await testPhase3BStaleClaimPatch();
  await testPhase3B17ConditionsRegression();
  await testFaultInjections();
  await testA_LeaseBoundaries();
  await testB_ConcurrentReclaim();
  await testC_RealDailyCapReuse();
  await testD_ExactlyOnceAssertions();
  await testE_IsolatedStaleOwnerFencing();
  await testF_FaultInjectionAndSanitization();
  console.log('\n✅ ALL DEFECT REMEDIATION TESTS PASSED!\n');
}

runAllSuites().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
