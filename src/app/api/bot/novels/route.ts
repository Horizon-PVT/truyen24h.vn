import { NextRequest, NextResponse } from 'next/server';
import { authorizeBot } from '@/lib/apiAuth';
import { adminDb, serverTimestamp } from '@/lib/firebaseAdmin';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function mapDocToNovel(id: string, data: any) {
  return {
    id,
    title: data.title || '',
    author: data.author || '',
    description: data.description || '',
    genres: data.genres || [],
    totalChapters: data.totalChapters || data.chapters?.length || 0,
    views: data.views || 0,
    rating: data.rating || 5,
    status: data.status || 'ongoing',
    coverUrl: data.coverUrl || '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.lastUpdated || null,
    url: `${getSiteUrl()}/truyen/${id}`,
  };
}

// GET /api/bot/novels - List & search novels
export async function GET(req: NextRequest) {
  const auth = await authorizeBot(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').toLowerCase().trim();
    const genre = (searchParams.get('genre') || '').toLowerCase().trim();
    const limitCount = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

    let novels: any[] = [];

    try {
      const db = adminDb();
      const snapshot = await db.collection('novels').limit(limitCount).get();
      novels = snapshot.docs.map(doc => mapDocToNovel(doc.id, doc.data()));
    } catch {
      // Fallback to client SDK if service account is not yet configured
      const { db } = await import('@/firebase');
      const { collection, query, limit, getDocs } = await import('firebase/firestore');
      const qRef = query(collection(db, 'novels'), limit(limitCount));
      const snapshot = await getDocs(qRef);
      novels = snapshot.docs.map(doc => mapDocToNovel(doc.id, doc.data()));
    }

    if (q) {
      novels = novels.filter(n => n.title.toLowerCase().includes(q) || n.author.toLowerCase().includes(q));
    }

    if (genre) {
      novels = novels.filter(n => (n.genres as string[]).some(g => g.toLowerCase().includes(genre)));
    }

    return NextResponse.json({
      ok: true,
      total: novels.length,
      data: novels,
    });
  } catch (error: any) {
    console.error('Bot API novels GET error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}

// POST /api/bot/novels - Create or update a novel
export async function POST(req: NextRequest) {
  const auth = await authorizeBot(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      author,
      description,
      genres = ['Khác'],
      coverUrl = '/logo.jpg',
      status = 'ongoing',
      tags = [],
      slug: explicitSlug,
    } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ ok: false, error: 'Thiếu hoặc sai trường title' }, { status: 400 });
    }

    const novelSlug = explicitSlug || slugify(title);
    if (!novelSlug) {
      return NextResponse.json({ ok: false, error: 'Không thể tạo slug từ title' }, { status: 400 });
    }

    const db = adminDb();
    const novelRef = db.collection('novels').doc(novelSlug);
    const existing = await novelRef.get();

    const novelData: Record<string, any> = {
      title: title.trim(),
      author: (author || 'Sưu tầm').trim(),
      description: (description || title).trim(),
      genres: Array.isArray(genres) ? genres : [genres],
      coverUrl: coverUrl || '/logo.jpg',
      status: status === 'completed' ? 'completed' : 'ongoing',
      tags: Array.isArray(tags) ? tags : [],
      isPublic: true,
      approvalStatus: 'approved',
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists) {
      novelData.createdAt = serverTimestamp();
      novelData.totalChapters = 0;
      novelData.views = 0;
      novelData.rating = 5.0;
      novelData.bookmarks = 0;
      novelData.authorId = 'bot-importer';
      await novelRef.set(novelData);
    } else {
      await novelRef.set(novelData, { merge: true });
    }

    return NextResponse.json({
      ok: true,
      novel: {
        id: novelSlug,
        slug: novelSlug,
        title: novelData.title,
        url: `${getSiteUrl()}/truyen/${novelSlug}`,
        isCreated: !existing.exists,
      },
    });
  } catch (error: any) {
    console.error('Bot API novels POST error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
