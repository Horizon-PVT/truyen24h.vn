<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Truyen24h Agent Workflow

Before changing this repository, read:

- `docs/AGENT_WORKFLOW.md`
- `docs/CURRENT_STATUS.md`
- `docs/MONEY_ROADMAP.md`

Operating rules:

- Keep documentation-only tasks documentation-only.
- Do not deploy, merge, push, or change production settings unless explicitly approved.
- Do not modify runtime code, Firestore rules, payment, PayOS, ads, analytics, package, or env files during documentation-only phases.
- Treat money, bank accounts, secrets, production deploys, Firestore rules deployment, and high-risk automation as owner-controlled.
- Report validation truthfully, including known lint/build/test debt.
