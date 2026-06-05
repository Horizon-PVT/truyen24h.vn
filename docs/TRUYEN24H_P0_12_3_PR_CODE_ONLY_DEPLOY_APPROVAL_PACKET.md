# TRUYEN24H P0.12.3 PR / Code-Only Deploy Approval Packet

Date/time: 2026-06-05 20:31:40 +07:00

## 1. Executive Summary

P0 security hardening is ready for owner review on branch `p0-security-hardening-integration`.

This packet prepares a code-only review/deploy path. It does not approve or perform a deploy, push, PR creation, merge, PayOS transaction, or Firestore rules deployment.

Firestore rules are prepared locally as part of the P0 lockdown work, but they must not be deployed yet. First deploy application code only, then rerun production smoke, then decide whether to deploy rules in a separate controlled phase.

Full-repo lint still fails with out-of-scope debt from the integrated `origin/master` codebase. P0/security changed files and focused conflict-resolution files were reconciled in P0.12.2A and are lint-clean. Security smoke passes 14/14 and typecheck passes. P0.12.2A recorded a passing build; the P0.12.3 local build retry is currently blocked by environment/cache issues described in the validation section.

## 2. Branch Summary

- Current branch: `p0-security-hardening-integration`
- Base branch: `origin/master`
- Base commit: `f40363b feat(vip): honor user.vipUntil window - monthly subscribers unlock all VIP chapters`
- Local latest commit: `f40363b feat(vip): honor user.vipUntil window - monthly subscribers unlock all VIP chapters`
- Branch pushed: no
- PR exists: no
- Firestore rules deployed: no
- Working tree state: local P0 integration work is still dirty/uncommitted and must be reviewed before push.

## 3. P0 Security Work Included

- Server-side Firebase ID token helper through `requireFirebaseUser`.
- Admin authorization hardening with no trust in `x-admin-email`.
- User-sensitive route hardening for check-in, missions, bookmarks, and withdrawal request.
- PayOS create/webhook hardening with server-derived package data, verified Firebase user identity, signature verification, amount matching, and idempotency.
- Paid chapter unlock hardening with verified buyer identity, server-derived price/author, Admin SDK transaction, and idempotency.
- Firestore money rules lockdown prepared locally, not deployed.
- Security smoke test script covering the P0 hardening contracts.
- Direct donate hardening with verified donor identity and server-side transaction.
- Demo recharge/VIP mutation removed from production user flow.
- Admin test coin mutation removed from Creator Studio flow.
- Admin withdrawal review secure API added; review updates status/audit only and does not send money.
- Deployment readiness, smoke, integration, lint reconciliation, and owner-control documentation.

## 4. Changed Files Summary

### Runtime Security Files

- `src/lib/apiAuth.ts`
- `src/lib/firestoreRest.ts`
- `src/app/api/admin/daily-run-cron/route.ts`
- `src/app/api/admin/daily-run/route.ts`
- `src/app/api/admin/generate-blog-post/route.ts`
- `src/app/api/admin/newsletter/list/route.ts`
- `src/app/api/admin/payos-status/route.ts`
- `src/app/api/admin/publish-chapter/route.ts`
- `src/app/api/admin/publish-novel/route.ts`
- `src/app/api/admin/translate-chapter/route.ts`
- `src/app/api/admin/withdraw/review/route.ts`
- `src/app/api/ai/generate-chapter/route.ts`
- `src/app/api/ai/generate-novel/route.ts`
- `src/app/api/bookmark/toggle/route.ts`
- `src/app/api/checkin/claim/route.ts`
- `src/app/api/donate/route.ts`
- `src/app/api/missions/claim/route.ts`
- `src/app/api/missions/progress/route.ts`
- `src/app/api/payos/create/route.ts`
- `src/app/api/unlock-chapter/route.ts`
- `src/app/api/webhooks/payos/route.ts`
- `src/app/api/withdraw/request/route.ts`

### Client Compatibility Files

- `src/app/doc/[slug]/[chapter_id]/page.tsx`
- `src/app/vip/page.tsx`
- `src/components/AdminClientWrapper.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/BookshelfView.tsx`
- `src/components/CheckInModal.tsx`
- `src/components/CreatorStudioView.tsx`
- `src/components/NovelDetailView.tsx`
- `src/components/ProfileEditModal.tsx`
- `src/components/ReaderView.tsx`
- `src/types.ts`

### Firestore Rules File

- `firestore.rules` is changed locally for P0.7 lockdown, but must not be deployed during the first code-only deploy.

### Smoke Test Scripts

- `scripts/security-smoke-tests/security-smoke.mjs`

### Docs / Reports

