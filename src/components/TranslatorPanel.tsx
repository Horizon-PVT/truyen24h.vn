/**
 * Admin TranslatorPanel — paste a chunk of Chinese text, choose a
 * target novel (or create one inline), and the panel splits it into
 * chapters and translates each via /api/admin/translate-chapter.
 *
 * Workflow:
 *  1. Paste Chinese text (max ~30 chapters per session is sane).
 *  2. Auto-detect chapter splits.
 *  3. Choose target novel from the dropdown (loaded from Firestore).
 *  4. Choose starting chapter number.
 *  5. Click 'Bắt đầu dịch' — translates each chapter sequentially,
 *     persists to the novel, shows a progress bar.
 */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import {
  Languages, Loader2, Play, AlertCircle, CheckCircle2, FileText,
  BookOpen, Pause, ArrowRight,
} from 'lucide-react';

interface NovelRow { id: string; title: string; latestChapterNumber?: number; }

export default function TranslatorPanel() {
  const { user, isAdminUser } = useAuth();
  const adminEmail = user?.email || '';

  const [novels, setNovels] = useState<NovelRow[]>([]);
  const [novelId, setNovelId] = useState<string>('');
  const [raw, setRaw] = useState('');
  const [startNumber, setStartNumber] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [results, setResults] = useState<Array<{ chapterNumber: number; title: string; ok: boolean; error?: string }>>([]);

  // Load novels for dropdown
  useEffect(() => {
    if (!isAdminUser) return;
    const q = query(collection(db, 'novels'), orderBy('updatedAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as NovelRow[];
      setNovels(rows);
    });
    return () => unsub();
  }, [isAdminUser]);

  // Detect chapter splits client-side for preview
  const splits = useMemo(() => {
    if (!raw.trim()) return [];
    // Re-implement detection here so we don't have to roundtrip; keep
    // in sync with src/services/aiTranslateService.ts splitIntoChapters.
    const text = raw;
    const cnRe = /^[\s]*第\s*[0-9一二三四五六七八九十百千万零〇]+\s*章/gm;
    const vnRe = /^[\s]*Ch[uươ]ng\s*\d+/gim;
    const idxs: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = cnRe.exec(text)) !== null) idxs.push(m.index);
    if (idxs.length < 2) {
      vnRe.lastIndex = 0;
      while ((m = vnRe.exec(text)) !== null) idxs.push(m.index);
    }
    if (idxs.length >= 2) {
      const chunks: string[] = [];
      for (let i = 0; i < idxs.length; i++) {
        chunks.push(text.slice(idxs[i], i + 1 < idxs.length ? idxs[i + 1] : text.length).trim());
      }
      return chunks;
    }
    // Fallback: 2500 chars per chapter
    const out: string[] = [];
    for (let i = 0; i < text.length; i += 2500) out.push(text.slice(i, i + 2500).trim());
    return out.filter(Boolean);
  }, [raw]);

  const selectedNovel = novels.find((n) => n.id === novelId);

  async function startTranslate() {
    if (!novelId || splits.length === 0 || !adminEmail) return;
    setBusy(true);
    setResults([]);
    setProgress({ done: 0, total: splits.length });

    for (let i = 0; i < splits.length; i++) {
      const chapterNumber = startNumber + i;
      setProgress({ done: i, total: splits.length, current: `Chương ${chapterNumber}` });
      try {
        const r = await fetch('/api/admin/translate-chapter', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-admin-email': adminEmail },
          body: JSON.stringify({
            raw: splits[i],
            chapterNumber,
            novelTitle: selectedNovel?.title,
            persist: true,
            novelId,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Translate failed');
        setResults((prev) => [...prev, { chapterNumber, title: data.title, ok: true }]);
      } catch (e: any) {
        setResults((prev) => [...prev, { chapterNumber, title: '', ok: false, error: e.message }]);
      }
    }
    setProgress({ done: splits.length, total: splits.length });
    setBusy(false);
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
          <Languages className="text-primary" /> AI Translator
        </h1>
        <p className="text-muted text-sm mt-1">Dịch truyện Trung Quốc sang tiếng Việt + đăng tự động.</p>
      </div>

      <section className="p-6 rounded-2xl bg-surface border border-accent/10 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><FileText className="size-4 text-primary" /> Bước 1 — Dán bản gốc</h2>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Dán văn bản tiếng Trung vào đây. Em sẽ tự nhận diện 第X章 hoặc Chương X để chia chương."
          rows={10}
          className="w-full px-3 py-3 bg-background rounded-xl border border-accent/20 text-sm font-mono"
        />
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{raw.length.toLocaleString('vi-VN')} ký tự</span>
          <span>Phát hiện <strong className="text-primary">{splits.length}</strong> chương</span>
        </div>
      </section>

      <section className="p-6 rounded-2xl bg-surface border border-accent/10 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><BookOpen className="size-4 text-primary" /> Bước 2 — Chọn truyện đích</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs uppercase tracking-widest font-bold text-muted block mb-1">Truyện đích</span>
            <select
              value={novelId}
              onChange={(e) => {
                setNovelId(e.target.value);
                const n = novels.find((x) => x.id === e.target.value);
                if (n) setStartNumber((n.latestChapterNumber || 0) + 1);
              }}
              style={{ colorScheme: 'dark' }}
              className="w-full px-3 py-2.5 bg-background rounded-xl border border-accent/20 text-sm text-text-main"
            >
              <option value="" style={{ background: '#1a1a1a' }}>— Chọn truyện —</option>
              {novels.map((n) => (
                <option key={n.id} value={n.id} style={{ background: '#1a1a1a', color: '#fff' }}>
                  {n.title} (đã có {n.latestChapterNumber || 0} chương)
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest font-bold text-muted block mb-1">Bắt đầu từ chương số</span>
            <input
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => setStartNumber(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-background rounded-xl border border-accent/20 text-sm"
            />
          </label>
        </div>
        {selectedNovel && (
          <p className="text-[11px] text-muted">
            Sau khi dịch xong: <strong className="text-primary">{selectedNovel.title}</strong> sẽ có chương {startNumber} đến {startNumber + splits.length - 1}.
          </p>
        )}
      </section>

      <section className="p-6 rounded-2xl bg-surface border border-primary/30 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Play className="size-4 text-primary" /> Bước 3 — Chạy</h2>
        <button
          onClick={startTranslate}
          disabled={busy || !novelId || splits.length === 0}
          className="w-full h-12 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <><Loader2 className="animate-spin size-4" /> Đang dịch {progress?.current}…</> : <><Play className="size-4" /> Bắt đầu dịch & đăng</>}
        </button>
        {progress && (
          <div className="space-y-2">
            <div className="h-2 bg-background-light rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="text-xs text-muted">{progress.done}/{progress.total} chương xong</p>
          </div>
        )}
        {results.length > 0 && (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {results.map((r) => (
              <div key={r.chapterNumber} className={`flex items-center gap-2 text-xs p-2 rounded-lg ${r.ok ? 'bg-green-500/5 text-green-400' : 'bg-red-500/5 text-red-400'}`}>
                {r.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
                <span className="font-bold">Ch.{r.chapterNumber}:</span>
                <span className="truncate">{r.ok ? r.title : r.error}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted/70 text-center">
        Em dùng Gemini 2.5 Flash. ~ 8K token / chương ≈ 600đ / chương. 30 chương ≈ 18,000đ.
      </p>
    </div>
  );
}
