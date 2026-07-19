# Truyen24h P0.9 Deploy Readiness Review

Date: 2026-06-04 17:22:13 +07:00

## Purpose

This review prepares `truyen24h.vn` for an owner-controlled security deployment
after P0 hardening. It does not deploy code, deploy Firestore rules, commit,
push, edit env files, print secrets, or change runtime behavior.

## 1. Security Hardening Summary

### P0.2 Firebase Server Auth Helper

- Added `requireFirebaseUser(request)` in `src/lib/apiAuth.ts`.
- API routes can now require `Authorization: Bearer <Firebase ID token>`.
- Server derives trusted `uid`, `email`, and claims from Firebase Admin SDK.
- Missing, malformed, expired, or invalid Firebase tokens return safe 401
  responses.

### P0.3 Admin Auth Hardening

- `authorizeAdmin` no longer trusts `x-admin-email`.
- Secure admin paths now use:
  - `ADMIN_API_TOKEN` for controlled server/machine calls.
  - verified Firebase ID token plus server-only `ADMIN_EMAILS` or
    `ADMIN_ALLOWED_EMAILS` for admin users.
- `NEXT_PUBLIC_ADMIN_EMAILS` is not used as secure server authorization.
- Old browser calls that only send `x-admin-email` should fail.

### P0.4 Sensitive User Route Hardening

Hardened routes:

- `/api/checkin/claim`
- `/api/missions/progress`
- `/api/missions/claim`
- `/api/bookmark/toggle`
- `/api/withdraw/request`

These routes now require Firebase ID token and derive `uid` from the verified
token instead of request body.

### P0.5 PayOS Hardening

- `/api/payos/create` requires Firebase ID token.
- Client controls only `packId`.
- Server derives `uid`, `amount`, `coins`, `isMonthly`, `vipDays`, order code,
  title, description, return URL, and cancel URL.
- PayOS webhook verifies signature, checks paid amount against server-stored
  order amount, and credits coins/VIP idempotently inside an Admin transaction.

### P0.6 Unlock/Chapter Money Hardening

- `/api/unlock-chapter` requires Firebase ID token.
- Server derives buyer from verified token.
- Server reads novel/chapter data before charging.
- Price and author payout recipient are server-derived.
- Already-unlocked, free, and active-VIP paths avoid double charging.
- Paid unlock mutation is transaction-based and idempotent.

### P0.7 Firestore Money Rules Lockdown

- Client writes to money/VIP/unlock/admin/accounting fields are blocked in
  `firestore.rules`.
- Client writes to orders, transactions, payments, withdrawal requests, revenue
  events, and platform revenue are denied.
- Public reads for novels, chapters, inline comments, and blog posts are
  preserved.
- Safe own-user bookshelf/progress writes are preserved.
- Firestore rules were prepared only; deployment remains owner-controlled.

### P0.8 Security Smoke Tests

