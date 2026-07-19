# Truyen24h P0.8 Security Smoke Tests Report

Date: 2026-06-04 17:17:17 +07:00

## Files Changed

- `scripts/security-smoke-tests/security-smoke.mjs`
- `docs/TRUYEN24H_P0_8_SECURITY_SMOKE_TESTS_REPORT.md`

No runtime code, business logic, UI, Firestore rules, deployment config,
environment file, payment secret, or package dependency was changed.

## Smoke Tests Added

Added an offline Node.js smoke script:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
```

The script reads source files and Firestore rules, then verifies the P0 security
contracts that can be checked without live Firebase tokens, PayOS secrets,
Firestore emulator, or production data.

## Automated Coverage

The smoke script currently checks 10 security contracts:

- Admin auth:
  - `authorizeAdmin` exists.
  - admin route calls `await authorizeAdmin(req)`.
  - Firebase ID token path exists through `requireFirebaseUser`.
  - server machine token path remains documented in code through
    `ADMIN_API_TOKEN` and `x-admin-token`.
  - `x-admin-email` is not accepted by `src/lib/apiAuth.ts`.
  - `NEXT_PUBLIC_ADMIN_EMAILS` is not used by `src/lib/apiAuth.ts` for secure
    server auth.
- User-sensitive routes:
  - `/api/checkin/claim` uses `requireFirebaseUser`.
  - `/api/missions/progress` uses `requireFirebaseUser`.
  - `/api/missions/claim` uses `requireFirebaseUser`.
  - `/api/bookmark/toggle` uses `requireFirebaseUser`.
  - `/api/withdraw/request` uses `requireFirebaseUser`.
  - each selected route derives `uid` from `auth.user.uid`.
  - selected routes do not use `body.uid` or `body.email`.
- PayOS create:
  - uses `requireFirebaseUser`.
  - accepts only `packId` in the request body type.
  - derives `uid`, package amount, coins, monthly status, order code, return URL,
    and cancel URL server-side.
  - does not use `body.uid`, `body.amount`, `body.coins`, `body.orderCode`,
    `body.isMonthly`, `body.returnUrl`, or `body.cancelUrl`.
- PayOS webhook:
  - verifies PayOS signature before trusting webhook data.
  - compares paid amount against server-stored order amount.
  - records amount mismatch without crediting.
  - handles already paid orders idempotently.
  - credits based on server-stored order fields inside a transaction.
- Unlock chapter:
  - uses `requireFirebaseUser`.
  - derives buyer from `auth.user.uid`.
  - reads novel/chapter data server-side.
  - derives price and payout recipient server-side.
  - checks already-unlocked and active-VIP paths.
  - uses deterministic transaction id for idempotency.
  - does not use `body.buyerId`, `body.uid`, `body.authorId`,
    `body.chapterPrice`, `body.coins`, or `body.amount`.
- Firestore rules:
  - safe user create/update allowlists exclude money/VIP/unlock/admin/reward
    fields.
  - `orders`, `transactions`, `withdraw_requests`, `payment_logs`, and
    `platform_revenue` are client-write denied.
  - public read rules for novels/chapters/blog are still present.
  - final catch-all rule fails closed.

## Manual Coverage Still Required

These cases need a running app, Firebase Auth test users, Firebase Admin
credentials, PayOS test credentials, or Firestore emulator. They are not run by
the offline script:

### Admin Auth Manual Smoke

- Start the app locally with valid Firebase/Admin env.
- POST an admin route with only `x-admin-email`; expect 401.
- POST an admin route without auth; expect 401.
- POST an admin route with `Authorization: Bearer invalid-token`; expect 401.
- POST with valid non-admin Firebase ID token; expect 403.
- POST with valid admin Firebase ID token and server allowlist; expect success.
- POST with `x-admin-token: <ADMIN_API_TOKEN>` from a controlled server context;
  expect success only when the token matches the server env.

### User-Sensitive Routes Manual Smoke

For each route:

- `/api/checkin/claim`
- `/api/missions/progress`
- `/api/missions/claim`
- `/api/bookmark/toggle`
- `/api/withdraw/request`

Check:

- missing `Authorization` returns 401.
- body with only `uid` returns 401.
- valid Firebase token for user A plus forged `body.uid` for user B cannot write
  user B data.
- route writes target only the verified Firebase uid.

### PayOS Create Manual Smoke

- Missing Firebase ID token returns 401.
- Valid token plus forged `uid`, `amount`, `coins`, `orderCode`, `isMonthly`,
  `returnUrl`, or `cancelUrl` still creates the server-selected pack from
  `packId` only.
- Unknown `packId` returns 400.
- Returned checkout URLs are derived from trusted site URL config.

### PayOS Webhook Manual Smoke

- Invalid signature returns 400 and does not credit coins/VIP.
- Valid signature with paid amount not matching `orders/{orderCode}.amount`
  records mismatch and does not credit.
- Duplicate valid paid webhook for an already `PAID` order returns idempotent
  success and does not double-credit.
- Webhook credits coins/VIP only from server-stored order fields.

### Unlock Chapter Manual Smoke

- Missing Firebase ID token returns 401.
- Valid token plus forged `buyerId`, `uid`, `chapterPrice`, `authorId`, `coins`,
  or `amount` does not affect the charge.
- Already unlocked chapter returns success without another deduction.
- Free chapter does not deduct coins.
- Active monthly VIP path does not deduct coins where current business logic
  allows VIP coverage.
- Author payout recipient comes from server-side chapter/novel data.

### Firestore Rules Manual Smoke

Use Firestore emulator or owner-approved rules test environment. Do not deploy
rules automatically.

- Client cannot write `users/{uid}.coins`.
- Client cannot write `users/{uid}.vipUntil`.
- Client cannot write `users/{uid}.vipPlan`.
- Client cannot write `users/{uid}.unlockedChapters`.
- Client cannot create/update `orders/{orderId}`.
- Client cannot create/update `transactions/{txId}`.
- Client cannot write `withdraw_requests/{requestId}`.
- Client can still read public novels.
- Client can still read public chapters.
- Client can still read public blog posts.
- Client can still write own safe `users/{uid}/bookshelf/{novelId}` progress
  fields.

## How To Run

Run the offline smoke script:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
```

