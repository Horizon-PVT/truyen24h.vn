# TRUYEN24H P0.12.1 Production Deployment Source Review

Date/time: 2026-06-04 18:46:00 +07:00
Tester: Codex
Scope: verify production deployment source/branch and prepare a safe code-only redeploy plan.

## Executive Summary

Production does not reflect the local P0 hardened code because the local P0 work is not committed or pushed to the production branch. The local checkout is on `master`, but it is 40 commits behind `origin/master`, and the working tree contains many modified and untracked files.

No code-only redeploy was performed in this task. Firestore rules were not deployed.

Final gate: `NOT_COMMITTED_OR_NOT_PUSHED`

## Local Repository State

- Working directory used for validation: `D:\Project\A Tung\truyen24h.vn\truyen24h.vn`
- Local branch: `master`
- Local latest commit: `b9d7276 fix: restore AI recs auto-load + similar novels with limited 30-novel fetch`
- Remote: `origin https://github.com/takeuchi999999999-png/truyen24h.vn.git`
- Remote `origin/master` latest commit after fetch: `f40363b feat(vip): honor user.vipUntil window — monthly subscribers unlock all VIP chapters`
- Branch divergence: `master...origin/master = 0 ahead / 40 behind`
- Working tree dirty: yes
- P0 changes committed: no

Tracked diff summary:

```text
31 files changed, 1597 insertions(+), 678 deletions(-)
```

Important note: the tracked diff summary does not include many untracked P0 files under `docs/`, `scripts/`, `src/app/api/admin/`, `src/app/api/bookmark/`, `src/app/api/checkin/`, `src/app/api/donate/`, `src/app/api/missions/`, `src/app/api/unlock-chapter/`, `src/app/api/withdraw/`, and `src/lib/`.

## Required P0 Files

These required P0 files exist locally:

- `src/lib/apiAuth.ts`
- `src/app/api/admin/withdraw/review/route.ts`
- `src/app/api/payos/create/route.ts`
- `src/app/api/webhooks/payos/route.ts`
- `src/app/api/bookmark/toggle/route.ts`
- `src/app/api/unlock-chapter/route.ts`
- `src/app/api/donate/route.ts`
- `scripts/security-smoke-tests/security-smoke.mjs`
- `docs/TRUYEN24H_P0_12_PRODUCTION_MANUAL_SMOKE_EXECUTION_REPORT.md`

These required P0 files are absent from `origin/master`:

- `src/app/api/admin/withdraw/review/route.ts`
- `scripts/security-smoke-tests/security-smoke.mjs`
- `docs/TRUYEN24H_P0_12_PRODUCTION_MANUAL_SMOKE_EXECUTION_REPORT.md`

These required P0 files exist on `origin/master` but differ from the local hardened versions:

- `src/lib/apiAuth.ts`
- `src/app/api/payos/create/route.ts`
- `src/app/api/webhooks/payos/route.ts`
- `src/app/api/bookmark/toggle/route.ts`
- `src/app/api/unlock-chapter/route.ts`
- `src/app/api/donate/route.ts`

## Production Deployment Source Review

Known local Vercel metadata:

- `.vercel/project.json` exists.
- Project name: `truyen24h-vn`
- Project ID: `prj_NHw6uoDanzk2nvfCr0UjkcXBKbSb`
- Org ID: `team_xQbgz45bcjgHT9jedIJazVHR`

Vercel CLI status:

- `vercel --version` was not available earlier in the investigation, so latest production deployment commit and domain/project assignment could not be verified from CLI.

Production branch/source:

- Expected production branch: likely `master`, but must be confirmed in Vercel dashboard.
- Actual production branch/deployment source: unknown, manual Vercel access required.
- Latest production deployment commit: unknown, manual Vercel access required.
- Domain project mapping for `truyen24h.vn` and `www.truyen24h.vn`: unknown, manual Vercel access required.

## Diagnosis

Confirmed:

- `not committed`: yes. P0 hardening includes local modified and untracked files that are not committed.
- `not pushed`: yes. Required P0 files are absent from `origin/master`, and local branch is behind remote by 40 commits.
- `deployment cache/failed deploy`: not the primary evidence. Since P0 files are not on the production branch, a Git-based production deploy cannot include them.

