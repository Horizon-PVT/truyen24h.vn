# Truyen24h P0 Security Hardening Plan

Baseline date/time: 2026-06-03 21:45:03 +07:00

## 1. Executive Summary

Current risk level: Critical for monetization scale.

`truyen24h.vn` already has the business surfaces needed for revenue: PayOS top-up,
coins, VIP chapters, creator withdrawals, admin AI publishing, and daily
automation. The blocking issue is that multiple sensitive flows currently trust
client-controlled identity or money values, and some money mutations are still
possible directly from client-side Firestore calls.

This blocks serious traffic, payments, and near-100% automation because an
attacker or buggy client could spoof admin identity, create manipulated PayOS
orders, unlock paid chapters at forged prices, transfer or mint coins, create
withdrawal requests with client-selected bank data, or abuse AI/TTS endpoints.
Automation would amplify these risks if it is scaled before the security
foundation is fixed.

Before serious traffic/payment scale, the project must ship server-side Firebase
ID token verification, server-derived user identity, hardened admin
authorization, server-trusted PayOS order creation, verified/idempotent webhook
crediting, locked-down Firestore money rules, and smoke tests that prove forged
requests fail.

## 2. Risk Inventory

### Admin auth

- `src/lib/apiAuth.ts` accepts `x-admin-email` and checks it against
  `NEXT_PUBLIC_ADMIN_EMAILS`. This header is client-controlled and spoofable.
- `src/lib/admin.ts` reads `NEXT_PUBLIC_ADMIN_EMAILS`, which is public by
  design. It is acceptable for UI hints, not for server authorization.
- Admin routes under `src/app/api/admin/**` and `src/app/api/ai/**` rely on
  `authorizeAdmin`, so spoofed admin email can reach AI generation and content
  publishing routes.
- `src/app/api/admin/daily-run-cron/route.ts` uses bearer token auth and is
  better, but automated publishing still needs explicit rate limits, audit logs,
  and owner-controlled approval boundaries before scale.
- Admin UI clients send `x-admin-email` from the browser instead of a Firebase ID
  token.

### User auth

- No shared server-side Firebase ID token helper exists in `src/lib/apiAuth.ts`.
- User-sensitive routes such as `src/app/api/unlock-chapter/route.ts` and
  `src/app/api/donate/route.ts` trust body-provided `buyerId`, `donorId`, and
  `authorId`.
- Several sensitive actions still happen directly in client components using the
  Web Firebase SDK.

### PayOS

- `src/app/api/payos/create/route.ts` trusts body-provided `orderCode`, `amount`,
  `description`, `returnUrl`, and `cancelUrl`.
- `src/app/vip/page.tsx` creates `orders/{orderCode}` client-side before calling
  PayOS. The server should create the order from a trusted pack catalog.
- `src/app/api/webhooks/payos/route.ts` verifies PayOS signature, but it does not
  enforce paid amount equals stored order amount before crediting.
- The webhook credits `orderData.coins`, which was created client-side in the
  current flow.
- Webhook idempotency checks `status === "PAID"`, but the update sequence should
  be made transaction-safe to avoid double-credit races.
- The webhook acknowledges missing orders with HTTP 200, which may hide payment
  reconciliation failures unless separately logged/alerted.

### Coins/VIP

- `firestore.rules` currently allow users to update their own `coins` downward
  and `unlockedChapters`, and allow other users to increase an author's `coins`.
  Money fields should not be client-writable.
- `src/components/ReaderView.tsx` directly deducts buyer coins and credits author
  coins for chapter unlock.
- `src/components/NovelDetailView.tsx` directly deducts donor coins and credits
  author coins for donations.
- `src/components/CheckInModal.tsx` directly increments user coins for check-in.
- `src/components/ProfileEditModal.tsx` has a direct coin increment path.
- `src/components/CreatorStudioView.tsx` has direct withdrawal and admin test
  coin mutation paths.
- VIP is currently modeled as large coin packs. If true monthly VIP is added,
  `vipUntil` and `vipPlan` must be server-only.

### Chapter unlock

- `src/app/api/unlock-chapter/route.ts` trusts body-provided `buyerId`,
  `authorId`, and `chapterPrice`.
- The route does not server-read the chapter document to derive `isVip`, `price`,
  or ownership.
- The route uses client Firebase SDK in a server route, not Firebase Admin SDK
  with verified user identity.
- Direct client unlock logic still exists, so route hardening alone will not
  close the path until Firestore rules also lock down money fields.

### Missions/checkin/bookmark

- `src/app/api/checkin/**`, `src/app/api/missions/**`, and
  `src/app/api/bookmark/**` are currently missing.
