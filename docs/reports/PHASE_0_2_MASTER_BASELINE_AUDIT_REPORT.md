# Phase 0.2 - Master Baseline Audit & Money-Safety Task Map Report

## Executive Summary

Current `master` readiness level: **not ready for monetization or mostly autonomous AI operation**.

`master` has useful product foundations: reader pages, paid chapter concepts, coin/VIP UI, PayOS integration, donation logic, withdrawal views, AI generation routes, cron wiring, sitemap, and Phase 0.1 agent workflow documentation. However, the current baseline still has P0 money-safety risks and validation failures.

Master is ready for review and planning, but **not ready for real payment scale**. The biggest blockers are:

- spoofable admin authorization through `x-admin-email`
- user and money routes trusting `uid`, `amount`, `coins`, `chapterPrice`, `authorId`, or similar fields from request bodies/client state
- direct client-side mutation paths for coins, VIP/demo recharge, paid unlocks, donations, and withdrawals
- Firestore rules still allowing sensitive money/accounting writes from the client SDK
- PayOS flow still allowing unsafe legacy request body fields and webhook crediting without a paid amount match check
- no CI gate for lint/typecheck/build
- local validation baseline currently failing lint and build

Master is **not ready for monetization** until admin auth, user identity, payment, unlock, donation, withdrawal, and Firestore money rules are hardened.

Master is **not ready for near-100% AI automation** until validation gates, smoke tests, review rules, and owner approval boundaries are enforced in CI and deployment workflow.

## Master Branch State

Commands were run from a clean worktree created from `origin/master`:

```text
C:\tmp\truyen24h-phase-0-2-master-baseline-audit
```

`git branch --show-current`

```text
phase-0-2-master-baseline-audit
```

`git status -sb`

```text
## phase-0-2-master-baseline-audit...origin/master
```

`git log -1 --oneline`

```text
d24df55 chore: add AI dev factory workflow docs (#1)
```

`git remote -v`

```text
origin  https://github.com/takeuchi999999999-png/truyen24h.vn.git (fetch)
origin  https://github.com/takeuchi999999999-png/truyen24h.vn.git (push)
```

## Validation Baseline

Dependencies were installed locally in the isolated worktree with `npm.cmd ci --no-audit --no-fund` before running validation. No env values were printed.

### `npm.cmd run lint`

Result: **fail**

Summary:

```text
283 problems (176 errors, 107 warnings)
```

Dominant categories:

- `@typescript-eslint/no-explicit-any`
- `prefer-const`
- `react/no-unescaped-entities`
- React hook lint errors and warnings
- unused variables and imports
- `@next/next/no-img-element`

This is a master baseline failure, not introduced by Phase 0.2 docs.

### `npx.cmd tsc --noEmit --pretty false`

Result: **pass**

The command exited successfully with no TypeScript errors after dependencies were installed in the isolated worktree.

### `npm.cmd run build`

Result: **fail**

The build compiled and completed the TypeScript phase, then failed during prerender because local Firebase public client configuration is not valid in the worktree environment:

```text
Error [FirebaseError]: Firebase: Error (auth/invalid-api-key).
Export encountered an error on /bang-xep-hang/page: /bang-xep-hang, exiting the build.
Export encountered an error on /_not-found/page: /_not-found, exiting the build.
Next.js build worker exited with code: 1 and signal: null
```

The build also emitted a Turbopack warning from `src/app/api/admin/deploy-rules/route.ts` importing/tracing `next.config.ts`:

```text
Encountered unexpected file in NFT list
Import trace:
  App Route:
    ./next.config.ts
    ./src/app/api/admin/deploy-rules/route.ts
```

Build failure blocks clean deploy readiness until the environment and/or prerender Firebase initialization behavior is verified.

## Money-Safety Audit

### Admin auth trusts spoofable identity

- Risk level: **P0**
- Affected files:
  - `src/lib/apiAuth.ts`
  - `src/lib/admin.ts`
  - `src/app/api/admin/**`
