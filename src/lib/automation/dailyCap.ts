import { Firestore, Transaction } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebaseAdmin';
import { GlobalAutomationSettings } from './settings';

export interface DailyCounterData {
  schemaVersion: number;
  dateKey: string;
  timezone: 'Asia/Ho_Chi_Minh';
  totalDrafts: number;
  blogDrafts: number;
  storyDrafts: number;
  updatedAt?: unknown;
}

export type DailyCapResult =
  | { ok: true; dateKey: string; counter: DailyCounterData }
  | { ok: false; errorCode: 'AUTOMATION_DAILY_CAP_REACHED'; reason: string };

/**
 * Calculates the current dateKey YYYYMMDD in Asia/Ho_Chi_Minh (UTC+7) timezone.
 */
export function getAsiaHoChiMinhDateKey(nowDate = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(nowDate);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';

  return `${year}${month}${day}`;
}

/**
 * Atomically checks and reserves a daily cap slot using a Firestore Transaction.
 */
export async function reserveDailyCapSlot(
  db: Firestore,
  settings: GlobalAutomationSettings,
  pipeline: 'blog' | 'story',
  runId: string,
  nowDate = new Date()
): Promise<DailyCapResult> {
  const dateKey = getAsiaHoChiMinhDateKey(nowDate);
  const counterRef = db.collection('ops_daily_counters').doc(dateKey);
  const reservationRef = db.collection('ops_daily_reservations').doc(runId);

  try {
    const result = await db.runTransaction(async (transaction: Transaction) => {
      const resSnap = await transaction.get(reservationRef);
      if (resSnap.exists && resSnap.data()?.status === 'RESERVED') {
        // Already reserved by this runId
        return { ok: true as const, dateKey, counter: {} as DailyCounterData };
      }

      const snap = await transaction.get(counterRef);
      let currentTotal = 0;
      let currentBlog = 0;
      let currentStory = 0;

      if (snap.exists) {
        const data = snap.data();
        currentTotal = typeof data?.totalDrafts === 'number' ? data.totalDrafts : 0;
        currentBlog = typeof data?.blogDrafts === 'number' ? data.blogDrafts : 0;
        currentStory = typeof data?.storyDrafts === 'number' ? data.storyDrafts : 0;
      }

      // Check caps
      const maxTotal = settings.dailyCaps.totalDrafts;
      const maxPipeline = pipeline === 'blog' ? settings.dailyCaps.blogDrafts : settings.dailyCaps.storyDrafts;
      const currentPipeline = pipeline === 'blog' ? currentBlog : currentStory;

      if (currentTotal >= maxTotal) {
        return {
          ok: false as const,
          errorCode: 'AUTOMATION_DAILY_CAP_REACHED' as const,
          reason: `Đã đạt giới hạn tổng số draft trong ngày (${currentTotal}/${maxTotal} cho ngày ${dateKey}).`,
        };
      }

      if (currentPipeline >= maxPipeline) {
        return {
          ok: false as const,
          errorCode: `AUTOMATION_DAILY_CAP_${pipeline.toUpperCase()}_REACHED` as any,
          reason: `Đã đạt giới hạn số draft cho pipeline "${pipeline}" trong ngày (${currentPipeline}/${maxPipeline} cho ngày ${dateKey}).`,
        };
      }

      // Reserve slot
      const newTotal = currentTotal + 1;
      const newBlog = pipeline === 'blog' ? currentBlog + 1 : currentBlog;
      const newStory = pipeline === 'story' ? currentStory + 1 : currentStory;

      const updatedCounter: DailyCounterData = {
        schemaVersion: 1,
        dateKey,
        timezone: 'Asia/Ho_Chi_Minh',
        totalDrafts: newTotal,
        blogDrafts: newBlog,
        storyDrafts: newStory,
        updatedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(counterRef, updatedCounter, { merge: true });
      transaction.set(reservationRef, {
        runId,
        dateKey,
        pipeline,
        status: 'RESERVED',
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true as const, dateKey, counter: updatedCounter };
    });

    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errorCode: 'AUTOMATION_DAILY_CAP_REACHED',
      reason: `Lỗi tranh chấp transaction daily cap: ${msg}`,
    };
  }
}

/**
 * Releases a reserved daily cap slot if generation failed before creating a draft.
 * Verifies that the reservation belongs to runId before releasing.
 */
export async function releaseDailyCapSlot(
  db: Firestore,
  dateKey: string,
  pipeline: 'blog' | 'story',
  runId: string
): Promise<void> {
  const counterRef = db.collection('ops_daily_counters').doc(dateKey);
  const reservationRef = db.collection('ops_daily_reservations').doc(runId);

  try {
    await db.runTransaction(async (transaction: Transaction) => {
      const resSnap = await transaction.get(reservationRef);
      if (!resSnap.exists || resSnap.data()?.status !== 'RESERVED') {
        // Reservation does not exist or is not reserved by this runId -> ABORT release
        return;
      }

      const snap = await transaction.get(counterRef);
      if (!snap.exists) return;
      const data = snap.data();
      const currentTotal = Math.max(0, (data?.totalDrafts || 1) - 1);
      const currentBlog = pipeline === 'blog' ? Math.max(0, (data?.blogDrafts || 1) - 1) : data?.blogDrafts || 0;
      const currentStory = pipeline === 'story' ? Math.max(0, (data?.storyDrafts || 1) - 1) : data?.storyDrafts || 0;

      transaction.update(counterRef, {
        totalDrafts: currentTotal,
        blogDrafts: currentBlog,
        storyDrafts: currentStory,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(reservationRef, {
        status: 'RELEASED',
        releasedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    console.error(`Failed to release daily cap slot for ${dateKey} (runId: ${runId}):`, err);
  }
}
