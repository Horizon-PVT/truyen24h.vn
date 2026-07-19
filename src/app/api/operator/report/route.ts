import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });
  }

  try {
    const db = adminDb();
    const snap = await db.collection('operator_drafts').get();
    
    let totalDrafts = 0;
    const byStatus: Record<string, number> = {
      DRAFT: 0,
      NEEDS_FIX: 0,
      NEEDS_REVIEW: 0,
      APPROVED: 0,
      PUBLISHED: 0,
      REJECTED: 0,
    };
    const byType: Record<string, number> = {
      story: 0,
      chapter: 0,
      blog: 0,
    };
    const bySource: Record<string, number> = {};
    
    let totalQualityScore = 0;
    let draftsWithScoreCount = 0;
    let totalBlockers = 0;
    let totalWarnings = 0;

    snap.forEach((doc: any) => {
      totalDrafts++;
      const data = doc.data();
      
      // Status count
      const status = data.status || 'DRAFT';
      byStatus[status] = (byStatus[status] || 0) + 1;

      // Type count
      const type = data.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;

      // Source count
      const source = data.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;

      // Quality gate metrics
      const report = data.qualityReport;
      if (report) {
        if (typeof report.score === 'number') {
          totalQualityScore += report.score;
          draftsWithScoreCount++;
        }
        if (Array.isArray(report.blockers)) {
          totalBlockers += report.blockers.length;
        }
        if (Array.isArray(report.warnings)) {
          totalWarnings += report.warnings.length;
        }
      }
    });

    const averageQualityScore = draftsWithScoreCount > 0 
      ? Math.round((totalQualityScore / draftsWithScoreCount) * 10) / 10 
      : 0;

    // Fetch review counts
    const reviewsSnap = await db.collection('operator_reviews').get();
    const reviewsCount = reviewsSnap.size;

    // Fetch publish logs count
    const publishSnap = await db.collection('operator_publish_logs').get();
    const publishCount = publishSnap.size;

    // Fetch rollback logs count
    const rollbackSnap = await db.collection('operator_rollback_logs').get();
    const rollbackCount = rollbackSnap.size;

    return NextResponse.json({
      ok: true,
      metrics: {
        totalDrafts,
        byStatus,
        byType,
        bySource,
        averageQualityScore,
        totalBlockers,
        totalWarnings,
        reviewsCount,
        publishCount,
        rollbackCount,
      }
    });

  } catch (err: any) {
    console.error('[operator/report] error', err);
    return NextResponse.json({ error: err.message || 'Failed to generate report' }, { status: 500 });
  }
}