- Check-in reward logic currently runs in `src/components/CheckInModal.tsx` and
  writes `coins` client-side.
- Bookshelf/bookmark-style progress writes are client-side. These can remain
  client-writable only for non-money, own-user data after rules are scoped
  tightly.
- Missions that award coins must be moved server-side and use idempotent daily
  reward records.

### Withdrawals

- `src/app/api/withdraw/**` is currently missing.
- `src/components/CreatorStudioView.tsx` creates `withdraw_requests` and sets the
  user's coins to zero client-side.
- `src/components/AdminDashboard.tsx` marks withdrawal requests completed
  client-side.
- Firestore rules allow client creation of `withdraw_requests` with
  body-controlled bank/account data and amount fields, and disallow updates, so
  admin completion depends on rules bypass or currently broken client behavior.
- Withdrawal should be server-side, owner-approved, auditable, and never
  automatically paid.

### Firestore rules

- `firestore.rules` are not fail-closed enough for money:
  - `users/{userId}` permits client writes to `coins`, `unlockedChapters`,
    `badges`, and `contributionScore`.
  - `users/{authorId}` permits other users to increase `coins`.
  - `transactions/{txId}` permits client-created transactions.
  - `withdraw_requests/{reqId}` permits client-created withdrawal requests.
- There is no explicit split between safe user profile fields and server-only
  money/accounting fields.
- Public user reads expose full user docs, which may include private fields if
  added later.

### TTS/API abuse

- `src/app/api/tts/route.ts` accepts arbitrary `text` with no auth, length limit,
  rate limit, quota, or abuse protection.
- AI generation routes are admin-gated through spoofable `x-admin-email`.
- Daily automation routes can generate content and consume AI cost; they need
  stronger authorization, bounded parameters, and reporting before scale.

### CI/testing

- `.github/workflows/daily-run.yml` exists for daily AI runs, but no CI workflow
  currently gates lint/typecheck/build before code lands.
- `docs/TRUYEN24H_VALIDATION_BASELINE.md` records that lint currently fails with
  88 pre-existing errors / 89 warnings, while typecheck and build pass.
- Future hardening must not increase lint errors and should make touched files
  lint-clean where practical.
- Security-sensitive route tests are missing for unauthenticated requests,
  forged identity, forged admin email, PayOS mismatch, duplicate webhook, and
  Firestore rule lockdown.

## 3. Required Implementation Phases

### P0.2 Server-side Firebase ID token helper

Goal:

- Add a reusable server-side helper that verifies Firebase ID tokens and returns
  trusted `uid`, `email`, and claims.

Files likely touched:

- `src/lib/apiAuth.ts`
- `src/lib/firebaseAdmin.ts`
- focused tests or smoke scripts if the repo adds a test location

Exact behavior changes:

- Accept `Authorization: Bearer <Firebase ID token>` for user-bound API routes.
- Verify the token with Firebase Admin SDK.
- Derive `uid` and `email` from the decoded token.
- Return clear 401 responses for missing, malformed, expired, or invalid tokens.
- Do not change all routes in this phase; only add the helper and a tiny smoke
  target if practical.

Tests/smoke checks needed:

- Missing `Authorization` returns unauthorized.
- Malformed bearer token returns unauthorized.
- Helper compiles and does not expose token values in logs.
- `npx.cmd tsc --noEmit --pretty false` passes.
- Touched-file lint is clean where practical.

Risks:

- Firebase Admin credentials may be missing in local/dev environments.
- Over-eager route migration in the same phase could create large blast radius.

Rollback notes:

- Remove the helper changes from `src/lib/apiAuth.ts` and any focused helper
  test/smoke file. No data migration should be involved.

### P0.3 Admin authorization hardening

Goal:

- Remove spoofable admin authorization and require server-verified identity for
  admin UI/API calls.

Files likely touched:

- `src/lib/apiAuth.ts`
- `src/lib/admin.ts`
- `src/components/AiStudioClient.tsx`
- `src/components/BlogManagerClient.tsx`
- `src/app/api/admin/**`
- `src/app/api/ai/**`

Exact behavior changes:

- `x-admin-email` no longer grants admin access.
- Admin UI sends Firebase ID token in `Authorization`.
- Server verifies token, then checks email/custom claim against a server-only
  admin allowlist.
- Machine routes keep token-based auth only where explicitly intended, such as
  cron, with strict parameter bounds.

Tests/smoke checks needed:

- Forged `x-admin-email` is rejected.
- Valid non-admin Firebase user is rejected.
- Valid admin Firebase user is accepted.
- Cron bearer token still works for `daily-run-cron`.
- Admin routes do not leak allowlist details.

