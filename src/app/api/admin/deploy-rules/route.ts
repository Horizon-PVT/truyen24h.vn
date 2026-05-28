/**
 * GET /api/admin/deploy-rules?token=<ADMIN_API_TOKEN>
 *
 * Pushes the firestore.rules file in this repo to Firebase Console
 * (cloud.firestore release). This lets the admin update rules with
 * a single URL click instead of copy-pasting into the Console after
 * every PR.
 *
 * Why this exists:
 *   The deploy-rules npm script is great for CI/local dev, but
 *   requires the operator to have FIREBASE_SERVICE_ACCOUNT_JSON on
 *   their machine. Owners running from a phone or away from their
 *   laptop just need ONE clickable URL. This route uses the env var
 *   Vercel already has (matching the one our other admin routes
 *   use) so there's no extra setup.
 *
 * Auth: ?token= must match ADMIN_API_TOKEN env var, OR header
 * x-admin-email must be a whitelisted admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

function readRulesFile(): string {
  // On Vercel, the deployment includes all files at process.cwd() during
  // function init. Try a few likely paths.
  const candidates = [
    path.join(process.cwd(), 'firestore.rules'),
    path.join(process.cwd(), '..', 'firestore.rules'),
    path.join(process.cwd(), '..', '..', 'firestore.rules'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  throw new Error('firestore.rules not found in deployment bundle');
}

async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope:
      'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: any) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const signingInput = `${enc(header)}.${enc(claim)}`;
  const privateKey = String(sa.private_key).replace(/\\n/g, '\n');
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const jwt = `${signingInput}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const tokenData: any = await tokenResp.json();
  if (!tokenResp.ok) {
    throw new Error('Token exchange failed: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

export async function GET(req: NextRequest) {
  // Auth: query token OR admin email header
  const qToken = req.nextUrl.searchParams.get('token');
  const adminToken = process.env.ADMIN_API_TOKEN;
  const headerEmail = req.headers.get('x-admin-email');
  const ok =
    (qToken && adminToken && qToken === adminToken) ||
    (headerEmail && isAdmin(headerEmail));
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!saRaw) {
      return NextResponse.json(
        { error: 'FIREBASE_SERVICE_ACCOUNT_JSON env var not set on Vercel' },
        { status: 500 }
      );
    }
    let sa: any;
    try {
      sa = JSON.parse(saRaw.trim().replace(/^['"]|['"]$/g, ''));
    } catch (e: any) {
      return NextResponse.json(
        { error: 'FIREBASE_SERVICE_ACCOUNT_JSON not valid JSON: ' + e.message },
        { status: 500 }
      );
    }

    const rulesText = readRulesFile();
    const projectId = sa.project_id;
    const accessToken = await getAccessToken(sa);

    // 1) Create ruleset
    const createResp = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          source: { files: [{ name: 'firestore.rules', content: rulesText }] },
        }),
      }
    );
    const createData: any = await createResp.json();
    if (!createResp.ok) {
      return NextResponse.json(
        { error: 'Create ruleset failed', detail: createData },
        { status: 500 }
      );
    }
    const rulesetName = createData.name;

    // 2) Update release pointer (PATCH; fall back to POST if release doesn't exist)
    let releaseResp = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
      {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          release: {
            name: `projects/${projectId}/releases/cloud.firestore`,
            rulesetName,
          },
        }),
      }
    );
    if (!releaseResp.ok) {
      releaseResp = await fetch(
        `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            name: `projects/${projectId}/releases/cloud.firestore`,
            rulesetName,
          }),
        }
      );
    }
    const releaseData: any = await releaseResp.json();
    if (!releaseResp.ok) {
      return NextResponse.json(
        { error: 'Release failed', detail: releaseData },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      projectId,
      rulesetName,
      bytes: rulesText.length,
      message: '✅ Firestore rules deployed and live.',
    });
  } catch (err: any) {
    console.error('[deploy-rules] error', err);
    return NextResponse.json({ error: err.message || 'Deploy failed' }, { status: 500 });
  }
}
