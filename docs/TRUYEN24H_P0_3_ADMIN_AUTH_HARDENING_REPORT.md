# Truyen24h P0.3 Admin Auth Hardening Report

Date: 2026-06-03

## What Changed

- `authorizeAdmin` in `src/lib/apiAuth.ts` is now asynchronous.
- Admin API authorization no longer trusts `x-admin-email`.
- Admin API authorization now supports:
  - server-to-server machine auth using `ADMIN_API_TOKEN`;
  - verified Firebase ID token auth using `Authorization: Bearer <Firebase ID token>`.
- Verified Firebase admin users are checked against a server-only allowlist.
- Admin UI callers in AI Studio and Blog Manager now send Firebase ID tokens in
  `Authorization` headers instead of `x-admin-email`.
- Admin and AI API routes that call `authorizeAdmin` now await the helper and
  preserve 401/403 response status.

## Insecure Behavior Removed

- `x-admin-email` no longer grants admin access.
- Request body, query string, public headers, and client-side email values are
  not used as proof of admin identity.
- `NEXT_PUBLIC_ADMIN_EMAILS` is not used by `authorizeAdmin` for secure server
  authorization.

## Admin Auth Modes That Remain

1. Machine auth:
   - `x-admin-token: <ADMIN_API_TOKEN>`
   - `Authorization: Bearer <ADMIN_API_TOKEN>`
   - Intended only for server/cron/admin automation calls.

2. Firebase admin user auth:
   - `Authorization: Bearer <Firebase ID token>`
   - Server verifies the token with Firebase Admin SDK.
   - Server derives the trusted email from the decoded token.
   - Server checks the trusted email against `ADMIN_EMAILS` or
     `ADMIN_ALLOWED_EMAILS`.

## Required Env Vars

- `ADMIN_API_TOKEN`: optional machine token for server-to-server automation.
- `ADMIN_EMAILS`: preferred comma-separated server-only admin email allowlist.
- `ADMIN_ALLOWED_EMAILS`: fallback comma-separated server-only admin email
  allowlist.
- `FIREBASE_SERVICE_ACCOUNT_JSON` or valid Google application credentials:
  required for Firebase Admin SDK token verification.

If neither `ADMIN_EMAILS` nor `ADMIN_ALLOWED_EMAILS` is configured, the Firebase
admin-user path fails closed. Machine token auth can still work if
`ADMIN_API_TOKEN` is configured.

## Compatibility Risk

- Existing admin UI sessions must be logged in and able to retrieve a Firebase
  ID token.
- Server env must define `ADMIN_EMAILS` or `ADMIN_ALLOWED_EMAILS` for Firebase
  admin-user API calls to succeed.
- Existing clients that still send only `x-admin-email` will now receive 401.
- `src/lib/admin.ts` still uses `NEXT_PUBLIC_ADMIN_EMAILS` for UI display/gating.
  That is not secure server authorization and should be treated only as a UI
  hint until P0.3 follow-up cleanup or P0.4/P0.8 work.

## Routes Affected Through `authorizeAdmin`

- `src/app/api/admin/daily-run/route.ts`
- `src/app/api/admin/generate-blog-post/route.ts`
- `src/app/api/admin/publish-chapter/route.ts`
- `src/app/api/admin/publish-novel/route.ts`
- `src/app/api/ai/generate-chapter/route.ts`
- `src/app/api/ai/generate-novel/route.ts`

`src/app/api/admin/daily-run-cron/route.ts` keeps its existing bearer-token
cron path and does not use `authorizeAdmin`.

## Validation Results

- `npx.cmd eslint src/lib/apiAuth.ts`: pass.
- `npm.cmd run lint`: fails with the known baseline lint debt,
  88 errors / 89 warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

The full-project lint failure count did not increase from the documented
baseline of 88 errors.

## Next Recommended Task

P0.4 Sensitive user route hardening: migrate user-sensitive money/account flows
to verified Firebase ID token routes without trusting body-provided `uid`,
`buyerId`, `donorId`, `authorId`, `amount`, `coins`, or `price`.