- Finding:
  - `authorizeAdmin` accepts `x-admin-token` for `ADMIN_API_TOKEN`, but also accepts `x-admin-email`.
  - Admin email checks use `NEXT_PUBLIC_ADMIN_EMAILS`, which is a public env name and should not be a secure server-side proof.
- Why it blocks monetization:
  - A caller can spoof admin email headers unless every route has stronger protection elsewhere.
  - Admin routes can touch publishing, AI operations, deployment helpers, payment status, and other high-risk workflows.
- Recommended phase to fix:
  - **Phase 0.4: Auth/admin hardening**

### User-sensitive routes trust body `uid`

- Risk level: **P0**
- Affected files:
  - `src/app/api/checkin/claim/route.ts`
  - `src/app/api/missions/progress/route.ts`
  - `src/app/api/missions/claim/route.ts`
  - `src/app/api/bookmark/toggle/route.ts`
  - `src/app/api/withdraw/request/route.ts`
- Finding:
  - Routes use `uid` from request body to decide which user to mutate.
- Why it blocks monetization:
  - A user can attempt to act on another user's check-in, mission, bookmark, or withdrawal data.
  - Reward routes can become coin/reputation abuse paths.
- Recommended phase to fix:
  - **Phase 0.4: Auth/admin hardening**
  - **Phase 0.6: Coin/VIP/unlock hardening**

### PayOS create accepts unsafe legacy body fields

- Risk level: **P0**
- Affected file:
  - `src/app/api/payos/create/route.ts`
- Finding:
  - Payment creation accepts `uid` from body.
  - It supports a legacy fallback that trusts `amount`, `coins`, and `isMonthly` from the client.
  - It can accept `orderCode`, `returnUrl`, and `cancelUrl` from the body.
  - Pack catalog exists, but the unsafe fallback remains.
- Why it blocks monetization:
  - Client-controlled amount/coins/order metadata can create underpayment or accounting mismatch risk.
  - Arbitrary return/cancel URLs can create phishing or flow-integrity issues.
- Recommended phase to fix:
  - **Phase 0.5: PayOS/payment hardening**

### PayOS webhook verifies signature but not paid amount match

- Risk level: **P0**
- Affected file:
  - `src/app/api/webhooks/payos/route.ts`
- Finding:
  - Webhook calls PayOS signature verification and has idempotency around `status === 'PAID'`.
  - It credits coins/VIP using server order fields.
  - It does not clearly compare webhook paid amount against the server-stored order amount before crediting.
- Why it blocks monetization:
  - Valid provider events must still be matched against server-side order amount before any coin/VIP credit.
- Recommended phase to fix:
  - **Phase 0.5: PayOS/payment hardening**

### Paid chapter unlock trusts client data and has direct client mutation path

- Risk level: **P0**
- Affected files:
  - `src/app/api/unlock-chapter/route.ts`
  - `src/components/ReaderView.tsx`
- Finding:
  - API route trusts `buyerId`, `chapterPrice`, and `authorId` from body.
  - Reader UI still performs direct client-side coin deduction, author credit, unlocked chapter update, and transaction creation.
- Why it blocks monetization:
  - Buyer identity, chapter price, and author payout recipient must be server-derived.
  - Paid unlock must be idempotent and performed through Admin SDK/server transaction only.
- Recommended phase to fix:
  - **Phase 0.6: Coin/VIP/unlock hardening**

### Donate flow trusts client identity and amount

- Risk level: **P0**
- Affected files:
  - `src/app/api/donate/route.ts`
  - `src/components/NovelDetailView.tsx`
- Finding:
  - Donate API trusts `donorId`, `authorId`, and `amount` from body.
  - Novel detail UI also performs direct client-side donor coin decrement and author coin increment.
- Why it blocks monetization:
  - Client-controlled donor/recipient/amount can corrupt balances and author earnings.
- Recommended phase to fix:
  - **Phase 0.6: Coin/VIP/unlock hardening**

### Demo recharge/VIP mutates user money fields directly

- Risk level: **P0**
- Affected file:
  - `src/components/ProfileEditModal.tsx`
