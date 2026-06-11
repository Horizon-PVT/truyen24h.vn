# Phase 0.1 Agent Workflow Setup

## Goal

Create the baseline documentation files that future AI/dev agents must read before working in `truyen24h.vn`.

## Required Files

- `AGENTS.md`
- `CODEX.md`
- `CLAUDE.md`
- `ANTIGRAVITY.md`
- `docs/AGENT_WORKFLOW.md`
- `docs/CURRENT_STATUS.md`
- `docs/MONEY_ROADMAP.md`
- `docs/tasks/PHASE_0_1_AGENT_WORKFLOW_SETUP.md`
- `docs/reports/PHASE_0_1_AGENT_WORKFLOW_SETUP_REPORT.md`
- `docs/reports/.gitkeep`
- `docs/reviews/.gitkeep`
- `docs/qa/.gitkeep`

## Scope

Documentation-only.

Do not modify:

- runtime code
- `package.json`
- env files
- Firestore rules
- payment, PayOS, ads, analytics, or money-related settings

Do not:

- deploy
- merge
- trigger PayOS
- send money

## Validation

Run:

```powershell
git diff --check
git status -sb
```

Confirm changed files are documentation-only.

## Final Gate

`PHASE_0_1_DOCS_ONLY_READY_FOR_REVIEW`
