/**
 * API-route auth helpers.
 *
 * Secure admin calls support:
 *   1. Machine auth: ADMIN_API_TOKEN via `x-admin-token` or
 *      `Authorization: Bearer <ADMIN_API_TOKEN>`.
 *   2. Firebase admin user auth: verified Firebase ID token in Authorization,
 *      then server-only email allowlist via ADMIN_EMAILS / ADMIN_ALLOWED_EMAILS.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from './firebaseAdmin';

export interface AuthResult {
  ok: boolean;
  reason?: string;
  status?: 401 | 403;
  via?: 'token' | 'firebase';
  email?: string;
  uid?: string;
}

function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getServerAdminEmails(): Set<string> {
  const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
  if (adminEmails.size > 0) return adminEmails;
  return parseEmailList(process.env.ADMIN_ALLOWED_EMAILS);
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;

  const parts = authorization.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return null;
  }

  return parts[1];
}

export async function authorizeAdmin(req: NextRequest): Promise<AuthResult> {
  const expectedMachineToken = process.env.ADMIN_API_TOKEN;
  const headerMachineToken = req.headers.get('x-admin-token');
  if (headerMachineToken && expectedMachineToken && headerMachineToken === expectedMachineToken) {
    return { ok: true, via: 'token' };
  }

  const bearerToken = getBearerToken(req);
  if (bearerToken && expectedMachineToken && bearerToken === expectedMachineToken) {
    return { ok: true, via: 'token' };
  }

  const auth = await requireFirebaseUser(req);
  if (!auth.ok) {
    return { ok: false, reason: 'Unauthorized', status: 401 };
  }

  const trustedEmail = auth.user.email?.toLowerCase();
  const serverAdminEmails = getServerAdminEmails();
  if (!trustedEmail || !serverAdminEmails.has(trustedEmail)) {
    return { ok: false, reason: 'Forbidden', status: 403 };
  }

  return {
    ok: true,
    via: 'firebase',
    email: trustedEmail,
    uid: auth.user.uid,
  };
}

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  claims: Record<string, unknown>;
};

export type FirebaseUserAuthResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: Response };

function unauthorized(message = 'Unauthorized'): Response {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function requireFirebaseUser(request: Request): Promise<FirebaseUserAuthResult> {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, response: unauthorized('Missing or invalid Authorization header') };
  }

  try {
    // Ensure the shared Firebase Admin app is initialized before using Auth.
    adminDb();
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    const { uid, email } = decoded;

    if (!uid) {
      return { ok: false, response: unauthorized() };
    }

    return {
      ok: true,
      user: {
        uid,
        email,
        claims: { ...decoded },
      },
    };
  } catch {
    return { ok: false, response: unauthorized('Invalid or expired Firebase ID token') };
  }
}