- Finding:
  - Demo recharge directly increments `users/{uid}.coins`.
  - Demo VIP directly updates `isVip` and `badges`.
- Why it blocks monetization:
  - Production clients must not be able to mint coins or VIP status outside verified payment/admin flows.
- Recommended phase to fix:
  - **Phase 0.6: Coin/VIP/unlock hardening**

### Admin test coin mutation exists in client UI

- Risk level: **P0**
- Affected file:
  - `src/components/CreatorStudioView.tsx`
- Finding:
  - Admin test coin button directly calls `updateDoc(... coins: increment(500))` from client code.
- Why it blocks monetization:
  - Admin money mutation must use secure server-side authorization and audit logs, or be removed.
- Recommended phase to fix:
  - **Phase 0.4: Auth/admin hardening**
  - **Phase 0.6: Coin/VIP/unlock hardening**

### Withdrawal request and review can be client-side money/accounting paths

- Risk level: **P0**
- Affected files:
  - `src/app/api/withdraw/request/route.ts`
  - `src/components/CreatorStudioView.tsx`
  - `src/components/AdminDashboard.tsx`
- Finding:
  - Withdrawal request API trusts `uid` from body.
  - Creator Studio also creates withdrawal requests directly and zeroes user coins from the client.
  - Admin Dashboard directly marks withdrawal requests completed from client SDK.
  - No secure `src/app/api/admin/withdraw/review/route.ts` exists on current master.
- Why it blocks monetization:
  - Withdrawal state and user balances are money/accounting fields.
  - Owner-controlled payout review must not be bypassable through client SDK writes.
- Recommended phase to fix:
  - **Phase 0.4: Auth/admin hardening**
  - **Phase 0.6: Coin/VIP/unlock hardening**
  - **Phase 0.7: Firestore rules lockdown**

### Firestore rules allow sensitive money writes

- Risk level: **P0**
- Affected file:
  - `firestore.rules`
- Finding:
  - User self updates include `coins`, `unlockedChapters`, `badges`, `contributionScore`, and related reward fields.
  - Rules allow non-self updates to an author's `coins` when increasing.
  - Client can create `transactions`.
  - Client can create `withdraw_requests`.
- Why it blocks monetization:
  - Client SDK must not be able to write money, VIP, paid unlock, transaction, withdrawal, or revenue/accounting fields.
- Recommended phase to fix:
  - **Phase 0.7: Firestore rules lockdown**

### AI generation and cron are useful but admin boundary is not strong enough

- Risk level: **P1**
- Affected files:
  - `src/app/api/admin/daily-run-cron/route.ts`
  - `src/app/api/admin/daily-run/route.ts`
  - `src/app/api/admin/generate-blog-post/route.ts`
  - `src/app/api/admin/publish-chapter/route.ts`
  - `src/app/api/admin/publish-novel/route.ts`
  - `src/app/api/ai/**`
  - `.github/workflows/daily-run.yml`
  - `vercel.json`
- Finding:
  - Cron has token checks, but admin API auth shares the weak `authorizeAdmin` helper.
  - AI generation can be cost-sensitive and should remain owner-gated until smoke tests and budget controls exist.
- Why it blocks automation:
  - Autonomous content generation needs reliable auth, budget/rate controls, validation, and owner override gates.
- Recommended phase to fix:
  - **Phase 0.4: Auth/admin hardening**
  - **Phase 0.8: Security smoke tests**
  - Later P1 automation phases

## Agent-Automation Readiness

Codex and other AI/dev agents can start from docs more safely after Phase 0.1:

- `AGENTS.md` exists and defines the repo-level workflow.
- `CODEX.md`, `CLAUDE.md`, and `ANTIGRAVITY.md` exist.
- `docs/AGENT_WORKFLOW.md` exists.
- `docs/CURRENT_STATUS.md` exists.
- `docs/MONEY_ROADMAP.md` exists.
- `docs/tasks/`, `docs/reports/`, `docs/reviews/`, and `docs/qa/` exist.

Current readiness gaps:

