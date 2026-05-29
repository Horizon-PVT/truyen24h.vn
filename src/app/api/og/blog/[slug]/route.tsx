/**
 * Dynamic Open Graph image for a blog post.
 *
 *   GET /api/og/blog/[slug]  →  1200×630 PNG
 *
 * Similar approach to /api/og/novel but tuned for editorial content:
 *   - Larger title area, no cover thumbnail (blog posts are text-first)
 *   - Tag pills + reading time
 *   - "Bài viết · Truyen24h.vn" branding
 *
 * Cached 12h.
 */
import { ImageResponse } from 'next/og';
import { adminDb } from '@/lib/firebaseAdmin';
import { SITE_NAME } from '@/lib/site';

export const runtime = 'nodejs';
export const revalidate = 43200;
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

async function fetchPost(slug: string) {
  try {
    const snap = await adminDb().collection('blog_posts').doc(slug).get();
    if (!snap.exists) return null;
    return snap.data() as any;
  } catch (err) {
    console.error('OG: failed to fetch blog post', slug, err);
    return null;
  }
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);

  const title = truncate(post?.title || 'Bài viết hay đang chờ bạn', 120);
  const excerpt = truncate(post?.excerpt || '', 180);
  const tags: string[] = Array.isArray(post?.tags) ? post.tags.slice(0, 4) : [];
  const readMin: number = Number(post?.estimatedReadMinutes || 0);
  const kind: string = post?.kind === 'review' ? 'Review' : post?.kind === 'listicle' ? 'Top list' : 'Bài viết';

  let titleSize = 64;
  if (title.length > 60) titleSize = 54;
  if (title.length > 90) titleSize = 44;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'linear-gradient(135deg, #0f0c29 0%, #302b63 45%, #24243e 100%)',
          padding: 64,
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #ff6b9d 0%, #ff4757 100%)',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            T
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 1.1,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 800 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 16, opacity: 0.7 }}>{kind} · Blog</div>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {readMin > 0 ? `⏱ ${readMin} phút đọc` : '✨ Mới'}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 48,
            flex: 1,
          }}
        >
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {tags.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,107,157,0.18)',
                    border: '1px solid rgba(255,107,157,0.35)',
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  #{t}
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: -1,
              display: 'flex',
              maxHeight: 280,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          {excerpt && (
            <div
              style={{
                marginTop: 24,
                fontSize: 22,
                opacity: 0.75,
                lineHeight: 1.45,
                display: '-webkit-box',
                maxHeight: 130,
                overflow: 'hidden',
              }}
            >
              {excerpt}
            </div>
          )}
        </div>

        {/* CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '18px 26px',
            borderRadius: 18,
            background:
              'linear-gradient(90deg, rgba(255,107,157,0.25) 0%, rgba(255,71,87,0.18) 100%)',
            border: '1px solid rgba(255,107,157,0.4)',
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          📖 Đọc full bài tại truyen24h.vn/blog
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control':
          'public, immutable, no-transform, max-age=43200, s-maxage=43200',
      },
    },
  );
}
