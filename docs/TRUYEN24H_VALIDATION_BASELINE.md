# Truyen24h Validation Baseline

Baseline recorded: 2026-06-03 21:45:03 +07:00

## Scope

This baseline records the state after adding the operating rulebook:

- `docs/TRUYEN24H_AGENT_OPERATING_CONSTITUTION_AND_MONEY_AUTOMATION.md` exists.
- The rulebook task did not intentionally change runtime code.
- `AGENTS.md` now points future AI/dev agents to the rulebook before work begins.

## Current Validation State

- `npm.cmd run lint`: fails with 88 pre-existing runtime lint errors.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

The lint failure is known baseline debt. Future code tasks must avoid adding new
lint errors. When touching runtime code, agents should either fix lint errors in
the files they touch or clearly separate pre-existing lint debt from new
regressions in their final report.

## Operating Goal And Control Boundaries

The long-term goal of `truyen24h.vn` is monetization and near-100% safe
automation for content operations, SEO, monitoring, bug fixing, reporting,
revenue optimization, and routine admin workflows.

Money, bank accounts, secrets, production deploys, Firestore rules deployment,
high-risk approvals, and other critical owner-controlled actions remain under
the owner's control unless explicitly approved.