Risks:

- Admin panel can become inaccessible if env allowlist or token issuance is
  misconfigured.
- Need careful local testing because Firebase Auth authorized domains may block
  local login until configured.

Rollback notes:

- Revert route auth changes only; do not restore spoofable `x-admin-email` in
  production once replaced. Use a temporary owner-only bearer token fallback if
  emergency access is needed.

### P0.4 User-sensitive route hardening

Goal:

- Move user-bound money and account mutations behind verified server routes.

Files likely touched:

- `src/app/api/unlock-chapter/route.ts`
- `src/app/api/donate/route.ts`
- new `src/app/api/checkin/route.ts`
- new `src/app/api/withdraw/route.ts`
- client callers in `ReaderView`, `NovelDetailView`, `CheckInModal`,
  `CreatorStudioView`
- `src/lib/apiAuth.ts`

Exact behavior changes:

- Routes derive buyer/donor/requester from verified token, not body.
- Unlock route server-reads novel/chapter to derive `price`, `isVip`, and
  `authorId`.
- Donate route derives donor from token and validates recipient server-side.
- Check-in route awards coins once per day using an idempotent server record.
- Withdraw route calculates withdrawable amount from server state and creates a
  pending request without auto-paying.
- Client code stops directly mutating money fields.

Tests/smoke checks needed:

- Forged `buyerId`/`donorId`/`userId` is ignored or rejected.
- Forged price/amount is rejected or ignored.
- Insufficient coins fails without mutation.
- Repeat check-in does not double-award coins.
- Withdraw request cannot be created for another user.

Risks:

- Firestore rules must be coordinated so the server path works while client
  money writes are removed.
- Existing UI may need clear error states when auth token is missing.

Rollback notes:

- Revert individual routes one at a time if a flow breaks. Do not reopen
  client-side money mutation in production; instead temporarily disable the
  affected paid action.

### P0.5 PayOS hardening

Goal:

- Make top-up and VIP payment fully server-trusted and idempotent.

Files likely touched:

- `src/app/api/payos/create/route.ts`
- `src/app/api/webhooks/payos/route.ts`
- `src/services/payos.ts`
- `src/app/vip/page.tsx`
- shared payment package catalog module

Exact behavior changes:

- Client sends only `packId`.
- Server verifies Firebase ID token and chooses amount, coins, and VIP fields
  from a server catalog.
- Server creates `orders/{orderCode}` as `PENDING`.
- PayOS create route does not trust client `amount`, `coins`, `orderCode`,
  `description`, `returnUrl`, or `cancelUrl`.
- Webhook verifies signature, order existence, status, paid amount, order owner,
  and idempotency before crediting.
- Webhook credits coins/VIP inside a transaction or transaction-equivalent Admin
  SDK flow.
- Missing/mismatch orders are logged for reconciliation and do not credit.

Tests/smoke checks needed:

- Unknown `packId` returns 400.
- Unauthenticated create returns 401.
- Forged amount in body has no effect.
- Webhook invalid signature returns 400.
- Webhook amount mismatch does not credit.
- Duplicate webhook does not double-credit.
- Successful webhook updates order and user exactly once.

Risks:

- Live PayOS integration needs owner-controlled credentials and real webhook
  endpoint validation.
- Changing order creation may break existing pending orders if not migrated or
  handled carefully.

Rollback notes:

- Keep old pending orders readable during transition.
- If webhook hardening blocks legitimate payments, pause PayOS checkout rather
  than crediting unverified money.

### P0.6 Firestore money rules lockdown

Goal:

- Make Firestore rules fail closed for all money, VIP, transaction, order, and
  withdrawal fields.

Files likely touched:

- `firestore.rules`
- optional rules tests if introduced
- docs for deployment checklist

Exact behavior changes:

- Client can update only safe profile/display preferences and own safe
  bookshelf/progress records.
- Client cannot write `coins`, `vipUntil`, `vipPlan`, `unlockedChapters`,
  `transactions`, `orders`, `withdraw_requests` approval fields, badges, admin
  flags, revenue counters, or payout data.
- Withdraw request creation moves server-side or is restricted to a minimal,
  non-money request shell if absolutely necessary.
- Public reads avoid exposing private user/payment/bank fields.

Tests/smoke checks needed:

- Client attempt to increase/decrease coins is denied.
- Client attempt to add unlocked paid chapter is denied.
- Client attempt to create fake transaction/order is denied.
- Client attempt to create or complete withdrawal is denied.
- Own bookshelf/progress writes still work.

Risks:

- Deploying rules too early can break existing UI flows still relying on client
  writes.