- `AGENTS.md`
- `docs/TRUYEN24H_AGENT_OPERATING_CONSTITUTION_AND_MONEY_AUTOMATION.md`
- `docs/TRUYEN24H_VALIDATION_BASELINE.md`
- `docs/TRUYEN24H_P0_SECURITY_HARDENING_PLAN.md`
- `docs/TRUYEN24H_P0_3_ADMIN_AUTH_HARDENING_REPORT.md`
- `docs/TRUYEN24H_P0_4_SENSITIVE_USER_ROUTE_HARDENING_REPORT.md`
- `docs/TRUYEN24H_P0_5_PAYOS_HARDENING_REPORT.md`
- `docs/TRUYEN24H_P0_6_UNLOCK_CHAPTER_MONEY_HARDENING_REPORT.md`
- `docs/TRUYEN24H_P0_7_FIRESTORE_MONEY_RULES_LOCKDOWN_REPORT.md`
- `docs/TRUYEN24H_P0_8_SECURITY_SMOKE_TESTS_REPORT.md`
- `docs/TRUYEN24H_P0_9_DEPLOY_READINESS_REVIEW.md`
- `docs/TRUYEN24H_P0_10_REMAINING_MONEY_ADMIN_HARDENING_REPORT.md`
- `docs/TRUYEN24H_P0_11_CONTROLLED_DEPLOY_PACKAGE.md`
- `docs/TRUYEN24H_P0_12_PRODUCTION_MANUAL_SMOKE_EXECUTION_REPORT.md`
- `docs/TRUYEN24H_P0_12_1_PRODUCTION_DEPLOYMENT_SOURCE_REVIEW.md`
- `docs/TRUYEN24H_P0_12_2_SAFE_INTEGRATION_BRANCH_REPORT.md`
- `docs/TRUYEN24H_P0_12_2A_LINT_RECONCILIATION_REPORT.md`
- `docs/TRUYEN24H_P0_12_3_PR_CODE_ONLY_DEPLOY_APPROVAL_PACKET.md`

### Backup / Runtime Docs

- `docs/runtime/P0_12_2_INTEGRATION_BACKUP/local_dirty_diff.patch`
- `docs/runtime/P0_12_2_INTEGRATION_BACKUP/git_status_before.txt`
- `docs/runtime/P0_12_2_INTEGRATION_BACKUP/git_diff_stat_before.txt`
- `docs/runtime/P0_12_2_INTEGRATION_BACKUP/untracked_files_before.txt`

## 5. Validation Results

P0.12.3 validation:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 14/14.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run lint`: fail, 114 errors / 93 warnings. This matches the P0.12.2A reconciled full-repo lint debt and is outside the P0 changed-file scope.
- `npm.cmd run build`: not successfully reconfirmed in this P0.12.3 shell run.
  - Sandbox run failed because Next.js could not fetch Google Fonts (`Geist`, `Geist Mono`) from `fonts.googleapis.com`.
  - Escalated network run failed with `EPERM: operation not permitted, open '.next\\trace'`.
  - P0.12.2A previously recorded `npm.cmd run build`: pass.
  - Required before merge/deploy: rerun build in a clean local shell, CI, or Vercel build environment where Google Fonts access and `.next` cache permissions are healthy.

P0.12.2A validation baseline for this integration branch:

- Security smoke: pass 14/14.
- Focused lint on P0/security files: pass.
- Focused lint on conflict/integration files: pass.
- Typecheck: pass.
- Build: pass.
- Full repo lint: fail 114 errors / 93 warnings, out-of-scope full-repo debt.

## 6. Known Risk

- Full repo lint still fails with 114 errors / 93 warnings.
- Firestore rules are changed locally but must not be deployed with the first code-only deploy.
- Production smoke previously failed because P0 hardening had not been committed, pushed, and deployed.
- After code-only deploy, P0.12A production smoke must be rerun.
- PayOS test transaction requires explicit owner approval.
- Admin/user route smoke requires real Firebase sessions and ID tokens.
- Build should be reconfirmed in a clean environment before merge/deploy because the latest P0.12.3 local build attempt was blocked by sandbox/network/cache issues.

## 7. Owner Approval Gates

The owner must approve these actions separately:

- Push integration branch.
- Create PR.
- Merge PR.
- Code-only production deploy.
- PayOS test transaction.
- Firestore rules deploy.
- Production automation enablement.

No approval in one gate should be treated as approval for another gate.

## 8. Recommended PR Title and Body

Recommended PR title:

```text
P0 security hardening for auth, PayOS, unlock, donate, and admin flows
```

Ready-to-copy PR body:

```markdown
## Summary

This PR integrates P0 security hardening for truyen24h.vn before scaling monetization and automation.

It hardens server-side auth, admin authorization, user-sensitive routes, PayOS create/webhook handling, paid chapter unlock, direct donate, and admin withdrawal review. It also adds security smoke tests and deploy-readiness documentation.

This PR is intended for code-only deployment first. Firestore rules are prepared in the branch but must not be deployed until production code smoke passes.

## Security Impact

