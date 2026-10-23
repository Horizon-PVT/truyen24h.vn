import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { processPipelineSchedule } from '@/lib/automation/schedulerService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: auth.status || 401 });
  }

  const db = adminDb();
  
  const blogRes = await processPipelineSchedule(db, 'blog');
  const storyRes = await processPipelineSchedule(db, 'story');

  return NextResponse.json({
    ok: true,
    results: {
      blog: blogRes,
      story: storyRes
    }
  });
}