- Firestore rules deployment is owner-controlled and must not be done by an
  agent without explicit approval.

Rollback notes:

- Keep previous reviewed rules available. If production breaks, owner can deploy
  the prior rules version manually while server routes are corrected.

### P0.7 Security smoke tests

Goal:

- Add repeatable checks proving sensitive routes reject forged or unauthenticated
  access.

Files likely touched:

- test/smoke script location chosen by the repo
- package scripts only if approved for CI integration
- route test fixtures/mocks if needed

Exact behavior changes:

- Introduce smoke tests for auth and payment integrity without calling real
  PayOS unless explicitly running a live payment test.
- Keep real money tests opt-in and owner-approved.

Tests/smoke checks needed:

- Admin forged `x-admin-email` rejected.
- Missing Firebase token rejected for user-sensitive routes.
- Body-forged UID ignored/rejected.
- PayOS invalid signature/mismatch/duplicate cases covered.
- Firestore money write denials covered if emulator/rules tests are available.

Risks:

- Tests may need mocking to avoid real API calls and secrets.
- Adding packages is currently not allowed unless separately approved.

Rollback notes:

- Remove smoke test files or disable the new script if it blocks work due to
  environment limitations. Keep manual test cases documented.

### P0.8 CI gate

Goal:

- Prevent future regressions from entering the project.

Files likely touched:

- `.github/workflows/**`
- package scripts only if needed and approved
- docs baseline

Exact behavior changes:

- Add a CI workflow for `npm.cmd run lint`, `npx.cmd tsc --noEmit --pretty
  false`, and `npm.cmd run build` or platform-appropriate equivalents.
- Because lint baseline currently fails, CI should initially gate typecheck/build
  and optionally a touched-file lint rule, or first reduce lint debt before
  enabling full lint as blocking.

Tests/smoke checks needed:

- CI runs on pull requests.
- Typecheck/build failures block merges.
- Lint baseline is not confused with new errors.

Risks:

- Enabling full lint immediately will fail due to known 88-error baseline.
- CI workflow must not trigger deployment or production mutation.

Rollback notes:

- Disable only the failing CI step while preserving typecheck/build protection.

## 4. Non-Negotiable Rules

- Do not trust `uid`, `email`, `amount`, `coins`, `authorId`, or `price` from
  request body.
- Do not trust `x-admin-email`.
- Do not mutate money client-side.
- Webhook must verify signature and paid amount.
- Owner controls money, bank accounts, production deploys, Firestore rules
  deployment, and high-risk approvals.
- Do not loosen Firestore rules to make a broken route pass.
- Do not deploy, push, publish large AI batches, change bank data, change
  secrets, or approve payouts without explicit owner approval.

## 5. Validation Strategy

Current baseline from `docs/TRUYEN24H_VALIDATION_BASELINE.md`:

- `npm.cmd run lint` currently fails with known baseline 88 errors / 89
  warnings.
- `npx.cmd tsc --noEmit --pretty false` should pass.
- `npm.cmd run build` should pass.

Future implementation must not increase lint errors. For every code task:

- Run the three baseline commands.
- Run focused lint on touched files where practical.
- Keep touched files lint-clean where practical, especially security/payment
  files.
- If full lint still fails, report whether the failure count changed from the
  88-error baseline.
- Security-sensitive tasks should add or run focused smoke checks for missing
  auth, forged identity, forged admin email, PayOS amount mismatch, duplicate
  webhook, and Firestore money rule denial.

## 6. Recommended First Code Task

Recommended next task only: P0.2 Server-side Firebase ID token auth helper,
without changing all routes yet.

Suggested prompt:

```text
You are working inside truyen24h.vn.

Before doing anything, read AGENTS.md,
docs/TRUYEN24H_AGENT_OPERATING_CONSTITUTION_AND_MONEY_AUTOMATION.md,
docs/TRUYEN24H_VALIDATION_BASELINE.md, and
docs/TRUYEN24H_P0_SECURITY_HARDENING_PLAN.md.

Task: Implement P0.2 only.

Add a server-side Firebase ID token auth helper in src/lib/apiAuth.ts using
Firebase Admin SDK. It must parse Authorization: Bearer <token>, verify the
Firebase ID token, return trusted uid/email/claims, and return safe unauthorized
errors without logging token values.

Do not migrate all routes yet. Do not modify Firestore rules, payment logic,
coin mutation logic, deployment config, packages, or production settings.

Validation:
- npm.cmd run lint
- npx.cmd tsc --noEmit --pretty false
- npm.cmd run build

Final report must say whether full lint still matches the known 88-error
baseline and include a focused explanation of the helper behavior.
```
