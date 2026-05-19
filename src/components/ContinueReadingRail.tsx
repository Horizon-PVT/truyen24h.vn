/**
 * 'Tiếp tục đọc' horizontal rail shown on the homepage to logged-in
 * users. Fetches the last 10 in-progress novels via
 * /api/reading/continue and renders a click-to-resume card per item.
 *
 * Silently renders nothing for guests or users with no history.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, History, Sparkles } from 'lucide-react';

interface Item {
  novelId: string;
  title: string;
  coverUrl?: string;
  lastChapterId: string;
  lastChapterNumber: number;
  latestChapterNumber: number;
  unreadCount: number;
}

export default function ContinueReadingRail() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/reading/continue?uid=${encodeURIComponent(user.uid)}&limit=10`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || (!loading && items.length === 0)) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <History className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Tiếp tục đọc</h2>
            <p className="text-xs text-muted">Anh đang đọc dở những truyện này</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 snap-x snap-mandatory">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="snap-start shrink-0 w-[260px] h-[140px] rounded-2xl bg-surface animate-pulse" />
            ))
          : items.map((it) => {
              const hasNew = it.unreadCount > 0;
              return (
                <Link
                  key={it.novelId}
                  href={`/doc/${it.novelId}/${it.lastChapterId}`}
                  className="snap-start shrink-0 w-[280px] group bg-surface rounded-2xl border border-accent/10 hover:border-primary/40 overflow-hidden transition flex"
                >
                  {it.coverUrl ? (
                    <div className="w-[88px] aspect-[2/3] shrink-0 overflow-hidden bg-background">
                      <img src={it.coverUrl} alt={it.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    </div>
                  ) : (
                    <div className="w-[88px] aspect-[2/3] shrink-0 bg-primary/10 flex items-center justify-center">
                      <BookOpen className="size-7 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
                    <h3 className="font-bold text-sm line-clamp-2 group-hover:text-primary transition-colors">{it.title}</h3>
                    <div>
                      <div className="text-[11px] text-muted">Đọc dở chương {it.lastChapterNumber}</div>
                      {hasNew && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-primary/15 text-primary">
                          <Sparkles className="size-3" /> +{it.unreadCount} chương mới
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
