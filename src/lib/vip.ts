/**
 * VIP subscription helpers.
 *
 * Sources of truth (set by /api/webhooks/payos):
 *   user.vipUntil  — Firestore Timestamp at which the monthly window ends
 *   user.vipPlan   — 'monthly' while the window is active
 *
 * Per-chapter unlock (user.unlockedChapters[]) still works independently.
 * A user with active VIP gets every chapter unlocked automatically; a
 * non-VIP user must purchase chapters individually with xu.
 */
import type { UserProfile } from '@/types';

export function vipUntilMs(profile: UserProfile | null | undefined): number {
  const raw: any = profile?.vipUntil;
  if (!raw) return 0;
  // Firebase client SDK Timestamp has .toMillis()
  if (typeof raw?.toMillis === 'function') return raw.toMillis();
  // Already serialized to {seconds, nanoseconds} by serializeFirestore?
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000;
  // Already a number/string we can parse
  const n = Number(raw);
  if (!Number.isNaN(n) && n > 0) return n;
  return 0;
}

export function isVipActive(profile: UserProfile | null | undefined, nowMs = Date.now()): boolean {
  return vipUntilMs(profile) > nowMs;
}

export function isChapterUnlockedByUser(
  chapterId: string,
  isChapterVip: boolean,
  profile: UserProfile | null | undefined,
): boolean {
  if (!isChapterVip) return true; // free chapter
  if (!profile) return false;
  if (isVipActive(profile)) return true; // monthly VIP → all VIP chapters unlocked
  return (profile.unlockedChapters || []).includes(chapterId);
}

/** Human-readable days remaining, e.g. "12 ngày 4 giờ". Returns '' if not VIP. */
export function vipRemainingLabel(profile: UserProfile | null | undefined): string {
  const ms = vipUntilMs(profile) - Date.now();
  if (ms <= 0) return '';
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  if (days >= 1) return `${days} ngày${hours > 0 ? ` ${hours} giờ` : ''}`;
  return `${hours} giờ`;
}
