import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebaseAdmin';
import { executeAutomationRun } from '@/lib/automation/runService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status || 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { pipeline, topic, idempotencyKey } = body;

  if (pipeline !== 'blog' && pipeline !== 'story') {
    return NextResponse.json(
      { error: 'Invalid pipeline. Must be "blog" or "story".' },
      { status: 400 }
    );
  }

  if (typeof topic !== 'string' || !topic.trim()) {
    return NextResponse.json(
      { error: 'Missing or invalid "topic" parameter.' },
      { status: 400 }
    );
  }

  // Validate idempotencyKey if provided by client (Server-generated is preferred, but we accept client keys if valid)
  if (idempotencyKey !== undefined) {
    if (typeof idempotencyKey !== 'string' || !/^[a-f0-9]{32,64}$/.test(idempotencyKey)) {
      return NextResponse.json(
        { error: 'Invalid idempotencyKey format. Must be 32-64 hex characters.' },
        { status: 400 }
      );
    }
  }

  const db = adminDb();
  const requestedBy = auth.email || auth.uid || 'admin';

  const result = await executeAutomationRun(db, {
    pipeline,
    topic: topic.trim(),
    trigger: 'MANUAL',
    requestedBy,
    providedIdempotencyKey: idempotencyKey,
  });

  if (!result.ok) {
    let statusCode = 500;
    if (result.errorCode === 'AUTOMATION_INVALID_INPUT') statusCode = 400;
    else if (result.errorCode === 'AUTOMATION_DUPLICATE_REQUEST' || result.errorCode === 'AUTOMATION_DUPLICATE_CONTENT' || result.errorCode === 'AUTOMATION_DAILY_CAP_REACHED') statusCode = 409;
    else if (result.errorCode === 'AUTOMATION_EMERGENCY_STOP' || result.errorCode === 'AUTOMATION_PIPELINE_DISABLED' || result.errorCode === 'AUTOMATION_MODE_NOT_ALLOWED' || result.errorCode === 'AUTOMATION_SETTINGS_MISSING') statusCode = 423;

    // The reason is already sanitized by runService
    return NextResponse.json(
      {
        error: result.reason,
        errorCode: result.errorCode,
        matchedId: result.matchedId || null,
        runId: result.runId || null,
      },
      { status: statusCode }
    );
  }

  return NextResponse.json(result, { status: 201 });
}