- Adds reusable Firebase Admin ID token verification through `requireFirebaseUser`.
- Removes trust in spoofable `x-admin-email` for admin authorization.
- Requires verified Firebase user identity for sensitive user routes.
- Requires verified Firebase user identity for PayOS create.
- Derives PayOS amount/coins/VIP package data from server catalog.
- Verifies PayOS webhook signature and paid amount before crediting.
- Preserves webhook idempotency to avoid double-crediting.
- Derives paid chapter buyer, price, and author payout recipient server-side.
- Makes paid chapter unlock idempotent to avoid double-charge.
- Hardens direct donate to use verified donor identity.
- Removes demo recharge/VIP and admin test coin mutation from production flows.
- Adds secure admin withdrawal review route that updates status/audit only and does not send money.

## Files / Areas Changed

- Auth/admin helpers and admin API authorization.
- User-sensitive API routes: check-in, missions, bookmark, withdrawal request.
- PayOS create and webhook routes.
- Paid chapter unlock route.
- Direct donate route.
- Client callers updated to send Firebase ID tokens where needed.
- Firestore rules file prepared for money/admin lockdown, not deployed.
- Security smoke tests under `scripts/security-smoke-tests/`.
- P0 deploy readiness and owner-control documentation under `docs/`.

## Validation

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass 14/14.
- Focused lint on P0/security files: pass.
- Focused lint on integration/conflict files: pass.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: passed in P0.12.2A. Latest P0.12.3 retry should be repeated in a clean build environment because local sandbox/cache blocked reconfirmation.
- `npm.cmd run lint`: fails 114 errors / 93 warnings from known full-repo lint debt outside the P0 changed-file scope.

## Known Lint Debt

Full-repo lint still fails. P0.12.2A reconciled the branch and found P0/security files plus focused conflict-resolution files lint-clean. The remaining 114 errors / 93 warnings are full-repo debt from the integrated `origin/master` codebase and should not be confused with P0 security regressions.

## Firestore Rules Warning

Do not deploy Firestore rules with the first code deployment.

The branch includes prepared P0.7 Firestore money rules lockdown. These rules intentionally block direct client writes to money/admin fields and payment/transaction/withdrawal paths. Deploy them only after code-only production smoke passes and after a separate owner-approved Firestore rules deploy phase.

## Deployment Sequence

1. Merge/deploy code only.
2. Rerun P0.12A production smoke.
3. If code smoke passes, prepare P0.13 Firestore rules controlled deploy.
4. Run post-rules smoke after rules deployment.
5. Proceed to P1 revenue conversion work only after P0 smoke is stable.

## Rollback Notes

- Roll back the Vercel deployment if admin/user/payment/unlock routes fail after code deploy.
- Do not roll back or deploy Firestore rules during code-only rollback.
- If Firestore rules are later deployed and break client compatibility, roll back to the previously deployed Firestore rules version.
- Monitor 401/403 spikes, PayOS webhook failures, payment mismatch records, unlock double-charge reports, withdrawal status errors, and admin route failures.

## Post-Deploy Smoke Checklist

- Admin login works with Firebase token.
- `x-admin-email`-only admin access fails.
- Admin generation routes require secure admin auth.
- Admin withdrawal review requires secure admin auth and updates status/audit only.
- Login works.
- Check-in works.
- Bookmark/save/remove works.
- Reading progress works.
- Withdrawal request creates PENDING only.
- User cannot act as another uid.
- PayOS create requires login.
- Logged-in PayOS create sends only `packId`.
- PayOS test payment credits once, only with owner approval.
- Duplicate webhook does not double-credit.
- Amount mismatch does not credit, if safely testable.
- Paid chapter unlock works.
- Repeated unlock does not double-charge.
- Free/VIP/already-unlocked chapters do not charge.
- Donate requires login and uses verified donor uid.
- Demo recharge/VIP does not mutate coins/VIP.
```

## 9. Recommended Deployment Sequence

Stage 1: merge/deploy code only.

Stage 2: rerun P0.12A production smoke against the deployed production domain.

Stage 3: only if code smoke passes, prepare P0.13 Firestore rules controlled deploy.

Stage 4: run post-rules smoke after Firestore rules deployment.

Stage 5: proceed to P1 revenue conversion work only after P0 code and rules smoke are stable.

## 10. Final Gate

`OWNER_APPROVAL_REQUIRED_TO_PUSH`

The branch is prepared for owner review, but no push, PR, merge, deploy, PayOS transaction, or Firestore rules deployment has been performed.

Before merge/deploy, owner should require one clean build confirmation in CI, Vercel, or a clean local shell because the latest P0.12.3 local build retry was blocked by environment/cache conditions.

Recommended next task: P0.12.4 Owner-approved push and PR creation, or rerun `npm.cmd run build` in a clean environment before push if the owner wants stricter local gating.
