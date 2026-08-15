import assert from 'node:assert/strict';
import { FieldValue } from 'firebase-admin/firestore';
import { QUEUE_CONFIG, enqueueJob, generateJobId, acquireLease, heartbeatLease, completeJob, failJob, buildRetryDiscoveryQuery, buildExpiredLeaseDiscoveryQuery } from '../../src/lib/automation/queueService';
import * as fs from 'node:fs';
import * as path from 'node:path';

class MockDocSnapshot {
  constructor(public readonly id: string, private _exists: boolean, private _data: Record<string, any> | undefined) {}
  get exists(): boolean { return this._exists; }
  data(): Record<string, any> { return this._data ? { ...this._data } : {} as any; }
}

class MockDocRef {
  constructor(private store: Map<string, Map<string, Record<string, any>>>, public colName: string, public id: string) {}
  async get(): Promise<MockDocSnapshot> {
    const col = this.store.get(this.colName);
    const data = col?.get(this.id);
    return new MockDocSnapshot(this.id, !!data, data);
  }
  async create(data: Record<string, any>): Promise<void> {
    let col = this.store.get(this.colName);
    if (!col) { col = new Map(); this.store.set(this.colName, col); }
    if (col.has(this.id)) {
      const err = new Error('ALREADY_EXISTS');
      (err as any).code = 6;
      throw err;
    }
    col.set(this.id, { ...data });
  }
  async update(data: Record<string, any>): Promise<void> {
    const col = this.store.get(this.colName);
    if (!col || !col.has(this.id)) throw new Error('NOT_FOUND');
    const existing = col.get(this.id)!;
    const newData = { ...existing };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && typeof (v as any).isEqual === 'function') {
        const isDelete = (v as any).isEqual(FieldValue.delete());
        if (isDelete) {
          delete newData[k];
          continue;
        }
      }
      newData[k] = v;
    }
    col.set(this.id, newData);
  }
}

class MockQuery {
  _where: any[] = [];
  _orderBy: any[] = [];
  _limit: number = 0;

  where(field: string, op: string, val: any) {
    this._where.push({field, op, val});
    return this;
  }
  orderBy(field: string, dir: string) {
    this._orderBy.push({field, dir});
    return this;
  }
  limit(num: number) {
    this._limit = num;
    return this;
  }
}

class MockFirestore {
  store = new Map<string, Map<string, Record<string, any>>>();
  private lock = Promise.resolve();

  collection(colName: string) {
    const mq = new MockQuery();
    const docFn = (id: string) => new MockDocRef(this.store, colName, id);
    return Object.assign(mq, { doc: docFn });
  }

  async runTransaction(updateFunction: (t: any) => Promise<any>): Promise<any> {
    let releaseLock: () => void;
    const acquireLock = new Promise<void>(resolve => releaseLock = resolve);
    const prevLock = this.lock;
    this.lock = this.lock.then(() => acquireLock);
    await prevLock;

    try {
      const t = {
        get: async (ref: any) => ref.get(),
        update: (ref: any, data: any) => { ref.update(data); },
      };
      return await updateFunction(t);
    } finally {
      releaseLock!();
    }
  }
}

let mockTime = new Date('2026-07-26T00:00:00.000Z');
let mockTokenCounter = 1;
const deps = {
  db: new MockFirestore(),
  now: () => mockTime,
  generateToken: () => `token-${mockTokenCounter++}`
};