Unknown / requires owner or Vercel dashboard access:

- `pushed to wrong branch`
- `Vercel connected to wrong branch`
- `Vercel connected to wrong project/repo`
- `domain points to wrong Vercel project`

Most likely root cause:

Production is running code from the connected Git branch, while the P0 hardening exists only in the local dirty working tree and has not been committed/pushed/redeployed.

## Manual Vercel Checks For Owner

Before any redeploy:

1. Open the Vercel project for `truyen24h.vn`.
2. Go to Settings -> Git.
3. Confirm the connected repository is `takeuchi999999999-png/truyen24h.vn`.
4. Confirm the production branch.
5. Go to Deployments.
6. Check the latest production deployment commit SHA.
7. Compare that SHA with:
   - local current commit: `b9d7276`
   - remote `origin/master`: `f40363b`
8. Confirm domains `truyen24h.vn` and `www.truyen24h.vn` are assigned to the intended Vercel project.
9. Trigger redeploy only after the P0 hardening is committed/pushed to the intended production source and the owner explicitly approves a code-only redeploy.

## Recommended Correction

Do not deploy Firestore rules yet.

Recommended sequence:

1. Preserve current local work.
2. Create a dedicated P0 deployment branch or otherwise reconcile the local dirty tree with `origin/master`.
3. Bring in the 40 remote commits from `origin/master` without losing local P0 changes.
4. Resolve conflicts if any.
5. Re-run local validation.
6. Commit the P0 hardened code and documents.
7. Push to the branch Vercel is expected to deploy from, or deploy a preview branch first.
8. Confirm Vercel production branch and latest deployment SHA.
9. After owner approval, perform a code-only redeploy.
10. Do not deploy Firestore rules until post-code production smoke passes.

Code-only redeploy readiness:

- Safe to attempt now: no.
- Reason: P0 hardening is not committed/pushed, local branch is behind remote by 40 commits, and working tree is heavily dirty.
- Next safe state: committed/pushed P0 branch aligned with the intended Vercel production source.

## Post-Redeploy Smoke Expectations

No redeploy was performed in this task. After an owner-approved code-only redeploy, rerun production endpoint smoke:

- `/api/admin/withdraw/review` should no longer return `404`.
- `/api/payos/create` without auth should return `401`.
- `/api/bookmark/toggle` without auth should return `401`.
- `/api/unlock-chapter` without auth should return `401`.
- `/api/donate` without auth should return `401`.
- `/api/checkin/claim` without auth should return `401`.

## Validation Results

Commands were run from `D:\Project\A Tung\truyen24h.vn\truyen24h.vn`.

An initial validation attempt from the parent directory `D:\Project\A Tung\truyen24h.vn` failed because that is not the actual Next.js repo directory:

- `node scripts/security-smoke-tests/security-smoke.mjs`: failed with module not found.
- `npx.cmd tsc --noEmit --pretty false`: failed because TypeScript was not installed in that parent directory context.

Correct repo validation:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 14/14 checks passed.
- `npm.cmd run lint`: fail with known lint debt, 75 errors / 84 warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass. Build output includes `/api/admin/withdraw/review`, `/api/payos/create`, `/api/bookmark/toggle`, `/api/unlock-chapter`, `/api/donate`, and `/api/checkin/claim`.

Lint count changed from 75 errors / 84 warnings: no.

## Safety Confirmations

- Runtime code changed in this task: no.
- Firestore rules changed in this task: no.
- Firestore rules deployed: no.
- Production code redeploy performed: no.
- Secrets printed: no.
- PayOS payment triggered: no.
- Money sent: no.
- Force push performed: no.

## Final Gate

`NOT_COMMITTED_OR_NOT_PUSHED`

## Recommended Next Task

P0.12.2 — Prepare a safe P0 integration branch from `origin/master`, preserve current local hardening, resolve any conflicts, rerun validation, and produce an owner approval packet for code-only deploy. Do not deploy Firestore rules.
