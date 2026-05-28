/**
 * Deploy Firestore Rules programmatically — no Firebase CLI needed.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
 *   node scripts/deploy-firestore-rules.mjs
 *
 * OR put the JSON in a file and run:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json \
 *   node scripts/deploy-firestore-rules.mjs
 *
 * Reads ./firestore.rules and pushes it to the live project.
 *
 * Requires the service account to have one of these roles:
 *   - Firebase Rules Admin
 *   - Project Editor
 *   - Firestore Admin
 * (Default service account from Firebase Console > Service Accounts
 * generally has Firebase Rules Admin automatically.)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (raw && raw.trim()) {
    try {
      return JSON.parse(raw.trim().replace(/^['"]|['"]$/g, ''));
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ' + e.message);
    }
  }
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  // Last resort: read from .env.local
  const envLocal = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocal)) {
    const text = fs.readFileSync(envLocal, 'utf-8');
    const m = text.match(/^FIREBASE_SERVICE_ACCOUNT_JSON=(.+)$/m);
    if (m && m[1].trim() && m[1].trim() !== '') {
      try { return JSON.parse(m[1].trim()); } catch { /* ignore */ }
    }
  }
  throw new Error(
    'Service account credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH or paste the JSON into .env.local at the FIREBASE_SERVICE_ACCOUNT_JSON= line.'
  );
}

/**
 * Build + sign a Google OAuth2 JWT, then exchange for an access token.
 * We do this manually (no googleapis lib) to keep the script
 * dependency-free.
 */
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (o) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const signingInput = `${enc(header)}.${enc(claim)}`;
  const privateKey = sa.private_key.replace(/\\n/g, '\n');
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
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) throw new Error('Token exchange failed: ' + JSON.stringify(tokenData));
  return tokenData.access_token;
}

async function main() {
  console.log('▶ Reading firestore.rules ...');
  const rulesText = fs.readFileSync(RULES_PATH, 'utf-8');
  console.log(`   ${rulesText.length} bytes loaded`);

  console.log('▶ Loading service account credentials ...');
  const sa = readServiceAccount();
  const projectId = sa.project_id;
  console.log(`   project = ${projectId}`);

  console.log('▶ Getting access token ...');
  const accessToken = await getAccessToken(sa);

  console.log('▶ Creating ruleset ...');
  const createResp = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: {
          files: [{ name: 'firestore.rules', content: rulesText }],
        },
      }),
    }
  );
  const createData = await createResp.json();
  if (!createResp.ok) {
    throw new Error('Create ruleset failed: ' + JSON.stringify(createData));
  }
  const rulesetName = createData.name; // projects/{p}/rulesets/{id}
  console.log(`   created ${rulesetName}`);

  console.log('▶ Releasing as cloud.firestore ...');
  // Try UPDATE first (most common case where a release already exists)
  let releaseResp = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    {
      method: 'PATCH',
      headers: {
        'authorization': `Bearer ${accessToken}`,
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
    // Fall back to CREATE if release doesn't exist yet.
    releaseResp = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: `projects/${projectId}/releases/cloud.firestore`,
          rulesetName,
        }),
      }
    );
  }
  const releaseData = await releaseResp.json();
  if (!releaseResp.ok) {
    throw new Error('Release failed: ' + JSON.stringify(releaseData));
  }

  console.log('✅ Rules deployed and live on', projectId);
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