- Added offline smoke script:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
```

- Expected current result: `Security smoke passed: 10/10 checks passed.`
- Script checks static security contracts without live Firebase, PayOS, or
  production data.

## 2. Deployment Readiness Status

### Ready To Deploy

- Code build is currently capable of compiling.
- P0 hardened API routes are in place.
- Offline P0 smoke script is present and expected to pass 10/10.
- PayOS create/webhook logic is server-trusted at code level.
- Unlock route no longer trusts client-provided buyer, author, or price.

### Needs Manual Verification Before Deploy

- Vercel env vars must be present and correct.
- Owner admin email must be in `ADMIN_EMAILS` or `ADMIN_ALLOWED_EMAILS`.
- Firebase Admin service account env must be valid.
- Admin UI must be tested with real Firebase login and ID token.
- PayOS test payment must be run with owner-approved test/live credentials.
- PayOS webhook URL must point to the production domain.
- Firestore rules must be reviewed and tested before owner deploys them.
- Client flows that still depend on direct money writes must be identified.

### Not Ready / Risky

- Full `npm.cmd run lint` still fails with known project lint debt.
- Firestore rules should not be deployed blindly with code if manual smoke has
  not verified client compatibility.
- Direct donate flow remains outside the completed P0 route hardening scope and
  may break after Firestore money rules are deployed.
- Demo recharge/VIP buttons and admin test coin mutation are expected to break
  after rules deployment.
- Admin withdrawal approval/status update needs hardened server route before it
  is production-safe.
- TTS route remains outside P0 money hardening and still needs abuse/rate-limit
  review before scale.

## 3. Required Environment Variables

Do not print values. Confirm presence only.

### Firebase Admin / Server

- `FIREBASE_SERVICE_ACCOUNT_JSON`

Required for Firebase Admin SDK token verification and Admin SDK Firestore
writes. If missing or invalid:

- Firebase ID token verification fails.
- Admin auth via Firebase token fails.
- Server routes that use Admin SDK may fail.
- PayOS webhook and unlock/server money routes may fail.

### Firebase Public Client

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

Required for client login, Firebase Auth token generation, client Firestore
reads, and public app Firebase initialization. If missing:

- User login may fail.
- Admin UI cannot get Firebase ID token.
- User-sensitive API calls cannot authenticate.
- Public/client Firestore views may fail.

### Admin Auth

- `ADMIN_API_TOKEN`
- `ADMIN_EMAILS` or `ADMIN_ALLOWED_EMAILS`

`ADMIN_API_TOKEN` is needed for controlled server/cron/admin automation calls.
`ADMIN_EMAILS` or `ADMIN_ALLOWED_EMAILS` is needed for Firebase-authenticated
admin users. If missing:

- Firebase admin-user path fails closed.
- Cron/server automation may fail.
- Admin API calls can return 401/403 even when the UI loads.

Note: `NEXT_PUBLIC_ADMIN_EMAILS` may still be used as a UI hint in existing
client code, but it is not secure server authorization.

### PayOS

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`

Required for payment link creation and webhook signature verification. If
missing:

- `/api/payos/create` can fail.
- Webhook verification can fail.
- Payments should not be launched.

### AI / Automation

- `GEMINI_API_KEY`
- `NEXT_PUBLIC_GEMINI_API_KEY` where current client recommendation features
  still use it.

If missing:

- Admin AI generation/daily content routes can fail or return fallback content.
- Client recommendation/summary features may return fallback behavior.

### Site URL

- `NEXT_PUBLIC_SITE_URL`
- `VERCEL_URL` as Vercel fallback

Required for trusted PayOS return/cancel URLs and canonical site URL helpers. If
missing in production, code falls back to `https://truyen24h.vn`; verify this
matches the deployment domain before launch.

### Cron

- `CRON_SECRET`
- `ADMIN_API_TOKEN`

`vercel.json` defines cron path `/api/admin/daily-run-cron`. That route accepts
Vercel `CRON_SECRET` bearer auth or `ADMIN_API_TOKEN` where implemented. If
missing:

- Daily automation can fail.
- Owner-controlled daily publishing/reporting may not run.

### Analytics / Monetization Optional

- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_CLARITY_ID`
- `NEXT_PUBLIC_ADSENSE_CLIENT`
- `NEXT_PUBLIC_SHOPEE_AFF_ID`

If missing:

- Analytics, Clarity, AdSense, or affiliate widgets may be absent.
- Core security/payment flows should not depend on these.

## 4. Auth Compatibility Review

Expected after deploy:

- Admin UI/API calls must send `Authorization: Bearer <Firebase ID token>` or a
  controlled machine token where intended.
- Old `x-admin-email`-only calls fail with 401.
- User-sensitive routes require Firebase ID token.
- `/api/payos/create` requires Firebase ID token.
- `/api/unlock-chapter` requires Firebase ID token.
- Old unauthenticated clients fail 401.
- Request body `uid`, `email`, `buyerId`, `authorId`, `amount`, `coins`, and
  `price` cannot authorize sensitive actions.

Manual auth smoke before deploy:

- Login as owner admin.
- Confirm admin UI retrieves Firebase ID token.
- Call an admin API from UI and confirm success.
- Call same admin API with only `x-admin-email` and confirm failure.
- Call user routes without token and confirm 401.
- Call user routes with valid token and forged `body.uid`; confirm writes target
  verified uid only.

## 5. Firestore Rules Deployment Risk

Do not deploy Firestore rules in this task.

### Expected Blocks After Rules Deploy

- Direct client writes to `users/{uid}.coins` blocked.
- Direct client writes to `users/{uid}.vipUntil` blocked.
- Direct client writes to `users/{uid}.vipPlan` blocked.
- Direct client writes to `users/{uid}.unlockedChapters` blocked.
- Direct client creates/updates to `orders` blocked.
- Direct client creates/updates to `transactions` blocked.
- Direct client writes to `withdraw_requests` blocked.
- Direct client admin/config/revenue/accounting writes blocked.

### Known Compatibility Risks

- Demo recharge button in profile may stop working.
- Demo VIP upgrade button in profile may stop working.
- Creator Studio admin test coin mutation may stop working.
- Direct donate flow in `NovelDetailView` may fail because it still attempts
  client-side coin transfer.
- Admin dashboard withdrawal status update may fail until moved to a hardened
  server route.
- Any registration/profile flow that writes fields outside the safe user
  allowlist may fail.

### Reads / Safe Writes Preserved

- Public reads for novels are preserved.
- Public reads for chapters are preserved.
- Public reads for blog posts are preserved.
- Own safe bookshelf/progress writes are preserved where fields match rules.
- Own profile/display writes are preserved for safe fields.

### Recommendation For Rules Deploy

Deploy code first, run live route/payment/admin smoke, then deploy Firestore
rules as a staged owner-controlled step after manual Firestore compatibility
testing. Rules are high-risk enough that they should not be silently bundled
with a code deploy unless owner has verified the checklist.

## 6. Payment Readiness

### PayOS Create

- Client sends only `packId`.
- Server selects package amount, coins, monthly flag, VIP days, title, and
  description from catalog.
- Server generates `orderCode`.
- Server creates `orders/{orderCode}` as `PENDING`.
- Server derives return/cancel URLs from trusted site URL.

### PayOS Webhook

- Webhook verifies PayOS signature before trusting payload.
- Webhook finds matching server-created order.
- Paid amount must equal server-stored order amount.
- Already `PAID` orders are idempotent and not credited again.
- Valid pending orders credit coins/VIP and create transaction audit record
  inside an Admin transaction.

### VIP Behavior

- Monthly package sets `vipPlan = "monthly"` and `vipUntil`.
- VIP update depends on successful verified webhook only.
- VIP should not be client-writable after Firestore rules deployment.

### Required Manual PayOS Test

- With owner-approved PayOS test/live credentials, create a payment link for the
  smallest pack.
- Complete one payment.
- Verify `orders/{orderCode}` becomes `PAID`.
- Verify user coins increase by the server catalog value.
- Verify monthly package sets `vipPlan` and `vipUntil` when tested.
- Send or simulate invalid signature; confirm no credit.
- Simulate amount mismatch; confirm `PAYMENT_MISMATCH` and no credit.
- Replay same paid webhook; confirm no double credit.

## 7. Smoke Test Readiness

Command:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
```

Expected current result:

```text
Security smoke passed: 10/10 checks passed.
```

This smoke is offline/static. It does not replace live Firebase/PayOS/Firestore
emulator tests.

## 8. Validation

