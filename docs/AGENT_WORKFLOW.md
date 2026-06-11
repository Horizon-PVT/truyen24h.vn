# Agent Workflow

This document defines the baseline workflow for AI/dev agents working on `truyen24h.vn`.

## Core Rules

- Read project instructions before editing.
- Keep the requested scope tight.
- Separate documentation, runtime code, Firestore rules, deployment, payment, and automation work into explicit phases.
- Never treat an automation goal as approval to touch money, secrets, deploys, or production settings.
- Preserve owner control of money, bank accounts, secrets, PayOS, Firestore rules deployment, production deploys, and high-risk approvals.

## Documentation-Only Tasks

Documentation-only means:

- No runtime code changes.
- No Firestore rules changes.
- No package changes.
- No env changes.
- No payment, PayOS, ads, analytics, or money-setting changes.
- No deploy or merge.

Allowed examples:

- docs
- reports
- reviews
- QA notes
- task plans
- root agent instruction files

## Branch And PR Workflow

Use a scoped branch for each task.

Recommended flow:

1. Confirm current branch and status.
2. Create or switch to a scoped branch.
3. Make only in-scope changes.
4. Run suitable validation.
5. Confirm changed files match the requested scope.
6. Commit with a clear message.
7. Push only when approved.
8. Open a PR for review.
9. Do not merge unless explicitly approved.

## Validation

For documentation-only tasks:

- `git diff --check`
- `git status -sb`
- Confirm changed files are documentation-only.

For runtime tasks, add project validation such as:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit --pretty false`
- `npm.cmd run build`

If validation fails due known baseline debt, report exact counts and scope.

## Reporting

Every substantial task should leave a report under `docs/reports/` or a relevant docs folder.

Reports should include:

- scope
- changed files
- validation
- what was not changed
- remaining risks
- next task