- No CI workflow was found for lint/typecheck/build.
- Validation commands are documented but not enforced.
- PR/review rules exist at a documentation level, but there is no automated gate.
- Money, deployment, Firestore rules, and secret changes still require owner approval and must stay manual.
- Current master validation failures make autonomous code/deploy loops unsafe.

Assessment: **agent workflow foundation exists, but automation is not yet safe for unattended runtime/payment changes**.

## Revenue Readiness

### VIP funnel

VIP UI and package concepts exist, but direct VIP/demo mutation and unsafe payment creation mean VIP is not production-safe yet.

### Coin package funnel

Coin package catalog exists in PayOS create flow, but the route still has unsafe legacy body fallback and unauthenticated/body-uid trust risk.

### Payment UX

Payment link creation exists. Production readiness depends on authenticated PayOS create, safe return/cancel URLs, webhook amount verification, idempotency, and owner-approved PayOS smoke testing.

### Paid chapter funnel

Paid chapter and unlock concepts exist. Current server/client flow is unsafe because price, buyer, author payout, and unlock state can be influenced by client-side code.

### Reader retention

Check-in, missions, bookmarks, reading progress, and creator flows exist, but several routes trust body `uid` and Firestore rules still permit unsafe writes.

### SEO/indexing

SEO foundations exist:

- `src/app/sitemap.ts`
- `public/robots.txt`
- OG image routes
- public novel/blog/chapter pages

Remaining risk: build/prerender behavior depends on valid Firebase client env and should be covered by CI before AI publishing scales.

### Content generation

AI generation and admin publishing routes exist. They need stronger admin auth, budget controls, smoke tests, and operational reports before daily automation can safely scale.

### Admin revenue monitoring

Revenue/dashboard components exist, but direct client-side money mutations and weak admin auth make current monitoring unreliable for real accounting.

## Recommended Phase Roadmap

### Phase 0.3: CI/validation gate

Add GitHub Actions or equivalent CI for:

- lint
- typecheck
- build
- docs-only diff check when appropriate
- security smoke tests once created

### Phase 0.4: Auth/admin hardening

Implement server-side Firebase ID token verification and secure admin authorization:

- no `x-admin-email` trust
- no `NEXT_PUBLIC_ADMIN_EMAILS` as secure proof
- server-only admin allowlist
- server-to-server machine token preserved where needed

### Phase 0.5: PayOS/payment hardening

Harden:

- authenticated payment create
- server catalog only
- server-generated order code
- trusted return/cancel URLs
- webhook signature verification
- webhook paid amount match
- idempotent coin/VIP credit

### Phase 0.6: Coin/VIP/unlock hardening

Move all money mutations behind secure server routes:

- check-in rewards
- missions rewards
- bookmark/progress identity
- paid chapter unlock
- donations
- demo recharge/VIP removal
- admin test coin removal
- withdrawal request/review APIs

### Phase 0.7: Firestore rules lockdown

Block client SDK writes to:

- coins
- VIP fields
- paid unlocks
- transactions
- orders/payments
- withdrawals
- admin/accounting fields

Preserve only safe profile, reading, bookshelf, and public read behavior.

### Phase 0.8: Security smoke tests

Add lightweight smoke tests/checklists for:

- spoofed admin email
- missing/invalid Firebase token
- forged body `uid`
- unsafe PayOS amount/order fields
- duplicate webhook
- double unlock
- Firestore money rule expectations

### Phase 1.0: Revenue conversion foundation

After P0 safety work:

- improve VIP/coin CTA placement
- payment success/failure UX
- paid chapter discovery
- SEO content pipeline
- revenue dashboard accuracy
- owner-controlled daily reports

## Final Gate

`PHASE_0_2_BLOCKED_VALIDATION_FAILED`

Reason:

- `npm.cmd run lint` fails with `176 errors / 107 warnings`.
- `npm.cmd run build` fails in local prerender with `auth/invalid-api-key`.
- The audit itself is documentation-only, but current master is not clean enough for monetization, automation, or production deploy confidence.
