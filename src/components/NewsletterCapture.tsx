/**
 * Inline newsletter capture form.
 *
 * Use anywhere — footer, sticky banner, exit-intent popup — by passing
 * an optional `source` string. The source is stored alongside the email
 * so we can later attribute which surface converts best.
 *
 * Posts to /api/newsletter/subscribe which validates server-side and
 * persists to Firestore via Admin SDK (no auth required, see route doc).
 */
'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

interface NewsletterCaptureProps {
  source?: string;
  className?: string;
  /** Visual style — default footer-friendly inline row. */
  variant?: 'inline' | 'stacked';
  heading?: string;
  subtitle?: string;
}

export default function NewsletterCapture({
  source = 'footer',
  className,
  variant = 'inline',
  heading = 'Nhận truyện hot mỗi tuần',
  subtitle = 'Email ngắn gọn mỗi Chủ nhật — top 5 truyện mới + bonus 30 xu cho người đăng ký sớm.',
}: NewsletterCaptureProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Đăng ký thất bại');
      setDone(true);
    } catch (e: any) {
      setError(e.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={`flex items-center gap-2 text-sm text-green-400 ${className || ''}`}>
        <CheckCircle2 className="size-4" />
        <span>Cảm ơn! Em sẽ gửi truyện hot tới hộp thư của anh mỗi Chủ nhật.</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      {heading && (
        <h3 className="text-sm font-black uppercase tracking-widest text-text-main mb-1">{heading}</h3>
      )}
      {subtitle && <p className="text-xs text-muted mb-3 leading-relaxed">{subtitle}</p>}
      <div className={variant === 'inline' ? 'flex gap-2' : 'flex flex-col gap-2'}>
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@cua.anh"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background border border-accent/20 text-sm focus:outline-none focus:border-primary text-text-main placeholder:text-muted/50"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition"
        >
          {busy ? <Loader2 className="animate-spin size-4" /> : <>Đăng ký</>}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
      <p className="text-[10px] text-muted/60 mt-2">
        Em không spam. Anh huỷ đăng ký 1 click bất cứ lúc nào.
      </p>
    </form>
  );
}
