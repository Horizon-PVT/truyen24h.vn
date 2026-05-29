'use client';

/**
 * Re-usable share toolbar.
 *
 *   <ShareButtons url={canonical} title={novel.title} hashtags={['truyen24h','tienhiep']} />
 *
 * Provides:
 *   - Facebook share (sharer.php — works without app id)
 *   - X / Twitter share with prefilled tweet
 *   - Telegram share
 *   - Web Share API on mobile (single button, prefers native sheet)
 *   - Copy link to clipboard (with 2s confirmation flash)
 *
 * Why a standalone component (not inline JSX in NovelDetailView):
 *   We also mount it on /blog/[slug] and on the chapter reader header.
 *   Centralising the logic keeps share UTM tagging consistent across
 *   surfaces. Every outbound URL carries utm_source=share so we can
 *   measure which surface actually drives reshares.
 */
import { useEffect, useState } from 'react';
import { Send, Link2, Check, Share2 } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
  /** Optional text used as Twitter prefill / native share `text` field. */
  text?: string;
  hashtags?: string[];
  /** Pre-built UTM source tag — defaults to `share`. */
  utmSource?: string;
  /** Visual variant: full toolbar (default) or compact icon row. */
  variant?: 'full' | 'compact';
  /** Optional className passthrough for layout tweaks. */
  className?: string;
}

function withUtm(url: string, source: string, medium: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    u.searchParams.set('utm_campaign', 'social');
    return u.toString();
  } catch {
    // url isn't absolute (shouldn't happen — caller passes canonical URL),
    // bail out gracefully and just return what we got.
    return url;
  }
}

export default function ShareButtons({
  url,
  title,
  text,
  hashtags = [],
  utmSource = 'share',
  variant = 'full',
  className = '',
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    // navigator.share is gated by HTTPS + user activation on most browsers.
    // We only show the native button on mobile-ish UAs where the share
    // sheet adds real value over our explicit row.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      setCanNativeShare(isMobile);
    }
  }, []);

  const hashtagStr = hashtags.join(',');
  const sharePrefill = text ? `${title} — ${text}` : title;

  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    withUtm(url, utmSource, 'facebook'),
  )}`;
  const twUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
    withUtm(url, utmSource, 'twitter'),
  )}&text=${encodeURIComponent(sharePrefill)}${
    hashtagStr ? `&hashtags=${encodeURIComponent(hashtagStr)}` : ''
  }`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(
    withUtm(url, utmSource, 'telegram'),
  )}&text=${encodeURIComponent(sharePrefill)}`;

  const openShare = (target: string) => {
    // 600×500 popup keeps the user on-page; matches social-share conventions.
    if (typeof window !== 'undefined') {
      window.open(
        target,
        '_blank',
        'noopener,noreferrer,width=600,height=500',
      );
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(withUtm(url, utmSource, 'copy'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / iframes without clipboard permission.
      const ta = document.createElement('textarea');
      ta.value = withUtm(url, utmSource, 'copy');
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } finally {
        ta.remove();
      }
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title,
        text: text || title,
        url: withUtm(url, utmSource, 'native'),
      });
    } catch {
      /* user dismissed sheet — silent */
    }
  };

  const btnBase =
    variant === 'compact'
      ? 'h-10 w-10 flex items-center justify-center rounded-full border transition-all'
      : 'h-11 px-4 flex items-center justify-center gap-2 rounded-full border text-sm font-bold transition-all';

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      aria-label="Chia sẻ truyện"
    >
      {canNativeShare && (
        <button
          type="button"
          onClick={nativeShare}
          className={`${btnBase} border-primary/40 text-primary bg-primary/5 hover:bg-primary/10`}
          aria-label="Chia sẻ"
        >
          <Share2 className="size-4" />
          {variant === 'full' && <span>Chia sẻ</span>}
        </button>
      )}
      <button
        type="button"
        onClick={() => openShare(fbUrl)}
        className={`${btnBase} border-blue-500/30 text-blue-500 hover:bg-blue-500/10`}
        aria-label="Chia sẻ Facebook"
        title="Facebook"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z"/></svg>
        {variant === 'full' && <span>Facebook</span>}
      </button>
      <button
        type="button"
        onClick={() => openShare(twUrl)}
        className={`${btnBase} border-sky-400/30 text-sky-400 hover:bg-sky-400/10`}
        aria-label="Chia sẻ X / Twitter"
        title="X"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2H21l-6.49 7.41L22 22h-6.797l-4.79-6.262L4.8 22H2l6.94-7.93L2 2h6.914l4.33 5.722L18.244 2Zm-1.184 18h1.81L7.05 4H5.106L17.06 20Z"/></svg>
        {variant === 'full' && <span>X</span>}
      </button>
      <button
        type="button"
        onClick={() => openShare(tgUrl)}
        className={`${btnBase} border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10`}
        aria-label="Chia sẻ Telegram"
        title="Telegram"
      >
        <Send className="size-4" />
        {variant === 'full' && <span>Telegram</span>}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className={`${btnBase} ${
          copied
            ? 'border-green-500/50 text-green-500 bg-green-500/10'
            : 'border-accent/20 text-muted hover:text-text-main hover:border-accent/40'
        }`}
        aria-label="Sao chép liên kết"
        title="Sao chép liên kết"
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
        {variant === 'full' && <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>}
      </button>
    </div>
  );
}