Expected output:

```text
Security smoke passed: 10/10 checks passed.
```

Run normal project validation:

```powershell
npx.cmd eslint scripts/security-smoke-tests/security-smoke.mjs
npm.cmd run lint
npx.cmd tsc --noEmit --pretty false
npm.cmd run build
```

## Validation Results

Validation was run after adding the smoke script/report:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 10/10 checks.
- `npx.cmd eslint scripts/security-smoke-tests/security-smoke.mjs`: pass.
- `npm.cmd run lint`: fails with known project lint debt, 77 errors / 85
  warnings. This did not increase from the current P0.7 baseline.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

## Remaining Risks

- The offline smoke script catches static regression patterns, not live behavior.
- Real Firebase ID token rejection/acceptance still needs manual or emulator
  route smoke.
- PayOS signature, amount mismatch, and duplicate webhook behavior still need
  owner-controlled test credentials or mocked unit tests in a future test
  framework.
- Firestore rule allow/deny behavior still needs emulator-based tests before
  owner deploys rules.
- The direct donate flow remains outside the completed P0.4-P0.7 route scope and
  should be hardened in a later money-flow phase.

## Not Done

- No deploy.
- No production data touched.
- No secrets printed.
- No PayOS live call.
- No Firestore rules deployment.
- No package added.
- No commit or push.

## Next Recommended Task

P0.9 Deploy readiness review for security hardening: review remaining
compatibility risks, confirm env requirements, prepare manual smoke steps, and
produce an owner-controlled deployment checklist without deploying.
