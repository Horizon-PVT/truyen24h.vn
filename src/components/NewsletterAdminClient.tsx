/**
 * Admin view of the newsletter list.
 *
 * Real-time list of subscribers with: search, copy-all-emails, export
 * to CSV. CSV is built client-side to avoid an extra API round-trip;
 * the dataset is small enough that this is fine.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { db } from '@/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Search, Download, Copy, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface Sub {
  id: string;
  email: string;
  source?: string;
  status?: string;
  createdAt?: any;
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

export default function NewsletterAdminClient() {
  const { isAdminUser } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'newsletter_subscribers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Sub[]);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return subs;
    return subs.filter((x) => (x.email || '').includes(s) || (x.source || '').includes(s));
  }, [subs, search]);

  function copyAll() {
    const emails = filtered.map((s) => s.email).join(', ');
    navigator.clipboard.writeText(emails);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function exportCsv() {
    const rows = ['email,source,status,created_at'];
    for (const s of filtered) {
      const created = tsToDate(s.createdAt);
      const dateStr = created ? created.toISOString() : '';
      rows.push(`${s.email},${s.source || ''},${s.status || ''},${dateStr}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truyen24h-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!isAdminUser) {
    return (
      <div className="p-12 rounded-2xl bg-surface border border-accent/20 text-center">
        <AlertCircle className="size-12 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold mb-2">Cần quyền Admin</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-3">
          <Mail className="text-primary" /> Newsletter <span className="text-sm font-normal text-muted">({subs.length} người đăng ký)</span>
        </h1>
        <p className="text-muted text-sm mt-1">Danh sách email đăng ký nhận truyện hằng tuần.</p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm email hoặc nguồn..."
            className="w-full pl-10 pr-3 py-2.5 bg-surface rounded-xl border border-accent/20 text-sm"
          />
        </div>
        <button onClick={copyAll} disabled={filtered.length === 0}
          className="px-4 py-2.5 rounded-xl bg-surface text-sm font-bold flex items-center gap-2 border border-accent/20 disabled:opacity-50">
          {copied ? <CheckCircle2 className="size-4 text-green-400" /> : <Copy className="size-4" />}
          {copied ? 'Đã copy' : 'Copy toàn bộ'}
        </button>
        <button onClick={exportCsv} disabled={filtered.length === 0}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          <Download className="size-4" /> Xuất CSV
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto size-6 text-muted" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-surface border border-accent/10 text-center text-muted">
          Chưa có email nào đăng ký. Form đặt ở footer; share trang chủ lên TikTok để bắt đầu thu email.
        </div>
      ) : (
        <div className="rounded-2xl border border-accent/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3 w-32">Nguồn</th>
                <th className="text-left p-3 w-28">Trạng thái</th>
                <th className="text-left p-3 w-40">Ngày đăng ký</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const created = tsToDate(s.createdAt);
                return (
                  <tr key={s.id} className="border-t border-accent/10 hover:bg-surface/50">
                    <td className="p-3 font-mono">{s.email}</td>
                    <td className="p-3 text-xs text-muted">{s.source || '—'}</td>
                    <td className="p-3 text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        s.status === 'confirmed' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}>{s.status || 'pending'}</span>
                    </td>
                    <td className="p-3 text-xs text-muted">
                      {created ? created.toLocaleString('vi-VN') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
