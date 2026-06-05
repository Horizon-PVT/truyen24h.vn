# TRUYEN24H P0.11 Controlled Deploy Package / Owner Checklist

Created: 2026-06-04 17:47:02 +07:00

## 1. Executive Summary

P0 security hardening is code-ready but has not been production-deployed yet.
Firestore rules are prepared but have not been deployed.

Production deployment must remain owner-controlled. This package exists to make
the deployment sequence explicit so code, Vercel environment variables, Firebase
Auth/Admin, PayOS, and Firestore rules can be verified safely before the site is
scaled for real monetization and near-100% safe automation.

Goal: make `truyen24h.vn` safe for real coin/VIP/payment/withdrawal workflows
before daily automation, publishing, and revenue optimization are scaled.

## 2. P0 Work Summary

### P0.2 Firebase Server Auth Helper

- Added `requireFirebaseUser(request)`.
- API routes can require `Authorization: Bearer <Firebase ID token>`.
- Server derives trusted `uid`, `email`, and claims from Firebase Admin SDK.
- Missing, malformed, expired, or invalid tokens return safe 401 responses.

### P0.3 Admin Auth Hardening

- `authorizeAdmin` no longer trusts `x-admin-email`.
- Secure admin access now uses verified Firebase ID token plus server-only
  `ADMIN_EMAILS` / `ADMIN_ALLOWED_EMAILS`, or controlled `ADMIN_API_TOKEN`
  machine auth.
- `NEXT_PUBLIC_ADMIN_EMAILS` is not secure server authorization.

### P0.4 Sensitive User Routes Hardening

Hardened:

- `/api/checkin/claim`
- `/api/missions/progress`
- `/api/missions/claim`
- `/api/bookmark/toggle`
- `/api/withdraw/request`

These routes now derive `uid` from verified Firebase ID token instead of request
body.

### P0.5 PayOS Hardening

- `/api/payos/create` requires Firebase ID token.
- Client controls only `packId`.
- Server derives package amount, coins, monthly/VIP data, order code, and
  return/cancel URLs.
- PayOS webhook verifies signature, checks paid amount against server-stored
  order amount, and credits idempotently.

### P0.6 Unlock/Chapter Money Hardening

- `/api/unlock-chapter` requires Firebase ID token.
- Server reads novel/chapter data before charging.
- Buyer identity, chapter price, VIP/free/already-unlocked behavior, and author
  payout recipient are server-derived.
- Unlock transaction is idempotent and does not double-charge.

### P0.7 Firestore Rules Lockdown

- Firestore rules now block client writes to money, VIP, paid unlock, admin,
  payment, order, transaction, withdrawal, and revenue/accounting fields.
- Public novel/chapter/blog reads and safe own-user bookshelf/profile writes are
  preserved.
- Rules are prepared only and remain undeployed until owner approval.

### P0.8 Security Smoke Tests

