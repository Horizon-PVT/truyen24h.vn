/**
 * AuthorPayoutPanel — embedded into /creator-studio/payout.
 *
 * Shows the author's earnings (current xu balance, this-month and
 * all-time totals, unlock/donate counts) plus a real-time list of
 * their withdraw_requests. Lets them open a withdraw request with
 * bank info; the request goes through /api/withdraw/request which
 * deducts xu and persists the row atomically.
 *
 * Hide-when-not-logged-in by mirroring the AuthContext pattern.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  Coins, TrendingUp, Wallet, BookOpen, Heart, Loader2, AlertCircle,
  ArrowDownRight, CheckCircle2, Clock, X, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

const XU_TO_VND = 100;
const MIN_WITHDRAW_XU = 100;

interface Earnings {
  currentBalance: number;
  thisMonthXu: number;
  thisMonthVnd: number;
  allTimeXu: number;
  allTimeVnd: number;
  unlockCount: number;
  donateCount: number;
  recent: Array<{ type: string; amount: number; novelId?: string; createdAt?: number }>;
}

interface WithdrawRow {
  id: string;
  amountXu: number;
  amountVND: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  status: 'PENDING' | 'COMPLETED' | string;
  createdAt?: any;
}

export default function AuthorPayoutPanel() {
  const { user, loading: authLoading } = useAuth();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [withdraws, setWithdraws] = useState<WithdrawRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/author/earnings?uid=${encodeURIComponent(user.uid)}`, { cache: 'no-store' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Load failed');
      setEarnings(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadEarnings(); }, [loadEarnings]);

  // Subscribe to this author's withdraw requests
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'withdraw_requests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setWithdraws(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as WithdrawRow[]);
    }, (err) => console.error('withdraws snap err', err));
    return () => unsub();
  }, [user]);

  const pendingTotal = useMemo(
    () => withdraws.filter((w) => w.status === 'PENDING').reduce((s, w) => s + w.amountXu, 0),
    [withdraws]
  );
  const completedTotal = useMemo(
    () => withdraws.filter((w) => w.status === 'COMPLETED').reduce((s, w) => s + w.amountXu, 0),
    [withdraws]
  );

  async function submitWithdraw() {
    if (!user) return;
    setSubmitting(true);
    setToast(null);
    try {
      const r = await fetch('/api/withdraw/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, amountXu: amount, bankName, accountName, accountNumber }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Rút tiền thất bại');
      setToast('Đã gửi yêu cầu rút tiền. Admin sẽ duyệt trong 24h.');
      setShowModal(false);
      setAmount(0); setBankName(''); setAccountName(''); setAccountNumber('');
      loadEarnings();
    } catch (e: any) {
      setToast('Lỗi: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto size-8 text-muted" /></div>;

  if (!user) {
    return (
      <div className="p-12 rounded-2xl bg-surface border border-accent/20 text-center">
        <AlertCircle className="size-12 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold mb-2">Cần đăng nhập</h2>
        <p className="text-muted mb-6">Hãy đăng nhập bằng tài khoản tác giả để xem doanh thu.</p>
        <Link href="/creator-studio" className="px-6 py-3 rounded-xl bg-primary text-white font-bold inline-block">
          Quay lại Creator Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/creator-studio" className="size-9 rounded-full bg-surface border border-accent/10 flex items-center justify-center text-muted hover:text-primary">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Wallet className="text-primary" /> Doanh thu & Rút tiền
          </h1>
          <p className="text-muted text-sm">Tỷ giá 1 xu = {XU_TO_VND} đ · Tối thiểu rút {MIN_WITHDRAW_XU} xu</p>
        </div>
      </div>

      {toast && (
        <div className={`p-3 rounded-xl text-sm border ${
          toast.startsWith('Lỗi') ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
        }`}>{toast}</div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 text-sm">{error}</div>
      )}

      {/* Stats grid */}
      {loading || !earnings ? (
        <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto size-6 text-muted" /></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Coins} label="Số dư hiện tại" value={`${earnings.currentBalance.toLocaleString('vi-VN')} xu`} sub={`${(earnings.currentBalance * XU_TO_VND).toLocaleString('vi-VN')} đ`} color="text-primary" />
          <StatCard icon={TrendingUp} label="Tháng này" value={`${earnings.thisMonthXu.toLocaleString('vi-VN')} xu`} sub={`${earnings.thisMonthVnd.toLocaleString('vi-VN')} đ`} color="text-green-400" />
          <StatCard icon={BookOpen} label="Mở khoá chương" value={String(earnings.unlockCount)} sub="Người đọc mua VIP" color="text-yellow-500" />
          <StatCard icon={Heart} label="Donate" value={String(earnings.donateCount)} sub="Người donate" color="text-pink-400" />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <StatCard icon={Clock} label="Đang chờ duyệt" value={`${pendingTotal.toLocaleString('vi-VN')} xu`} sub={`${(pendingTotal * XU_TO_VND).toLocaleString('vi-VN')} đ`} color="text-yellow-500" />
        <StatCard icon={CheckCircle2} label="Đã rút thành công" value={`${completedTotal.toLocaleString('vi-VN')} xu`} sub={`${(completedTotal * XU_TO_VND).toLocaleString('vi-VN')} đ`} color="text-green-400" />
        <button
          onClick={() => { setAmount(earnings?.currentBalance || 0); setShowModal(true); }}
          disabled={!earnings || earnings.currentBalance < MIN_WITHDRAW_XU}
          className="rounded-2xl bg-primary text-white p-5 flex flex-col items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownRight className="size-8" />
          <span className="font-black uppercase tracking-widest text-sm">Yêu cầu rút tiền</span>
          {(earnings && earnings.currentBalance < MIN_WITHDRAW_XU) && (
            <span className="text-[10px] text-white/70">Cần tối thiểu {MIN_WITHDRAW_XU} xu</span>
          )}
        </button>
      </div>

      {/* Withdraw history */}
      <section className="rounded-2xl border border-accent/10 overflow-hidden">
        <div className="p-4 border-b border-accent/10 flex items-center justify-between bg-surface">
          <h3 className="font-bold">Lịch sử rút tiền</h3>
          <span className="text-xs text-muted">{withdraws.length} yêu cầu</span>
        </div>
        {withdraws.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">Chưa có yêu cầu rút tiền nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left p-3">Ngày</th>
                <th className="text-right p-3">Số tiền</th>
                <th className="text-left p-3">Ngân hàng</th>
                <th className="text-left p-3">STK</th>
                <th className="text-center p-3 w-32">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {withdraws.map((w) => {
                const d = w.createdAt?.toDate?.() || (w.createdAt ? new Date(w.createdAt) : null);
                return (
                  <tr key={w.id} className="border-t border-accent/10">
                    <td className="p-3 text-xs text-muted">{d ? d.toLocaleString('vi-VN') : '—'}</td>
                    <td className="p-3 text-right font-bold tabular-nums">{w.amountXu.toLocaleString('vi-VN')} xu</td>
                    <td className="p-3 text-xs">{w.bankName}</td>
                    <td className="p-3 text-xs font-mono">{w.accountNumber}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                        w.status === 'COMPLETED' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {w.status === 'COMPLETED' ? 'Đã chuyển' : 'Đang chờ'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Withdraw modal */}
      {showModal && earnings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !submitting && setShowModal(false)} />
          <div className="relative w-full max-w-md bg-surface rounded-3xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-accent/10">
              <h2 className="text-xl font-black tracking-tight">Yêu cầu rút tiền</h2>
              <button onClick={() => !submitting && setShowModal(false)} className="size-9 rounded-full bg-background-light hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted">Số dư hiện tại: <strong className="text-primary">{earnings.currentBalance.toLocaleString('vi-VN')} xu</strong> · Tỷ giá 1 xu = {XU_TO_VND} đ</p>

              <Field label="Số xu muốn rút">
                <input
                  type="number"
                  min={MIN_WITHDRAW_XU}
                  max={earnings.currentBalance}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-background rounded-xl border border-accent/20 text-sm"
                />
                <span className="text-[11px] text-muted mt-1 block">≈ {(amount * XU_TO_VND).toLocaleString('vi-VN')} đ</span>
              </Field>

              <Field label="Tên ngân hàng">
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="VD: Vietcombank" className="w-full px-3 py-2.5 bg-background rounded-xl border border-accent/20 text-sm" />
              </Field>

              <Field label="Tên chủ tài khoản (in hoa, không dấu)">
                <input value={accountName} onChange={(e) => setAccountName(e.target.value.toUpperCase())} placeholder="PHAM ANH TUNG" className="w-full px-3 py-2.5 bg-background rounded-xl border border-accent/20 text-sm font-mono uppercase" />
              </Field>

              <Field label="Số tài khoản">
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1234567890" className="w-full px-3 py-2.5 bg-background rounded-xl border border-accent/20 text-sm font-mono" />
              </Field>

              <button
                onClick={submitWithdraw}
                disabled={submitting || !bankName || !accountName || !accountNumber || amount < MIN_WITHDRAW_XU || amount > earnings.currentBalance}
                className="w-full h-12 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin size-4" /> : <>Gửi yêu cầu rút</>}
              </button>
              <p className="text-[10px] text-muted/70 text-center">
                Admin sẽ duyệt và chuyển khoản trong 24h làm việc.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-5 rounded-2xl bg-surface border border-accent/10">
      <div className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider mb-2">
        <Icon className={`size-4 ${color || ''}`} /> {label}
      </div>
      <div className={`text-2xl font-black ${color || ''}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest font-bold text-muted block mb-1">{label}</span>
      {children}
    </label>
  );
}
