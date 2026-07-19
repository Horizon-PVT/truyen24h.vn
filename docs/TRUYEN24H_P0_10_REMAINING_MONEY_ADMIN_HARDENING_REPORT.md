# TRUYEN24H P0.10 Remaining Money/Admin Direct-Write Hardening Report

Baseline time: 2026-06-04 17:36:45 +07:00

## Scope

P0.10 hardened the remaining direct money/admin mutation paths identified before a controlled deploy:

- Direct donate flow
- Demo recharge/VIP controls
- Admin test coin mutation
- Admin withdrawal status update

No deploy, commit, push, package install, environment edit, Firestore rules deployment, PayOS create/webhook change, or payout automation was performed.

## Files Changed

- `src/app/api/donate/route.ts`
- `src/app/api/admin/withdraw/review/route.ts`
- `src/components/NovelDetailView.tsx`
- `src/components/ProfileEditModal.tsx`
- `src/components/CreatorStudioView.tsx`
- `src/components/AdminDashboard.tsx`
- `scripts/security-smoke-tests/security-smoke.mjs`
- `docs/TRUYEN24H_P0_10_REMAINING_MONEY_ADMIN_HARDENING_REPORT.md`

## Remaining Money/Admin Direct-Write Paths Found

Search covered donate/donation/recharge/VIP/test coin/add coins/withdraw/status/approved/rejected/paid/admin/updateDoc/setDoc/addDoc/increment/arrayUnion/unlockedChapters/vipUntil/transactions.

Findings:

- `src/app/api/donate/route.ts` trusted client `donorId`, `authorId`, and `amount`, and used client Firebase SDK writes from an API route.
- `src/components/NovelDetailView.tsx` directly updated reader and author `users/*` coin fields from the client during donation.
- `src/components/ProfileEditModal.tsx` had demo recharge and demo VIP controls that directly mutated `coins`, `isVip`, and `badges`.
- `src/components/CreatorStudioView.tsx` had an admin-only UI button that directly incremented the current user's coins by 500 from the client.
- `src/components/AdminDashboard.tsx` directly updated `withdraw_requests/{id}.status` from the client.

## Paths Hardened

### Direct Donate Flow

Status: hardened.

`/api/donate` now:

- Requires `Authorization: Bearer <Firebase ID token>` through `requireFirebaseUser`.
- Uses `auth.user.uid` as the donor.
- Ignores client `donorId`.
- Accepts only `authorId` and `amount` as request inputs.
- Validates `authorId` and positive integer donation amount.
- Reads donor and author docs server-side.
- Uses Firebase Admin SDK transaction for coin deduction, author credit, contribution score, and audit transaction record.
- Returns safe public errors and does not expose token values or stack traces.

`NovelDetailView` now calls `/api/donate` with the user's Firebase ID token and no longer directly writes user coin fields.

### Demo Recharge/VIP

Status: disabled from money mutation.

`ProfileEditModal` no longer directly mutates:

- `coins`
- `isVip`
- `badges`

The "Nạp thêm" and "Nâng cấp VIP" controls now navigate to `/vip`, where the hardened PayOS flow is responsible for real top-up/VIP behavior.

### Admin Test Coin Mutation

Status: removed/deferred.

`CreatorStudioView` no longer exposes the "Bơm 500 Xu (Test Admin)" client-side increment button. This was not essential for production readiness and should only return later as a secure server-admin tool with audit logging.

### Admin Withdrawal Status Update

Status: hardened.

Added `/api/admin/withdraw/review`, which:

- Requires secure `authorizeAdmin`.
- Supports existing secure admin modes: verified Firebase admin user or server machine token.
- Does not trust `x-admin-email`.
- Accepts a safe `requestId` and review `status`.
- Allows only `COMPLETED` or `REJECTED`.
- Uses Firebase Admin SDK transaction.
- Only updates status/review/audit fields.
- Records `reviewedBy`, `reviewedByUid`, `reviewedAt`, `updatedAt`, and an `admin_audit_logs` entry.
- Does not send money or trigger payout automation.

`AdminDashboard` now calls this API with Firebase ID token instead of direct `updateDoc` on `withdraw_requests`.

## Disabled Or Deferred

- Demo recharge/VIP direct mutation: disabled by routing users to `/vip`.
- Admin test coin button: removed from the UI for now.
- Admin withdrawal listing still reads `withdraw_requests` client-side. This is not a direct write, but after strict Firestore rules deployment it may need a server-side admin list API if admin reads are blocked by rules.

## Firestore Rules Deploy Compatibility

P0.10 removes the main client direct writes that P0.7 rules would block:

- Client donation coin writes no longer needed.
- Client demo recharge/VIP writes no longer needed.
- Client admin test coin write no longer needed.
- Client withdrawal status write no longer needed.

Known compatibility risk:

- `AdminDashboard` still subscribes to `withdraw_requests` through the client SDK. If P0.7 rules deny admin-wide reads, the dashboard may need a follow-up server-side admin list route before or during rules deployment.

## Security Impact

- Normal users can no longer choose donation donor identity.
- Normal users can no longer directly grant themselves demo coins or VIP from the profile modal.
- Client UI can no longer directly mutate author coin balance during donation.
- Admin test coin mutation is removed from production-facing UI.
- Withdrawal status updates now require secure admin auth and are audited.
- No money is sent automatically. Owner-controlled payout remains intact.

## Validation Results

Focused checks:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 14/14 checks.
- `npx.cmd eslint src/lib/apiAuth.ts`: pass.
- `npx.cmd eslint src/app/api/donate/route.ts`: pass.
- `npx.cmd eslint src/app/api/admin/withdraw/review/route.ts`: pass.
- `npx.cmd eslint scripts/security-smoke-tests/security-smoke.mjs`: pass.
- `npx.cmd eslint src/components/AdminDashboard.tsx`: pass.
- `npx.cmd eslint src/components/ProfileEditModal.tsx`: pass with 1 pre-existing-style `no-img-element` warning.
- `npx.cmd eslint src/components/NovelDetailView.tsx`: pass with warnings only.
- `npx.cmd eslint src/components/CreatorStudioView.tsx`: pass with warnings only.

Required full validation:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 14/14 checks.
- `npm.cmd run lint`: fails with known lint debt, now 75 errors / 84 warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

Lint count changed from the requested current baseline of 77 errors / 85 warnings to 75 errors / 84 warnings. It did not increase.

## Remaining Risk

- Full lint still fails due pre-existing runtime lint debt in unrelated files.
- Admin withdrawal list reads may need a secure server route before Firestore rules are deployed if rules block admin dashboard client reads.
- Donation idempotency is audit-backed but does not yet use a caller-provided idempotency key; repeated intentional clicks create repeated donations. If accidental double-click protection becomes required, add a server-generated or client-request idempotency key contract in a separate phase.

## Recommended Next Task

P0.11 Controlled deploy package / owner checklist.

Recommended scope:

- Produce the deploy bundle checklist.
- Decide whether Firestore rules deploy should be staged separately.
- Add or plan a secure admin withdrawal list API if owner wants admin dashboard compatibility under locked rules.
- Re-run smoke/typecheck/build immediately before any owner-approved deploy.