- Added offline static smoke script:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
```

- Current expected result: 14/14 checks pass.

### P0.9 Deploy Readiness Review

- Documented readiness, required env vars, auth compatibility risks, Firestore
  rules staging risk, PayOS test steps, smoke commands, manual checklist, and
  rollback plan.

### P0.10 Remaining Money/Admin Direct-Write Hardening

- Hardened direct donate flow behind `/api/donate`.
- Removed demo recharge/VIP direct mutation.
- Removed admin test coin mutation.
- Moved admin withdrawal status update behind `/api/admin/withdraw/review`.
- Smoke coverage expanded from 10 to 14 checks.

## 3. Changed Area Summary

### Auth/Admin

- Admin API auth no longer accepts spoofable `x-admin-email`.
- Admin routes require verified Firebase admin user or machine token.
- Admin withdrawal review uses secure server route and audit fields.

### User-Sensitive Routes

- Check-in, missions, bookmark/progress, and withdrawal request routes require
  Firebase ID token.
- Body-provided `uid` or `email` no longer controls user identity.

### PayOS

- Payment creation is authenticated and server-catalog driven.
- Webhook verifies signature and paid amount before crediting.
- Duplicate paid webhook does not double-credit.

### Unlock Paid Chapters

- Server reads novel/chapter data before charging.
- Price and author payout recipient are server-derived.
- Repeated unlock requests are idempotent.

### Donate

- `/api/donate` requires Firebase ID token.
- Verified token uid is donor.
- Client cannot select `donorId`.
- Donation coin mutation runs in Admin SDK transaction with audit transaction.

### Withdraw Review

- Withdrawal request creation is server-side and creates `PENDING` only.
- Admin status review is server-side through `/api/admin/withdraw/review`.
- No payout automation was added.

### Firestore Rules

- Rules block direct client writes to sensitive money/admin fields and
  collections.
- Rules must not be deployed blindly; owner-controlled staging is required.

### Client Compatibility

- Old unauthenticated clients will receive 401 for hardened routes.
- Old `x-admin-email`-only admin calls will fail.
- Demo recharge/VIP and admin test coin direct writes no longer mutate.
- Admin withdrawal list still reads `withdraw_requests` client-side; if strict
  rules block admin-wide reads, add a secure admin list route before rules
  deployment or stage rules separately.

### Security Smoke Tests

- Offline smoke script checks admin spoof rejection, verified user route
  patterns, PayOS trust boundaries, unlock idempotency patterns, donate
  hardening, demo mutation removal, admin withdrawal review hardening, and
  Firestore rules posture.

### Documentation

- P0 rulebook, validation baseline, security hardening plan, P0.3-P0.11 reports,
  and deploy readiness docs now describe the operating and security posture.

## 4. Current Validation Baseline

Current expected validation results:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 14/14 checks.
- `npm.cmd run lint`: fails with known lint debt, currently 75 errors / 84
  warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

Future deploy work must not increase lint errors or warnings from 75 / 84. Any
runtime task should keep touched files lint-clean where practical and clearly
separate pre-existing lint debt from new regressions.

## 5. Required Production Env Checklist

List names only. Do not print values.

### Firebase Admin / Server

- `FIREBASE_SERVICE_ACCOUNT_JSON` or equivalent Firebase Admin credentials.

If missing or invalid:

- Firebase ID token verification fails.
- Admin auth via Firebase token fails.
- Server routes using Admin SDK can fail.
- PayOS webhook, donation, unlock, withdrawal, and route hardening can fail.

### Firebase Public Client

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

If missing:

- User login may fail.
- Admin UI cannot obtain Firebase ID token.
- Authenticated user routes cannot be called from the client.
- Public Firestore-backed views may fail.

### Admin Auth

- `ADMIN_API_TOKEN`
- `ADMIN_EMAILS` or `ADMIN_ALLOWED_EMAILS`

If missing:

- Machine/server automation auth can fail.
- Firebase admin-user path fails closed if no server allowlist exists.
- Admin API calls can return 401/403 even if the UI loads.

### PayOS

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`

If missing:

- Payment link creation can fail.
- Webhook signature verification can fail.
- Live payment launch is not safe.

### Site URL

- `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL`

If missing:

- PayOS return/cancel URLs may fall back to the hardcoded production domain.
- Canonical/payment redirects must be manually verified before launch.

### Cron / Automation

- `CRON_SECRET` if cron is used.
- `ADMIN_API_TOKEN` for controlled server automation.

If missing:

- Vercel cron or daily AI operations may fail.
- Automation should remain disabled or manually triggered until auth is verified.

### AI

- `GEMINI_API_KEY` if AI routes are used.
- `NEXT_PUBLIC_GEMINI_API_KEY` only if current client-side AI behavior still
  needs it.

If missing:

- Admin AI generation/daily publishing routes may fail.
- Client-side AI recommendation/summary behavior may fall back or fail.

### Analytics / Ads / Affiliate

Confirm any present analytics/ads/affiliate env names in Vercel without printing
values, for example:

- Google Analytics / GA4 public id
- Microsoft Clarity public id
- AdSense client id
- Affiliate ids

If missing:

- Tracking, ads, or affiliate widgets may be absent.
- Core auth/payment security should not depend on them.

## 6. Recommended Deployment Sequence

### Stage 1 - Code Deploy Only

- Owner deploys app code first.
- Do not deploy Firestore rules yet.
- Do not trigger mass AI publishing.
- Do not trigger real PayOS payment unless owner explicitly approves.
- Run production smoke tests immediately after deploy.
- Verify admin/user/payment/unlock/donate/withdraw flows before rules deploy.

