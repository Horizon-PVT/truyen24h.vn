# Phase 0.2 - Master Baseline Audit & Money-Safety Task Map

## Objective

Audit the current `master` baseline before any monetization, automation, or security-hardening implementation work continues.

The goal is to document what is currently safe, what is not safe, and which next phases must be executed before `truyen24h.vn` can operate as a real money-making Vietnamese web novel platform with AI-assisted operations.

## Scope

Inspect the current `master` code and documentation for:

- authentication
- admin authorization
- user-sensitive API routes
- PayOS/payment flow
- coin/VIP mutation
- paid chapter unlock flow
- donate flow
- withdrawal request and review flow
- Firestore rules
- AI generation
- automation/cron
- SEO/sitemap
- CI/build/lint scripts
- deployment config
- documentation gaps

Create a baseline report at:

- `docs/reports/PHASE_0_2_MASTER_BASELINE_AUDIT_REPORT.md`

## Non-Goals

This phase is documentation-only.

Do not:

- modify runtime code
- modify `package.json`
- modify env files
- modify Firestore rules
- modify payment/PayOS code
- deploy
- merge
- trigger PayOS
- send money
- print secrets

## Files and Areas to Inspect

Primary agent workflow docs:

- `AGENTS.md`
- `CODEX.md`
- `CLAUDE.md`
- `ANTIGRAVITY.md`
- `docs/AGENT_WORKFLOW.md`
- `docs/CURRENT_STATUS.md`
- `docs/MONEY_ROADMAP.md`
- `docs/tasks/PHASE_0_1_AGENT_WORKFLOW_SETUP.md`

Security and money-sensitive areas:

- `src/lib/apiAuth.ts`
- `src/lib/admin.ts`
- `src/lib/firebaseAdmin.ts`
- `src/app/api/admin/**`
- `src/app/api/payos/**`
- `src/app/api/webhooks/payos/**`
- `src/app/api/unlock-chapter/**`
- `src/app/api/donate/**`
- `src/app/api/checkin/**`
- `src/app/api/missions/**`
- `src/app/api/bookmark/**`
- `src/app/api/withdraw/**`
- `src/components/**`
- `firestore.rules`

Platform operations:

- `package.json`
- `.github/workflows/**`
- `vercel.json`
- `next.config.ts`
- `src/app/sitemap.ts`
- `public/robots.txt`

## Validation Commands

Run and record:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit --pretty false
npm.cmd run build
git diff --check
git status -sb
```

If any command fails, record the exact reason in the report. Do not hide failures.

## Expected Output

The final report must include:

- executive summary
- master branch state
- validation baseline
- money-safety audit
- agent-automation readiness
- revenue readiness
- recommended phase roadmap
- final gate

## Final Gate

Use one:

- `PHASE_0_2_BASELINE_READY_FOR_REVIEW`
- `PHASE_0_2_BLOCKED_VALIDATION_FAILED`
- `PHASE_0_2_BLOCKED_REPO_STATE_DIRTY`
