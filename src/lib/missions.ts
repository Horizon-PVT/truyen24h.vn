/**
 * Daily missions catalog.
 *
 * Each mission has a stable id (also used as Firestore subdoc id),
 * a human-friendly title, a goal (units to reach), and a coin reward
 * granted once the user claims. Missions reset every UTC day; we use
 * the date string YYYY-MM-DD as the parent doc id under
 *   users/{uid}/daily_missions/{date}/progress/{missionId}
 *
 * Mission types correspond 1:1 with API event names accepted by
 * /api/missions/progress:
 *   - 'check_in'      : claimed automatically when user uses /api/checkin/claim
 *   - 'read_chapter'  : ping from ReaderClient on first open of a chapter today
 *   - 'bookmark_novel': from /api/bookmark/toggle when isFollowing flips true
 *   - 'unlock_vip'    : from /api/unlock-chapter after a successful unlock
 *   - 'comment'       : from inline_comment write (future)
 */
export interface Mission {
  id: string;
  title: string;
  goal: number;
  reward: number;
  description: string;
}

export const DAILY_MISSIONS: Mission[] = [
  { id: 'check_in',       goal: 1, reward: 0,  title: 'Điểm danh hằng ngày',         description: 'Tự hoàn thành khi anh bấm Điểm danh ở topbar.' },
  { id: 'read_chapter',   goal: 3, reward: 10, title: 'Đọc 3 chương truyện bất kỳ',  description: 'Mỗi chương đọc mới trong ngày tính 1 điểm.' },
  { id: 'bookmark_novel', goal: 1, reward: 5,  title: 'Lưu 1 truyện vào tủ sách',    description: 'Bấm nút "Thêm vào tủ sách" ở trang truyện.' },
  { id: 'unlock_vip',     goal: 1, reward: 30, title: 'Mở khoá 1 chương VIP',         description: 'Dùng xu mở chương đánh dấu VIP.' },
];

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function missionById(id: string): Mission | undefined {
  return DAILY_MISSIONS.find((m) => m.id === id);
}