async function runTests() {
  console.log('▶ Running Phase 3C Queue Tests...');

  console.log('Test: deterministic blog and story job IDs');
  const blogId = generateJobId('blog', '20260726_0800');
  const storyId = generateJobId('story', '20260726_0800');
  assert.ok(blogId.includes('blog'));
  assert.ok(storyId.includes('story'));
  assert.notEqual(blogId, storyId);

  console.log('Test: canonical scheduled slot validation');
  assert.throws(() => generateJobId('invalid', '20260726_0800'), /INVALID_PIPELINE/);
  assert.throws(() => generateJobId('blog', '20260726/0800'), /INVALID_SCHEDULED_SLOT/);
  assert.throws(() => generateJobId('blog', '../20260726'), /INVALID_SCHEDULED_SLOT/);
  assert.throws(() => generateJobId('blog', ''), /INVALID_SCHEDULED_SLOT/);
  assert.throws(() => generateJobId('blog', '20260230_0800'), /INVALID_SCHEDULED_SLOT/);
  assert.throws(() => generateJobId('blog', '20261301_0800'), /INVALID_SCHEDULED_SLOT/);
  assert.throws(() => generateJobId('blog', '20260726_2400'), /INVALID_SCHEDULED_SLOT/);
  assert.throws(() => generateJobId('blog', '20260726_1260'), /INVALID_SCHEDULED_SLOT/);
  assert.throws(() => generateJobId('blog', '20269999_9999'), /INVALID_SCHEDULED_SLOT/);

  console.log('Test: enqueueJob validates input');
  const enqInv = await enqueueJob(deps, 'hacker', '1234');
  assert.equal(enqInv.ok, false);
  assert.equal(enqInv.status, 'INVALID_PIPELINE');

  console.log('Test: first enqueue succeeds');
  const enq1 = await enqueueJob(deps, 'blog', '20260726_0800');
  assert.equal(enq1.ok, true);
  assert.equal(enq1.status, 'CREATED');
  const j1 = generateJobId('blog', '20260726_0800');

  console.log('Test: duplicate enqueue is idempotent and preserves the existing document');
  const enq2 = await enqueueJob(deps, 'blog', '20260726_0800');
  assert.equal(enq2.ok, true);
  assert.equal(enq2.status, 'ALREADY_EXISTS');

  const data = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.equal(data.status, 'PENDING');
  assert.equal(data.attempt, 0);

  console.log('Test: PENDING lease acquisition');
  const acq1 = await acquireLease(deps, j1);
  assert.equal(acq1.ok, true);
  assert.equal(acq1.leaseGeneration, 1);
  assert.ok(acq1.ownerToken);

  console.log('Test: proof each successful claim increments exactly once');
  let doc = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.equal(doc.status, 'IN_PROGRESS');
  assert.equal(doc.attempt, 1);
  assert.equal(doc.ownerToken, acq1.ownerToken);
  assert.ok(!doc.nextAttemptAt);

  console.log('Test: unexpired IN_PROGRESS lease is rejected');
  const acq2 = await acquireLease(deps, j1);
  assert.equal(acq2.ok, false);
  assert.equal(acq2.reason, 'LEASE_ACTIVE');

  console.log('Test: concurrent acquireLease calls yield exactly one winner');
  await enqueueJob(deps, 'blog', '20260726_0809');
  const jConc = generateJobId('blog', '20260726_0809');
  const [conc1, conc2] = await Promise.all([
    acquireLease(deps, jConc),
    acquireLease(deps, jConc)
  ]);
  const winner = conc1.ok ? conc1 : conc2;
  const loser = conc1.ok ? conc2 : conc1;
  assert.equal(winner.ok, true);
  assert.equal(loser.ok, false);
  assert.equal(loser.reason, 'LEASE_ACTIVE');

  const concDoc = (await deps.db.collection('ops_automation_jobs').doc(jConc).get()).data();
  assert.equal(concDoc.attempt, 1);
  assert.equal(concDoc.leaseGeneration, 1);
  assert.equal(concDoc.ownerToken, winner.ownerToken!);

  console.log('Test: heartbeat extends a valid lease');
  const prevExpires = doc.leaseExpiresAt;
  mockTime = new Date(mockTime.getTime() + 11 * 60000);
  const hb1 = await heartbeatLease(deps, j1, acq1.ownerToken!, acq1.leaseGeneration!);
  assert.equal(hb1.ok, true);
  doc = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.ok(new Date(doc.leaseExpiresAt).getTime() > new Date(prevExpires).getTime());

  console.log('Test: heartbeat never shortens an existing lease');
  await enqueueJob(deps, 'blog', '20260726_0801');
  const jShorten = generateJobId('blog', '20260726_0801');
  const aShorten = await acquireLease(deps, jShorten);
  const docBeforeHb = (await deps.db.collection('ops_automation_jobs').doc(jShorten).get()).data();
  mockTime = new Date(mockTime.getTime() + 60000);
  await heartbeatLease(deps, jShorten, aShorten.ownerToken!, aShorten.leaseGeneration!);
  const docAfterHb = (await deps.db.collection('ops_automation_jobs').doc(jShorten).get()).data();
  assert.equal(new Date(docAfterHb.leaseExpiresAt).getTime(), new Date(docBeforeHb.leaseExpiresAt).getTime());

  console.log('Test: expired lease prevents mutation even with correct token');
  await enqueueJob(deps, 'blog', '20260726_0802');
  const jExpTest = generateJobId('blog', '20260726_0802');
  const aExp = await acquireLease(deps, jExpTest);

  // Advance time past the lease
  mockTime = new Date(mockTime.getTime() + 15 * 60000 + 1000); // 15m + 1s

  // Explicit proof that expired owner cannot heartbeat, complete, or fail (retry / terminal)
  const expHb = await heartbeatLease(deps, jExpTest, aExp.ownerToken!, aExp.leaseGeneration!);
  assert.equal(expHb.ok, false);
  assert.equal(expHb.reason, 'LEASE_EXPIRED');

  const expComp = await completeJob(deps, jExpTest, aExp.ownerToken!, aExp.leaseGeneration!, 'SUCCESS');
  assert.equal(expComp.ok, false);
  assert.equal(expComp.reason, 'LEASE_EXPIRED');

  // Fail -> schedule a retry
  const expFail = await failJob(deps, jExpTest, aExp.ownerToken!, aExp.leaseGeneration!, 'TIMEOUT');
  assert.equal(expFail.ok, false);
  assert.equal(expFail.reason, 'LEASE_EXPIRED');

  // Let's forcefully set it to attempt 3 so it would otherwise be a FAILED_TERMINAL, to prove it fails that too
  await deps.db.collection('ops_automation_jobs').doc(jExpTest).update({ attempt: 3 });
  const expFailTerm = await failJob(deps, jExpTest, aExp.ownerToken!, aExp.leaseGeneration!, 'TIMEOUT');
  assert.equal(expFailTerm.ok, false);
  assert.equal(expFailTerm.reason, 'LEASE_EXPIRED');

  // The state remains untouched by the expired owner (mutations blocked)
  const docExpUnchanged = (await deps.db.collection('ops_automation_jobs').doc(jExpTest).get()).data();
  assert.equal(docExpUnchanged.status, 'IN_PROGRESS');
  assert.ok(docExpUnchanged.ownerToken === aExp.ownerToken); // Still present, unmutated
  assert.ok(!docExpUnchanged.lastErrorCode);

  console.log('Test: heartbeat with correct token but stale generation fails');
  const hbGenStale = await heartbeatLease(deps, j1, acq1.ownerToken!, 999);
  assert.equal(hbGenStale.ok, false);
  assert.equal(hbGenStale.reason, 'FENCED');

  console.log('Test: heartbeat with stale token but correct generation fails');
  const hbTokStale = await heartbeatLease(deps, j1, 'stale-token', acq1.leaseGeneration!);
  assert.equal(hbTokStale.ok, false);
  assert.equal(hbTokStale.reason, 'FENCED');

  console.log('Test: expired IN_PROGRESS lease is recovered');
  mockTime = new Date(new Date(doc.leaseExpiresAt).getTime() + 1000);
  const acq3 = await acquireLease(deps, j1);
  assert.equal(acq3.ok, true);
  assert.equal(acq3.leaseGeneration, 2);
  assert.ok(acq3.ownerToken !== acq1.ownerToken);

  doc = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.equal(doc.attempt, 2);

  console.log('Test: recovered lease fence previous owner');
  const docBeforeFence = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  const compFencePrev = await completeJob(deps, j1, acq1.ownerToken!, acq1.leaseGeneration!, 'SUCCESS');
  assert.equal(compFencePrev.ok, false);
  assert.equal(compFencePrev.reason, 'FENCED');
  const docAfterFence = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.deepEqual(docAfterFence, docBeforeFence);

  console.log('Test: completion with correct token but stale generation fails');
  const compStaleGen = await completeJob(deps, j1, acq3.ownerToken!, 1, 'SUCCESS');
  assert.equal(compStaleGen.ok, false);
  assert.equal(compStaleGen.reason, 'FENCED');

  console.log('Test: completion with stale token but correct generation fails');
  const compStaleTok = await completeJob(deps, j1, 'stale-token', acq3.leaseGeneration!, 'SUCCESS');
  assert.equal(compStaleTok.ok, false);
  assert.equal(compStaleTok.reason, 'FENCED');

  console.log('Test: failJob with correct token but stale generation fails');
  const failStaleGen = await failJob(deps, j1, acq3.ownerToken!, 1, 'TEST_ERROR');
  assert.equal(failStaleGen.ok, false);
  assert.equal(failStaleGen.reason, 'FENCED');

  console.log('Test: failJob with stale token but correct generation fails');
  const failStaleTok = await failJob(deps, j1, 'stale-token', acq3.leaseGeneration!, 'TEST_ERROR');
  assert.equal(failStaleTok.ok, false);
  assert.equal(failStaleTok.reason, 'FENCED');

  console.log('Test: attempt-one and attempt-two failures use exact backoff values');
  const fail1 = await failJob(deps, j1, acq3.ownerToken!, acq3.leaseGeneration!, 'TEST_ERROR');
  assert.equal(fail1.ok, true);

  doc = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.equal(doc.status, 'RETRY_WAIT');

  console.log('Test: retry and terminal failure clear all active lease fields');
  assert.ok(!doc.ownerToken);
  assert.ok(!doc.leaseExpiresAt);
  assert.ok(!doc.heartbeatAt);

  assert.equal(new Date(doc.nextAttemptAt).getTime(), mockTime.getTime() + 15 * 60000);

  // prove attempt 1 failure -> +5m
  await enqueueJob(deps, 'blog', '20260726_0805');
  const jA1 = generateJobId('blog', '20260726_0805');
  const aA1 = await acquireLease(deps, jA1);
  const timeA1 = mockTime.getTime();
  await failJob(deps, jA1, aA1.ownerToken!, aA1.leaseGeneration!, 'ERR');
  const docA1 = (await deps.db.collection('ops_automation_jobs').doc(jA1).get()).data();
  assert.equal(new Date(docA1.nextAttemptAt).getTime(), timeA1 + 5 * 60000);

  console.log('Test: RETRY_WAIT before nextAttemptAt is rejected');
  const acqEarly = await acquireLease(deps, j1);
  assert.equal(acqEarly.ok, false);
  assert.equal(acqEarly.reason, 'NOT_DUE');

  console.log('Test: RETRY_WAIT after nextAttemptAt is acquired');
  mockTime = new Date(mockTime.getTime() + 15 * 60000 + 1000);
  const acq4 = await acquireLease(deps, j1);
  assert.equal(acq4.ok, true);
  assert.equal(acq4.leaseGeneration, 3);
  doc = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.equal(doc.attempt, 3);

  console.log('Test: third-attempt failure becomes FAILED_TERMINAL');
  const fail2 = await failJob(deps, j1, acq4.ownerToken!, acq4.leaseGeneration!, 'TIMEOUT');
  assert.equal(fail2.ok, true);

  doc = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.equal(doc.status, 'FAILED_TERMINAL');
  assert.ok(!doc.nextAttemptAt);
  assert.ok(!doc.ownerToken);
  assert.ok(!doc.heartbeatAt);
  assert.ok(!doc.leaseExpiresAt);

  console.log('Test: terminal jobs cannot be reacquired');
  const docBeforeTerminal = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.equal(docBeforeTerminal.status, 'FAILED_TERMINAL');

  const acqTerm = await acquireLease(deps, j1);
  assert.equal(acqTerm.ok, false);
  assert.equal(acqTerm.reason, 'TERMINAL_STATE');

  const hbTermReacquire = await heartbeatLease(deps, j1, 'tok', 1);
  assert.equal(hbTermReacquire.ok, false);
  assert.equal(hbTermReacquire.reason, 'NOT_IN_PROGRESS');

  const compTerm = await completeJob(deps, j1, 'tok', 1, 'SUCCESS');
  assert.equal(compTerm.ok, false);
  assert.equal(compTerm.reason, 'NOT_IN_PROGRESS');

  const failTerm = await failJob(deps, j1, 'tok', 1, 'ERR');
  assert.equal(failTerm.ok, false);
  assert.equal(failTerm.reason, 'NOT_IN_PROGRESS');

  const docAfterTerminal = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  assert.deepEqual(docAfterTerminal, docBeforeTerminal);

  console.log('Test: proof expired attempt 3 becomes FAILED_TERMINAL transactionally');
  await enqueueJob(deps, 'blog', '20260726_0806');
  const j2 = generateJobId('blog', '20260726_0806');
  const al1 = await acquireLease(deps, j2);
  await failJob(deps, j2, al1.ownerToken!, al1.leaseGeneration!, 'TIMEOUT');
  mockTime = new Date(mockTime.getTime() + 5 * 60000 + 1000);
  const al2 = await acquireLease(deps, j2);
  await failJob(deps, j2, al2.ownerToken!, al2.leaseGeneration!, 'TIMEOUT');
  mockTime = new Date(mockTime.getTime() + 15 * 60000 + 1000);
  const al3 = await acquireLease(deps, j2);
  assert.equal(al3.ok, true);
  const docJ2 = (await deps.db.collection('ops_automation_jobs').doc(j2).get()).data();
  assert.equal(docJ2.attempt, 3);

  mockTime = new Date(new Date(docJ2.leaseExpiresAt).getTime() + 1000);
  const acqExp2 = await acquireLease(deps, j2);
  assert.equal(acqExp2.ok, false);
  assert.equal(acqExp2.reason, 'MAX_ATTEMPTS_EXCEEDED');
  const docJ2After = (await deps.db.collection('ops_automation_jobs').doc(j2).get()).data();
  assert.equal(docJ2After.status, 'FAILED_TERMINAL');
  assert.equal(docJ2After.lastErrorCode, 'MAX_ATTEMPTS_EXHAUSTED');
  assert.ok(!docJ2After.ownerToken);
  assert.ok(!docJ2After.leaseExpiresAt);
  assert.ok(!docJ2After.heartbeatAt);
  assert.ok(!docJ2After.nextAttemptAt);

  console.log('Test: arbitrary sensitive error strings cannot be persisted or logged');
  let slotMin = 10;

  const unsafeValues = [
    'Bearer secret_token_123',
    'api_key=XYZ123',
    'https://example.com/secret?token=abc',
    '{"error":"true","data":"sensitive_body"}',
    'Failed to connect to db at 10.0.0.1'
  ];

  for (const unsafe of unsafeValues) {
    const slotStr = `20260726_09${slotMin.toString().padStart(2, '0')}`;
    const jSafeFail = generateJobId('blog', slotStr);

    // Setup capture
    let loggedOutput = '';
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalDebug = console.debug;
    console.log = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.error = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.warn = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.info = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.debug = (...args) => { loggedOutput += args.join(' ') + '\n'; };

    try {
      const enq = await enqueueJob(deps, 'blog', slotStr);
      assert.equal(enq.ok, true);
      assert.equal(enq.status, 'CREATED');
      const aSafeFail = await acquireLease(deps, jSafeFail);
      assert.equal(aSafeFail.ok, true);
      const f = await failJob(deps, jSafeFail, aSafeFail.ownerToken!, aSafeFail.leaseGeneration!, unsafe);
      assert.equal(f.ok, true);

      const docFail = (await deps.db.collection('ops_automation_jobs').doc(jSafeFail).get()).data();
      assert.equal(docFail.status, 'RETRY_WAIT');
      assert.equal(docFail.lastErrorCode, 'UNKNOWN_EXECUTION_FAILURE');
      assert.ok(JSON.stringify(docFail).indexOf(unsafe) === -1);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      console.debug = originalDebug;
    }
    assert.ok(loggedOutput.indexOf(unsafe) === -1, 'Sensitive value found in captured log');
    slotMin++;
  }

  console.log('Test: completion normalizes unsafe resultCode');
  for (const unsafe of unsafeValues) {
    const slotStr = `20260726_09${slotMin.toString().padStart(2, '0')}`;
    const jSafeComp = generateJobId('blog', slotStr);

    let loggedOutput = '';
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalDebug = console.debug;
    console.log = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.error = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.warn = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.info = (...args) => { loggedOutput += args.join(' ') + '\n'; };
    console.debug = (...args) => { loggedOutput += args.join(' ') + '\n'; };

    try {
      const enq = await enqueueJob(deps, 'blog', slotStr);
      assert.equal(enq.ok, true);
      assert.equal(enq.status, 'CREATED');
      const aSafeComp = await acquireLease(deps, jSafeComp);
      assert.equal(aSafeComp.ok, true);
      const c = await completeJob(deps, jSafeComp, aSafeComp.ownerToken!, aSafeComp.leaseGeneration!, unsafe);
      assert.equal(c.ok, true);

      const docComp = (await deps.db.collection('ops_automation_jobs').doc(jSafeComp).get()).data();
      assert.equal(docComp.status, 'COMPLETED');
      assert.equal(docComp.resultCode, 'UNKNOWN_EXECUTION_RESULT');
      assert.ok(JSON.stringify(docComp).indexOf(unsafe) === -1);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
      console.debug = originalDebug;
    }
    assert.ok(loggedOutput.indexOf(unsafe) === -1, 'Sensitive value found in captured log');
    slotMin++;
  }

  console.log('Test: duplicate completion is rejected and does not mutate document');
  const docJ3Before = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data(); // j1 is FAILED_TERMINAL
  // Let's create a completed job to test COMPLETED immutability
  await enqueueJob(deps, 'blog', '20260726_1000');
  const jCompTest = generateJobId('blog', '20260726_1000');
  const acqCompTest = await acquireLease(deps, jCompTest);
  await completeJob(deps, jCompTest, acqCompTest.ownerToken!, acqCompTest.leaseGeneration!, 'SUCCESS');
  const docCompTestBefore = (await deps.db.collection('ops_automation_jobs').doc(jCompTest).get()).data();

  // Test immutability for COMPLETED
  const dupComp = await completeJob(deps, jCompTest, acqCompTest.ownerToken!, acqCompTest.leaseGeneration!, 'SUCCESS');
  assert.equal(dupComp.ok, false);
  assert.equal(dupComp.reason, 'NOT_IN_PROGRESS');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jCompTest).get()).data(), docCompTestBefore);

  const hbComp = await heartbeatLease(deps, jCompTest, acqCompTest.ownerToken!, acqCompTest.leaseGeneration!);
  assert.equal(hbComp.ok, false);
  assert.equal(hbComp.reason, 'NOT_IN_PROGRESS');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jCompTest).get()).data(), docCompTestBefore);

  const failComp = await failJob(deps, jCompTest, acqCompTest.ownerToken!, acqCompTest.leaseGeneration!, 'TIMEOUT');
  assert.equal(failComp.ok, false);
  assert.equal(failComp.reason, 'NOT_IN_PROGRESS');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jCompTest).get()).data(), docCompTestBefore);

  const acqComp = await acquireLease(deps, jCompTest);
  assert.equal(acqComp.ok, false);
  assert.equal(acqComp.reason, 'TERMINAL_STATE');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jCompTest).get()).data(), docCompTestBefore);

  // Test immutability for FAILED_TERMINAL (using j1 from earlier)
  const docTermBefore = (await deps.db.collection('ops_automation_jobs').doc(j1).get()).data();
  const dupCompTerm = await completeJob(deps, j1, 'tok', 1, 'SUCCESS');
  assert.equal(dupCompTerm.ok, false);
  assert.equal(dupCompTerm.reason, 'NOT_IN_PROGRESS');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(j1).get()).data(), docTermBefore);

  const hbTerm2 = await heartbeatLease(deps, j1, 'tok', 1);
  assert.equal(hbTerm2.ok, false);
  assert.equal(hbTerm2.reason, 'NOT_IN_PROGRESS');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(j1).get()).data(), docTermBefore);

  const failTerm3 = await failJob(deps, j1, 'tok', 1, 'TIMEOUT');
  assert.equal(failTerm3.ok, false);
  assert.equal(failTerm3.reason, 'NOT_IN_PROGRESS');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(j1).get()).data(), docTermBefore);

  const acqTerm3 = await acquireLease(deps, j1);
  assert.equal(acqTerm3.ok, false);
  assert.equal(acqTerm3.reason, 'TERMINAL_STATE');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(j1).get()).data(), docTermBefore);


  console.log('Test: COMPLETE MALFORMED-STATE MATRIX for all 4 functions');
  await enqueueJob(deps, 'blog', '20260726_0808');
  const jMal = generateJobId('blog', '20260726_0808');
  const aMal = await acquireLease(deps, jMal);

  const testMatrix = async (docUpdates: any) => {
    await deps.db.collection('ops_automation_jobs').doc(jMal).update(docUpdates);
    const docBefore = (await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data();

    assert.equal((await acquireLease(deps, jMal)).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docBefore);

    assert.equal((await heartbeatLease(deps, jMal, aMal.ownerToken!, aMal.leaseGeneration!)).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docBefore);

    assert.equal((await completeJob(deps, jMal, aMal.ownerToken!, aMal.leaseGeneration!, 'SUCCESS')).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docBefore);

    assert.equal((await failJob(deps, jMal, aMal.ownerToken!, aMal.leaseGeneration!, 'ERR')).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docBefore);
  };

  // Unsupported schema version
  await deps.db.collection('ops_automation_jobs').doc(jMal).update({ schemaVersion: 2 });
  const docSchemaBefore = (await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data();
  assert.equal((await acquireLease(deps, jMal)).reason, 'UNSUPPORTED_SCHEMA');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docSchemaBefore);

  assert.equal((await heartbeatLease(deps, jMal, aMal.ownerToken!, aMal.leaseGeneration!)).reason, 'UNSUPPORTED_SCHEMA');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docSchemaBefore);

  assert.equal((await completeJob(deps, jMal, aMal.ownerToken!, aMal.leaseGeneration!, 'SUCCESS')).reason, 'UNSUPPORTED_SCHEMA');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docSchemaBefore);

  assert.equal((await failJob(deps, jMal, aMal.ownerToken!, aMal.leaseGeneration!, 'ERR')).reason, 'UNSUPPORTED_SCHEMA');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docSchemaBefore);

  const docAfterSchema = (await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data();
  assert.equal(docAfterSchema.schemaVersion, 2);
  await deps.db.collection('ops_automation_jobs').doc(jMal).update({ schemaVersion: 1 });

  // Missing attempt
  await testMatrix({ schemaVersion: 1, status: 'IN_PROGRESS', ownerToken: aMal.ownerToken, leaseGeneration: aMal.leaseGeneration, leaseExpiresAt: new Date(mockTime.getTime() + 99999).toISOString(), attempt: FieldValue.delete() });
  // NaN attempt
  await testMatrix({ attempt: NaN });
  // Infinity attempt
  await testMatrix({ attempt: Infinity });
  // Negative attempt
  await testMatrix({ attempt: -1 });
  // Fractional attempt
  await testMatrix({ attempt: 1.5 });

  // missing leaseGeneration
  await testMatrix({ attempt: 1, leaseGeneration: FieldValue.delete() });
  // string leaseGeneration
  await testMatrix({ leaseGeneration: '1' });
  // NaN leaseGeneration
  await testMatrix({ leaseGeneration: NaN });
  // Infinity leaseGeneration
  await testMatrix({ leaseGeneration: Infinity });
  // Negative leaseGeneration
  await testMatrix({ leaseGeneration: -1 });
  // Fractional leaseGeneration
  await testMatrix({ leaseGeneration: 1.5 });

  // missing leaseExpiresAt
  await testMatrix({ leaseGeneration: 1, leaseExpiresAt: FieldValue.delete() });
  // non-canonical leaseExpiresAt
  await testMatrix({ leaseExpiresAt: new Date(mockTime.getTime() + 99999).toISOString().replace('Z', '.000Z') });
  await testMatrix({ leaseExpiresAt: '2026-07-26T00:00:00Z' }); // missing ms
  await testMatrix({ leaseExpiresAt: '2026-07-26T00:00:00.000Z ' }); // space
  // invalid leaseExpiresAt
  await testMatrix({ leaseExpiresAt: 'not-a-date' });

  // Missing status
  await testMatrix({ attempt: 1, leaseGeneration: 1, leaseExpiresAt: new Date(mockTime.getTime() + 99999).toISOString(), status: FieldValue.delete() });
  // Unknown status
  await testMatrix({ status: 'WEIRD_STATE' });
  // Malformed status type
  await testMatrix({ status: 123 });

  // RETRY_WAIT nextAttemptAt validation
  await deps.db.collection('ops_automation_jobs').doc(jMal).update({ status: 'RETRY_WAIT', nextAttemptAt: FieldValue.delete() });
  const docBeforeRetryWait = (await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data();
  assert.equal((await acquireLease(deps, jMal)).reason, 'INVALID_STATE');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docBeforeRetryWait);

  await deps.db.collection('ops_automation_jobs').doc(jMal).update({ nextAttemptAt: 'invalid-date' });
  const docBeforeRetryWaitInvalidDate = (await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data();
  assert.equal((await acquireLease(deps, jMal)).reason, 'INVALID_STATE');
  assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jMal).get()).data(), docBeforeRetryWaitInvalidDate);

  // restore to valid
  await deps.db.collection('ops_automation_jobs').doc(jMal).update({ status: 'IN_PROGRESS', attempt: 1, leaseGeneration: 1, leaseExpiresAt: new Date(mockTime.getTime() + 99999).toISOString() });
  assert.equal((await heartbeatLease(deps, jMal, aMal.ownerToken!, 1)).ok, true);

  console.log('Test: Discovery queries use injected time and bounded limit');
  assert.throws(() => buildRetryDiscoveryQuery(deps.db, 0, deps.now()), /INVALID_LIMIT/);
  assert.throws(() => buildRetryDiscoveryQuery(deps.db, 101, deps.now()), /INVALID_LIMIT/);
  assert.throws(() => buildRetryDiscoveryQuery(deps.db, NaN, deps.now()), /INVALID_LIMIT/);

  const qRetry = buildRetryDiscoveryQuery(deps.db, 5, deps.now()) as any;
  assert.equal(qRetry._limit, 5);
  assert.equal(qRetry._where[0].field, 'status');
  assert.equal(qRetry._where[0].op, 'in');
  assert.deepEqual(qRetry._where[0].val, ['PENDING', 'RETRY_WAIT']);
  assert.equal(qRetry._where[1].field, 'nextAttemptAt');
  assert.equal(qRetry._where[1].op, '<=');
  assert.equal(qRetry._where[1].val, mockTime.toISOString());
  assert.equal(qRetry._orderBy[0].field, 'nextAttemptAt');
  assert.equal(qRetry._orderBy[0].dir, 'asc');

  const qExp = buildExpiredLeaseDiscoveryQuery(deps.db, 10, deps.now()) as any;
  assert.equal(qExp._limit, 10);
  assert.equal(qExp._where[0].field, 'status');
  assert.equal(qExp._where[0].op, '==');
  assert.equal(qExp._where[0].val, 'IN_PROGRESS');
  assert.equal(qExp._where[1].field, 'leaseExpiresAt');
  assert.equal(qExp._where[1].op, '<=');
  assert.equal(qExp._where[1].val, mockTime.toISOString());
  assert.equal(qExp._orderBy[0].field, 'leaseExpiresAt');
  assert.equal(qExp._orderBy[0].dir, 'asc');

  console.log('Test: Discovery queries reject invalid now');
  assert.throws(() => buildRetryDiscoveryQuery(deps.db, 5, 'not-a-date' as any), /INVALID_NOW/);
  assert.throws(() => buildRetryDiscoveryQuery(deps.db, 5, new Date('invalid')), /INVALID_NOW/);

  console.log('Test: Job ID validation in worker methods rejects malformed formats before Firestore');
  let touchedFirestore = false;
  const mockDeps = {
    ...deps,
    db: {
      collection: () => ({ doc: () => { touchedFirestore = true; return {}; } }),
      runTransaction: async () => { touchedFirestore = true; }
    } as any
  };
  const malformedIds = ['', ' ', 'job_blog_20260726_0800/..', 'job_unknown_20260726_0800', 'job_blog_20261399_9999'];
  for (const id of malformedIds) {
    touchedFirestore = false;
    const acq = await acquireLease(mockDeps, id);
    assert.equal(acq.ok, false);
    assert.equal(acq.reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestore, false);

    touchedFirestore = false;
    assert.equal((await heartbeatLease(mockDeps, id, 't', 1)).reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestore, false);
    touchedFirestore = false;
    assert.equal((await completeJob(mockDeps, id, 't', 1, 'SUCCESS')).reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestore, false);
    touchedFirestore = false;
    assert.equal((await failJob(mockDeps, id, 't', 1, 'ERR')).reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestore, false);
  }

  // === R1: Complete RETRY_WAIT Schema Matrix ===
  console.log('Test: R1 Complete RETRY_WAIT Schema Matrix');
  await enqueueJob(deps, 'blog', '20260726_1100');
  const jR1 = generateJobId('blog', '20260726_1100');
  const aR1 = await acquireLease(deps, jR1);
  await failJob(deps, jR1, aR1.ownerToken!, aR1.leaseGeneration!, 'ERR');

  const testMatrixR1 = async (docUpdates: any) => {
    // start from a fresh valid RETRY_WAIT baseline
    await deps.db.collection('ops_automation_jobs').doc(jR1).update({
      status: 'RETRY_WAIT',
      attempt: 1,
      leaseGeneration: 1,
      nextAttemptAt: new Date(mockTime.getTime() + 100000).toISOString(),
      ownerToken: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
      heartbeatAt: FieldValue.delete(),
      schemaVersion: 1,
      lastErrorCode: 'UNKNOWN_EXECUTION_FAILURE',
      ...docUpdates
    });
    const docBefore = (await deps.db.collection('ops_automation_jobs').doc(jR1).get()).data();

    assert.equal((await acquireLease(deps, jR1)).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jR1).get()).data(), docBefore);

    assert.equal((await heartbeatLease(deps, jR1, aR1.ownerToken!, 1)).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jR1).get()).data(), docBefore);

    assert.equal((await completeJob(deps, jR1, aR1.ownerToken!, 1, 'SUCCESS')).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jR1).get()).data(), docBefore);

    assert.equal((await failJob(deps, jR1, aR1.ownerToken!, 1, 'ERR')).reason, 'INVALID_STATE');
    assert.deepEqual((await deps.db.collection('ops_automation_jobs').doc(jR1).get()).data(), docBefore);
  };

  await testMatrixR1({ leaseGeneration: FieldValue.delete() });
  await testMatrixR1({ leaseGeneration: '1' });
  await testMatrixR1({ leaseGeneration: NaN });
  await testMatrixR1({ leaseGeneration: Infinity });
  await testMatrixR1({ leaseGeneration: -1 });
  await testMatrixR1({ leaseGeneration: 1.5 });
  await testMatrixR1({ nextAttemptAt: FieldValue.delete() });
  await testMatrixR1({ nextAttemptAt: 'invalid-date' });
  await testMatrixR1({ nextAttemptAt: new Date(mockTime.getTime()).toISOString().replace('Z', '.000Z') }); // space not needed since replace does it
  await testMatrixR1({ nextAttemptAt: '2026-07-26T00:00:00Z' }); // missing ms
  await testMatrixR1({ nextAttemptAt: '2026-07-26T00:00:00.000Z ' }); // space


  // === R2: Complete Malformed Job-ID Matrix ===
  console.log('Test: R2 Complete Malformed Job-ID Matrix');
  let touchedFirestoreR2 = false;
  const mockDepsR2 = {
    ...deps,
    db: {
      collection: () => ({ doc: () => { touchedFirestoreR2 = true; return {}; } }),
      runTransaction: async () => { touchedFirestoreR2 = true; }
    } as any
  };

  const malformedIdsR2 = [
    '', '/', '\\', '../', './', ' ', '\t', '\n',
    'job_unknown_20260726_0800',
    'job_blog_20261301_0800',
    'job_blog_20260726_2400',
    'job_blog_20260726_0860',
    'job_BLOG_20260726_0800',
    'blog_20260726_0800',
    'job_blog202607260800',
    'job_blog_20260726_0800_extra',
    ' job_blog_20260726_0800',
    'job_blog_20260726_0800 ',
    'job_blog_20260726_08 00',
    'job_blog_20260726_08\t00',
    'job_blog_20260726_08\n00',
    'job_blog_20260726_08\u000000',
    'extra_job_blog_20260726_0800'
  ];

  for (const id of malformedIdsR2) {
    touchedFirestoreR2 = false;
    assert.equal((await acquireLease(mockDepsR2, id)).reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestoreR2, false);

    touchedFirestoreR2 = false;
    assert.equal((await heartbeatLease(mockDepsR2, id, 't', 1)).reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestoreR2, false);

    touchedFirestoreR2 = false;
    assert.equal((await completeJob(mockDepsR2, id, 't', 1, 'SUCCESS')).reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestoreR2, false);

    touchedFirestoreR2 = false;
    assert.equal((await failJob(mockDepsR2, id, 't', 1, 'ERR')).reason, 'INVALID_JOB_ID');
    assert.equal(touchedFirestoreR2, false);
  }

  // === R3: Fencing Immutability ===
  console.log('Test: R3 Fencing Immutability');
  await enqueueJob(deps, 'blog', '20260726_1200');
  const jR3 = generateJobId('blog', '20260726_1200');
  const aR3 = await acquireLease(deps, jR3);

  const testFencing = async (fn: () => Promise<any>) => {
    const docBefore = (await deps.db.collection('ops_automation_jobs').doc(jR3).get()).data();
    const res = await fn();
    assert.equal(res.reason, 'FENCED');
    const docAfter = (await deps.db.collection('ops_automation_jobs').doc(jR3).get()).data();
    assert.deepEqual(docAfter, docBefore);
  };

  await testFencing(() => heartbeatLease(deps, jR3, 'stale', aR3.leaseGeneration!));
  await testFencing(() => heartbeatLease(deps, jR3, aR3.ownerToken!, 999));

  await testFencing(() => completeJob(deps, jR3, 'stale', aR3.leaseGeneration!, 'SUCCESS'));
  await testFencing(() => completeJob(deps, jR3, aR3.ownerToken!, 999, 'SUCCESS'));

  await testFencing(() => failJob(deps, jR3, 'stale', aR3.leaseGeneration!, 'ERR'));
  await testFencing(() => failJob(deps, jR3, aR3.ownerToken!, 999, 'ERR'));

  // === R4: Expired Owner Immutability ===
  console.log('Test: R4 Expired Owner Immutability');
  await enqueueJob(deps, 'blog', '20260726_1300');
  const jR4 = generateJobId('blog', '20260726_1300');
  const aR4 = await acquireLease(deps, jR4);

  mockTime = new Date(mockTime.getTime() + 99999999); // advance past expiration

  const checkFields = (doc1: any, doc2: any) => {
    const fields = ['status', 'attempt', 'ownerToken', 'leaseGeneration', 'leaseExpiresAt', 'heartbeatAt', 'nextAttemptAt', 'resultCode', 'lastErrorCode', 'completedAt', 'updatedAt'];
    for (const f of fields) {
      assert.deepEqual(doc1[f], doc2[f], `Field ${f} changed`);
    }
  };

  const testExpired = async (fn: () => Promise<any>) => {
    const docBefore = (await deps.db.collection('ops_automation_jobs').doc(jR4).get()).data();
    const res = await fn();
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'LEASE_EXPIRED');
    const docAfter = (await deps.db.collection('ops_automation_jobs').doc(jR4).get()).data();
    assert.deepEqual(docAfter, docBefore);
    checkFields(docBefore, docAfter);
  };

  await testExpired(() => heartbeatLease(deps, jR4, aR4.ownerToken!, aR4.leaseGeneration!));
  await testExpired(() => completeJob(deps, jR4, aR4.ownerToken!, aR4.leaseGeneration!, 'SUCCESS'));
  await testExpired(() => failJob(deps, jR4, aR4.ownerToken!, aR4.leaseGeneration!, 'ERR')); // schedules retry

  // forcefully set attempt to 3 to test failJob producing FAILED_TERMINAL
  await deps.db.collection('ops_automation_jobs').doc(jR4).update({ attempt: 3 });
  await testExpired(() => failJob(deps, jR4, aR4.ownerToken!, aR4.leaseGeneration!, 'ERR'));


  // === R5: Complete Discovery Validation Tests ===
  console.log('Test: R5 Complete Discovery Validation Tests');
  const testDiscoveryMatrix = (fn: (db: any, limit: any, now: any) => any) => {
    // now
    assert.throws(() => fn(deps.db, 5, 'not-a-date'), /INVALID_NOW/);
    assert.throws(() => fn(deps.db, 5, new Date('invalid')), /INVALID_NOW/);

    // limit
    assert.throws(() => fn(deps.db, 0, deps.now()), /INVALID_LIMIT/);
    assert.throws(() => fn(deps.db, -1, deps.now()), /INVALID_LIMIT/);
    assert.throws(() => fn(deps.db, 1.5, deps.now()), /INVALID_LIMIT/);
    assert.throws(() => fn(deps.db, NaN, deps.now()), /INVALID_LIMIT/);
    assert.throws(() => fn(deps.db, Infinity, deps.now()), /INVALID_LIMIT/);
    assert.throws(() => fn(deps.db, 101, deps.now()), /INVALID_LIMIT/);
  };

  testDiscoveryMatrix(buildRetryDiscoveryQuery);
  testDiscoveryMatrix(buildExpiredLeaseDiscoveryQuery);

  console.log('Test: queue transactions do not import restricted modules');
  const queueServiceContent = fs.readFileSync(path.join(__dirname, '../../src/lib/automation/queueService.ts'), 'utf-8');
  const prohibited = ['dailyCap', 'daily-cap', 'reserve', 'draft', 'approve', 'publish', 'runService', 'provider', 'execute', 'fetch', 'netlify', 'console.', 'logger'];
  for (const token of prohibited) {
    assert.ok(!queueServiceContent.includes(token), `Should not contain ${token}`);
  }

  console.log('All tests passed safely.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
