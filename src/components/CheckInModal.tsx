"use client";
import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Sparkles, Calendar, Gift, X, CheckCircle2, Loader2, Flame, Trophy } from 'lucide-react';
import { getDailyGreeting } from '../services/geminiService';

interface CheckInModalProps {
  user: User;
  onClose: () => void;
}

/**
 * Daily check-in modal.
 *
 * Calls the server-side /api/checkin/claim route instead of writing
 * directly from the client. The Firestore rules forbid users from
 * incrementing their own coin balance (anti-cheat), so all the
 * critical math has to happen server-side via the Admin SDK.
 *
 * The server returns the new streak day plus any bonus xu (day 7,
 * 14, 30) which we surface to the reader so the streak feels alive.
 */
export default function CheckInModal({ user, onClose }: CheckInModalProps) {
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [streak, setStreak] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [reward, setReward] = useState<{ total: number; bonus: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // After a fresh successful claim we auto-close the modal so the user
  // doesn't have to hunt for the X button. We only auto-close when the
  // claim happened during THIS modal session (reward set), not when the
  // modal opens for someone who already checked in earlier today.
  useEffect(() => {
    if (reward) {
      const t = setTimeout(() => onClose(), 2500);
      return () => clearTimeout(t);
    }
  }, [reward, onClose]);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setHasCheckedInToday(data.lastCheckIn === today);
          setStreak(Number(data.checkInStreak || 0));
        }
        const aiGreeting = await getDailyGreeting(user.displayName || 'Bạn');
        setGreeting(aiGreeting);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, [user, today]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    setErrorMsg(null);
    try {
      const r = await fetch('/api/checkin/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Lỗi check-in');
      if (data.alreadyClaimed) {
        setHasCheckedInToday(true);
        setStreak(data.streak);
        return;
      }
      setReward({ total: data.total, bonus: data.bonus || 0 });
      setStreak(data.streak);
      setHasCheckedInToday(true);
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi không xác định');
    } finally {
      setCheckingIn(false);
    }
  };

  // Visual indicator for the 7-day streak grid (rolling window).
  const streakDays = Array.from({ length: 7 }, (_, i) => i + 1);
  const streakIndex = ((streak - 1) % 7); // 0..6

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Loader2 className="size-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-surface rounded-[40px] shadow-2xl border border-accent/10 p-10 animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent"></div>

        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-background-light rounded-full text-muted transition-colors z-10"
        >
          <X className="size-5" />
        </button>

        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center ring-8 ring-primary/5">
              <Sparkles className="size-12 text-primary animate-pulse" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="font-display text-3xl font-black text-text-main uppercase tracking-tighter mb-3">Điểm danh hàng ngày</h2>
            {greeting && <p className="text-sm text-muted font-medium italic">"{greeting}"</p>}
          </div>

          {/* Streak counter */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Flame className="size-5 text-orange-500" />
            <span className="font-black text-lg text-text-main">{streak}</span>
            <span className="text-xs text-muted uppercase tracking-widest font-bold">ngày liên tiếp</span>
          </div>

          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-2 mb-8">
            {streakDays.map((d) => {
              const isCurrent = streakIndex + 1 === d && !hasCheckedInToday;
              const isDone = (hasCheckedInToday && d <= streakIndex + 1) || (!hasCheckedInToday && d <= streakIndex);
              const isBonus = d === 7;
              return (
                <div
                  key={d}
                  className={`aspect-square rounded-xl border-2 flex items-center justify-center text-xs font-black ${
                    isDone
                      ? 'bg-primary/20 border-primary text-primary'
                      : isCurrent
                      ? 'border-primary border-dashed text-primary animate-pulse'
                      : 'border-accent/10 text-muted'
                  }`}
                >
                  {isBonus ? <Trophy className="size-4" /> : d}
                </div>
              );
            })}
          </div>

          <div className="bg-background-light rounded-3xl p-6 mb-6 border border-accent/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-primary" />
                <span className="font-bold text-sm text-text-main">
                  {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                +10 Xu
              </div>
            </div>

            {hasCheckedInToday ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <CheckCircle2 className="size-10 text-green-500" />
                <p className="font-black text-text-main uppercase tracking-widest text-sm">Đã điểm danh hôm nay!</p>
                {reward && (
                  <p className="text-xs text-primary font-bold">
                    +{reward.total} xu {reward.bonus > 0 && `(bonus chuỗi ${streak} ngày: +${reward.bonus})`}
                  </p>
                )}
                <p className="text-xs text-muted">Quay lại ngày mai để giữ chuỗi.</p>
              </div>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full h-16 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {checkingIn ? <Loader2 className="size-5 animate-spin" /> : <><Gift className="size-5" /> Nhận quà ngay</>}
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 text-xs">
              {errorMsg}
            </div>
          )}

          <p className="text-[10px] text-center text-muted uppercase tracking-[0.2em] font-bold">
            Chuỗi 7 ngày +50 xu · 14 ngày +120 xu · 30 ngày +500 xu
          </p>
        </div>
      </div>
    </div>
  );
}