Recommended pre-code-deploy commands:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
npm.cmd run lint
npx.cmd tsc --noEmit --pretty false
npm.cmd run build
```

Expected:

- Smoke pass 14/14.
- Lint fail only with known 75 errors / 84 warnings or lower.
- Typecheck pass.
- Build pass.

### Stage 2 - Manual Production Smoke

Run after code deploy and before Firestore rules deploy:

- Admin login works with Firebase token.
- `x-admin-email`-only calls fail.
- Check-in works.
- Bookmark/progress works.
- Withdrawal request creates `PENDING` only.
- Admin withdrawal review updates status only and does not pay out.
- PayOS create requires login.
- PayOS test payment creates server order and webhook credits once.
- PayOS amount mismatch does not credit.
- Duplicate webhook does not double-credit.
- Paid chapter unlock works.
- Repeated unlock does not double-charge.
- VIP/free/already-unlocked chapters do not charge.
- Donate works only from verified donor.
- Demo recharge/VIP no longer mutates coins/VIP.

### Stage 3 - Firestore Rules Deploy

Deploy Firestore rules only after Stage 1 and Stage 2 pass.

After rules deploy, re-test:

- User profile view/update for safe profile fields.
- Bookshelf/progress writes.
- Payment/order history reads for own user.
- Withdrawal history reads for own user.
- Public novel reads.
- Public chapter reads.
- Public blog reads.
- PayOS create/webhook flow.
- Unlock paid/free/VIP/already-unlocked flows.
- Donate flow.
- Admin dashboard behavior.

Watch for `permission-denied` errors. If old UI still depends on direct
money/admin writes, the breakage is intended for security but must be resolved
with server routes, not by loosening rules.

## 7. Firestore Rules Deployment Warning

Firestore rules should not be deployed blindly.

The P0.7 rules intentionally block direct client writes to money/admin
collections and fields, including:

- `users/{uid}.coins`
- `users/{uid}.vipUntil`
- `users/{uid}.vipPlan`
- `users/{uid}.unlockedChapters`
- orders
- transactions
- payments
- PayOS order state
- withdrawal requests
- admin/config/ops/revenue/accounting paths

If old UI still relies on direct client writes, it will break. That is intended
for security, but it must be smoke-tested and routed through secure server APIs.

Do not loosen money rules to make a legacy client write work. Fix the client or
server flow instead.

## 8. Rollback Plan

### Code Rollback

- Use Vercel dashboard to promote/redeploy the previous known-good deployment.
- Pause or hide checkout actions if PayOS behavior is suspect.
- Keep Firestore rules unchanged until code smoke is stable.
- Inspect Vercel function logs for:
  - `/api/payos/create`
  - `/api/webhooks/payos`
  - `/api/unlock-chapter`
  - `/api/donate`
  - `/api/withdraw/request`
  - `/api/admin/withdraw/review`
  - admin AI/publishing routes

### Firestore Rules Rollback

- Owner should keep the previous deployed rules text before deploying P0.7
  rules.
- If client compatibility breaks badly, owner can redeploy the previous reviewed
  rules manually.
- Treat any rules rollback as temporary. Do not permanently reopen client money
  writes.

### Logs To Inspect

- Vercel deployment/build logs.
- Vercel function runtime logs.
- Firebase Auth login/token errors.
- Firestore permission-denied events.
- PayOS webhook request logs.
- Orders and transactions audit records.
- Admin audit logs for withdrawal review.

### User Issues To Monitor

- Cannot login.
- Cannot access admin panel.
- Cannot check in.
- Cannot bookmark or save progress.
- Cannot create payment.
- Payment succeeded but coins/VIP not credited.
- Paid chapter unlock fails.
- Already unlocked chapter charges again.
- Donate fails or deducts unexpectedly.
- Withdrawal request/review status confusion.

### Payment Anomalies To Monitor

- `PAYMENT_MISMATCH` order records.
- Duplicate webhook calls.
- Orders stuck in `PENDING` after completed payment.
- Orders marked `PAID` without matching transaction audit.
- User coin balances changing without matching transaction records.
- VIP status changes without matching paid order.

## 9. Owner Approval Gates

These actions require explicit owner approval:

- Production code deploy.
- Firestore rules deploy.
- PayOS live payment test.
- Changing env vars.
- Changing `ADMIN_EMAILS` or `ADMIN_ALLOWED_EMAILS`.
- Changing `ADMIN_API_TOKEN`.
- Enabling or changing automation jobs.
- Mass AI content publishing.
- Payout or withdrawal execution.
- Changing bank/payment account data.
- Changing PayOS webhook URL or live credentials.
- Committing or pushing to the production branch.

## 10. Post-Deploy Monitoring Checklist

Monitor immediately after deploy:

- 401 spikes.
- 403 spikes.
- Firestore `permission-denied` spikes.
- PayOS webhook failures.
- Payment mismatch records.
- Duplicate webhook handling.
- Unlock double-charge reports.
- Withdrawal status errors.
- Admin route failures.
- Build/deployment errors.
- User complaints about login/payment/unlock.
- Donation failures or unexpected repeated donation complaints.
- Cron/daily-run failures if automation is enabled.

## 11. Recommended Next Task

P0.12 Production manual smoke execution report, after owner deploys code in a
controlled way.

P0.12 should record actual production smoke evidence, including:

- deployment id/time;
- env presence confirmation without values;
- admin auth results;
- user route results;
- PayOS test result if owner approves;
- unlock/donate/withdraw smoke results;
- Firestore rules deploy status;
- rollback readiness;
- observed errors and follow-up actions.
