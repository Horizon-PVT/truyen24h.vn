/**
 * Daily Missions modal.
 *
 * Triggered from the TopNavBar 'Nhiệm vụ' button. Fetches today's
 * missions via /api/missions/today, shows progress bars, lets the
 * reader claim coin rewards, and offers a 1-click link to the page
 * where each unfinished mission can be completed.
 *
 * Layout: flex column inside max-h-[85vh] so the list scrolls
 * internally; header (with title + close) + footer stay sticky.
 * Centered absolutely on the viewport via flex inset-0.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  X, Target, Loader2, Check, Gift, BookOpen, BookMarked, Lock,
  Sparkles, ArrowRight,
} from 'lucide-react';

interface MissionRow {
  id: string;
  title: string;
  description: string;
  goal: number;
  reward: number;
  count: number;
  claimed: boolean;
  completed: boolean;
  claimable: boolean;
}

const ICON_BY_ID: Record<string, any> = {
  check_in: Sparkles,
  read_chapter: BookOpen,
  bookmark_novel: BookMarked,
  unlock_vip: Lock,
};

// Where each mission can be completed — used by the 'Đi làm ngay' shortcut.
const ACTION_HREF: Record<string, { href: string; label: string } | null> = {
  check_in: null, // handled via top-bar button
  read_chapter: { href: '/tim-kiem', label: 'Tìm truyện đọc' },
  bookmark_novel: { href: '/tim-kiem', label: 'Tìm truyện để lưu' },
  unlock_vip: { href: '/bang-xep-hang', label: 'Vào truyện có chương VIP' },
};

export default function MissionsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/missions/today?uid=${encodeURIComponent(user.uid)}`, { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Load failed');
      setMissions(data.missions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => { load(); }, [load]);

  // Disable page scroll while modal is open + ESC to close.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function claim(id: string) {
    setClaiming(id);
    try {
      const r = await fetch('/api/missions/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, missionId: id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Claim failed');
      setToast(`+${data.reward} xu!`);
      setTimeout(() => setToast(null), 2500);
      load();
    } catch (e: any) {
      setToast('Lỗi: ' + e.message);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setClaiming(null);
    }
  }

  function gotoAction(missionId: string) {
    const act = ACTION_HREF[missionId];
    if (!act) return;
    onClose();
    router.push(act.href);
  }

  const totalEarned = missions.filter((m) => m.claimed).reduce((s, m) => s + m.reward, 0);
  const totalAvailable = missions.reduce((s, m) => s + m.reward, 0);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal frame */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-surface rounded-3xl shadow-2xl ring-1 ring-white/10 overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-accent/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-11 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Target className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-black tracking-tight">Nhiệm vụ hằng ngày</h2>
              <p className="text-[11px] text-muted mt-0.5">Reset 0h · {totalEarned}/{totalAvailable} xu hôm nay</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 size-9 inline-flex items-center justify-center rounded-full bg-background-light hover:bg-red-500/20 hover:text-red-400 text-muted transition"
            aria-label="Đóng nhiệm vụ"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Total progress */}
        <div className="px-6 py-3 border-b border-accent/10 bg-surface/60">
          <div className="h-2 bg-background-light rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all"
              style={{ width: totalAvailable > 0 ? `${(totalEarned / totalAvailable) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {toast && (
          <div className="px-6 py-2 bg-primary/15 text-primary text-sm font-bold text-center border-b border-primary/30">
            {toast}
          </div>
        )}

        {error && (
          <div className="px-6 py-3 bg-red-500/10 text-red-400 border-b border-red-500/30 text-sm">{error}</div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin size-6 text-muted" /></div>
          ) : (
            <div className="space-y-3">
              {missions.map((m) => {
                const Icon = ICON_BY_ID[m.id] || Target;
                const pct = Math.min(100, (m.count / m.goal) * 100);
                const action = ACTION_HREF[m.id];
                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-2xl border-2 transition ${
                      m.claimed
                        ? 'border-green-500/30 bg-green-500/5'
                        : m.completed
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-accent/10 bg-background-light hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${
                        m.claimed ? 'bg-green-500/20 text-green-400' : 'bg-primary/10 text-primary'
                      }`}>
                        {m.claimed ? <Check className="size-5" /> : <Icon className="size-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-bold text-sm truncate">{m.title}</h3>
                          {m.reward > 0 && (
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shrink-0 ${
                              m.claimed ? 'bg-green-500/15 text-green-400' : 'bg-primary/15 text-primary'
                            }`}>
                              +{m.reward} xu
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted mb-2 leading-snug">{m.description}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-muted font-bold tabular-nums">{m.count}/{m.goal}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action row: Nhận thưởng OR Đi làm ngay */}
                    {m.claimable ? (
                      <button
                        onClick={() => claim(m.id)}
                        disabled={claiming === m.id}
                        className="mt-3 w-full h-10 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                      >
                        {claiming === m.id ? <Loader2 className="animate-spin size-4" /> : <><Gift className="size-4" /> Nhận thưởng</>}
                      </button>
                    ) : m.claimed ? (
                      <div className="mt-3 text-center text-xs text-green-400 font-bold uppercase tracking-widest">
                        ✓ Đã nhận thưởng
                      </div>
                    ) : action ? (
                      <button
                        onClick={() => gotoAction(m.id)}
                        className="mt-3 w-full h-10 bg-background border border-accent/20 hover:border-primary/40 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 text-muted hover:text-primary transition"
                      >
                        {action.label} <ArrowRight className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-accent/10 bg-surface/40 flex items-center justify-between gap-3">
          <p className="text-[10px] text-muted/70 uppercase tracking-[0.16em] font-bold">
            Tự đếm khi anh đọc/lưu/mở VIP
          </p>
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-widest font-bold text-muted hover:text-primary transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