Required validation for this review:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
npm.cmd run lint
npx.cmd tsc --noEmit --pretty false
npm.cmd run build
```

Current expected state:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 10/10 checks.
- `npm.cmd run lint`: fails with known lint debt, 77 errors / 85 warnings.
  This did not increase from the current baseline.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

## 9. Manual Pre-Deploy Checklist

Owner/dev must complete this before production deploy:

- [ ] Confirm all required env vars exist in Vercel Production.
- [ ] Confirm Firebase Admin service account env is valid.
- [ ] Confirm Firebase public client env points to the intended Firebase project.
- [ ] Confirm `ADMIN_EMAILS` or `ADMIN_ALLOWED_EMAILS` includes owner admin
  email.
- [ ] Confirm `ADMIN_API_TOKEN` exists for cron/server automation.
- [ ] Confirm `CRON_SECRET` behavior for Vercel cron or `ADMIN_API_TOKEN`
  fallback.
- [ ] Confirm PayOS webhook URL is
  `https://truyen24h.vn/api/webhooks/payos`.
- [ ] Confirm PayOS smallest-pack test payment succeeds.
- [ ] Confirm payment amount mismatch does not credit coins/VIP.
- [ ] Confirm duplicate paid webhook does not double credit.
- [ ] Confirm admin UI works with Firebase ID token.
- [ ] Confirm old `x-admin-email`-only admin request fails.
- [ ] Confirm user login works.
- [ ] Confirm check-in works for verified user.
- [ ] Confirm mission progress/claim works where UI or internal caller uses it.
- [ ] Confirm bookmark/progress writes work.
- [ ] Confirm withdrawal request creates `PENDING` only and sends no money.
- [ ] Confirm unlock paid chapter works.
- [ ] Confirm free chapter does not charge.
- [ ] Confirm VIP-covered chapter does not charge where business logic allows.
- [ ] Confirm already-unlocked chapter does not charge again.
- [ ] Confirm direct donate flow risk is accepted or donate is disabled until
  hardened.
- [ ] Confirm demo recharge/VIP/admin test coin paths are removed, disabled, or
  accepted as broken after rules deployment.
- [ ] Confirm Firestore rules are reviewed before owner deploys them.
- [ ] Confirm rollback path for code deploy.
- [ ] Confirm rollback path for Firestore rules deploy.
- [ ] Confirm monitoring plan for orders, transactions, user coin balances,
  webhook errors, and admin access immediately after deploy.

## 10. Rollback Plan

### Code Deployment Rollback

- Use Vercel dashboard to redeploy the previous known-good deployment.
- Pause PayOS checkout if payment create/webhook behavior is suspect.
- Keep Firestore rules unchanged until live code smoke is stable.
- Monitor admin access, `/vip`, `/api/payos/create`, `/api/webhooks/payos`,
  `/api/unlock-chapter`, `/api/checkin/claim`, and `/api/withdraw/request`.

### Firestore Rules Rollback

- Owner should keep a copy of the previous deployed rules before deploying P0.7
  rules.
- If client compatibility breaks, owner can redeploy the previous reviewed
  rules manually.
- Do not loosen money fields permanently. If rollback is needed, treat it as
  temporary while fixing the affected server/client flow.

### Immediate Post-Deploy Monitoring

- Admin UI 401/403 rates.
- User login/token errors.
- PayOS order creation failures.
- Webhook invalid signature and amount mismatch events.
- Duplicate webhook behavior.
- User coin balance anomalies.
- Unlock-chapter failures and double-charge reports.
- Withdrawal request creation.
- Firestore permission-denied errors from client.
- Build/runtime errors in Vercel logs.

## 11. Final Recommendation

The project is ready for a controlled security code deploy only after Vercel env
vars are confirmed and manual admin/user/payment smoke is run in a controlled
environment.

Firestore rules should be staged separately from the initial code deploy unless
the owner completes Firestore emulator/manual compatibility checks first. The
rules are correct for security posture, but they intentionally break old direct
client money-write behavior.

Recommended next task: P1.0 Owner-controlled production smoke/deploy checklist
execution, or a narrower P0 follow-up to harden the remaining direct donate and
admin withdrawal approval flows before Firestore rules are deployed.
