/**
 * Dynamic Open Graph image for a novel page.
 *
 *   GET /api/og/novel/[slug]  →  1200×630 PNG
 *
 * The result is cached for 12 hours (revalidate = 43200) so a single novel
 * with 10k shares only re-renders the image twice a day. The route uses
 * `next/og` ImageResponse which runs on the Node runtime in Next 16 with
 * Satori under the hood — we pass a JSX tree, it gives us a PNG.
 *
 * Why not just use the static cover URL?
 *   - Cover images are 800×600 portraits with no branding. Facebook/X crop
 *     them oddly and never show our brand or title text.
 *   - Twitter Card validator and FB sharing debugger both reward 1200×630.
 *   - We embed CTA "Đọc miễn phí 2 chương đầu" so every share converts.
 */
import { ImageResponse } from 'next/og';
import { adminDb } from '@/lib/firebaseAdmin';
import { SITE_NAME } from '@/lib/site';

export const runtime = 'nodejs';
export const revalidate = 43200; // 12h
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

async function fetchNovel(slug: string) {
  try {
    const snap = await adminDb().collection('novels').doc(slug).get();
    if (!snap.exists) return null;
    return snap.data() as any;
  } catch (err) {
    console.error('OG: failed to fetch novel', slug, err);
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
  const novel = await fetchNovel(slug);

  // Even if we can't find the novel we still want SOMETHING shareable instead
  // of a 404 surfacing in social previews. Fall back to brand card.
  const title = truncate(novel?.title || 'Truyện hay đang chờ bạn', 80);
  const author = truncate(novel?.author || 'Tác giả ẩn danh', 40);
  const chapterCount: number = Number(novel?.chapterCount || novel?.chapters?.length || 0);
  const genres: string[] = Array.isArray(novel?.genres) ? novel.genres.slice(0, 3) : [];
  const isHot = Boolean(novel?.isHot || (novel?.views && novel.views > 10_000));
  const cover: string | undefined = novel?.coverUrl;
  const description = truncate(novel?.description || '', 140);

  // Title size scales down for long titles so the card stays readable.
  let titleFontSize = 78;
  if (title.length > 30) titleFontSize = 64;
  if (title.length > 48) titleFontSize = 52;
  if (title.length > 64) titleFontSize = 44;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          background:
            'linear-gradient(135deg, #1a0b2e 0%, #16213e 45%, #0f3460 100%)',
          padding: 56,
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Cover image left */}
        <div
          style={{
            display: 'flex',
            width: 340,
            height: 510,
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            border: '4px solid rgba(255,255,255,0.15)',
            flexShrink: 0,
          }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              width={340}
              height={510}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%)',
                fontSize: 96,
              }}
            >
              📖
            </div>
          )}
        </div>

        {/* Right column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            paddingLeft: 48,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: 18,
                background:
                  'linear-gradient(135deg, #ff6b9d 0%, #ff4757 100%)',
                fontSize: 32,
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
              <div style={{ fontSize: 16, opacity: 0.7 }}>
                Đọc truyện online · Truyện VIP
              </div>
            </div>

            {isHot && (
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 18px',
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, #ff4757 0%, #ff6348 100%)',
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: 2,
                }}
              >
                🔥 HOT
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 24,
            }}
          >
            {genres.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                {genres.map((g, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    {g}
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                fontSize: titleFontSize,
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: -1,
                display: 'flex',
                maxHeight: 260,
                overflow: 'hidden',
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 22,
                opacity: 0.85,
                display: 'flex',
                gap: 18,
                alignItems: 'center',
              }}
            >
              <span>✍️ {author}</span>
              {chapterCount > 0 && <span>· 📚 {chapterCount} chương</span>}
            </div>
            {description && (
              <div
                style={{
                  marginTop: 14,
                  fontSize: 18,
                  opacity: 0.7,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  maxHeight: 80,
                  overflow: 'hidden',
                }}
              >
                {description}
              </div>
            )}
          </div>

          {/* CTA strip */}
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
            ⚡ Đọc miễn phí 2 chương đầu trên truyen24h.vn
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // Long cache for shares; mutation tools can bust via /api/og/novel/[slug]?v=
      headers: {
        'Cache-Control':
          'public, immutable, no-transform, max-age=43200, s-maxage=43200',
      },
    },
  );
}
