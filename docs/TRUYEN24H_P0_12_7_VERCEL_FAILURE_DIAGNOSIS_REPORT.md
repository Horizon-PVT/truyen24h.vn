# TRUYEN24H P0.12.7 Vercel Failure Diagnosis Report

Date/time: 2026-06-11, Asia/Bangkok

## PR URL

https://github.com/Horizon-PVT/truyen24h.vn/pull/2

## Current PR Mergeability

- PR state: open
- Merged: no
- Mergeable: true
- Head branch: `p0-security-hardening-integration`
- Head SHA: `04a5ba5699a35cbbcd957bc8387f78c62dcab8e4`

## Failed Vercel Checks

GitHub status for head `04a5ba5699a35cbbcd957bc8387f78c62dcab8e4` reports:

- `Vercel - truyen24h-vn`: failure
- `Vercel - webtruyenhay-next`: failure

GitHub status descriptions recommend:

```powershell
npx vercel inspect dpl_GTqLFByCAPGME3RtQr9sVRBW1SFa --logs
npx vercel inspect dpl_H74KQqnDp3bWb98hN4ioVxg6dhs3 --logs
```

Both inspect commands were run locally. No secrets were printed.

## truyen24h-vn Failure

- Project/check name: `Vercel - truyen24h-vn`
- Deployment URL: https://vercel.com/pham-tungs-projects-09cdcc5e/truyen24h-vn/GTqLFByCAPGME3RtQr9sVRBW1SFa
- Deployment id: `dpl_GTqLFByCAPGME3RtQr9sVRBW1SFa`
- Commit SHA: `04a5ba5`
- Install command visible in logs: Vercel default dependency install
- Build command visible in logs: `npm run build`
- Build status: failed
- Exact failure class: Firebase preview build configuration failure

Relevant log excerpt:

```text
Running "npm run build"
> webtruyenhay-next@0.1.0 build
> next build

✓ Compiled successfully
Running TypeScript ...
Finished TypeScript ...
Collecting page data using 3 workers ...
Generating static pages using 3 workers (12/51)
Error occurred prerendering page "/bang-xep-hang".
Error [FirebaseError]: Firebase: Error (auth/invalid-api-key).
code: 'auth/invalid-api-key'
Export encountered an error on /bang-xep-hang/page: /bang-xep-hang, exiting the build.
Error: Command "npm run build" exited with 1
```

Also present, but not fatal by itself:

```text
Turbopack build encountered 1 warnings:
./next.config.ts
Encountered unexpected file in NFT list
Import trace:
  App Route:
    ./next.config.ts
    ./src/app/api/admin/deploy-rules/route.ts
```

### Diagnosis

`truyen24h-vn` fails during `next build`, not lint. The source compiles and TypeScript passes, then prerender crashes when Firebase client initialization sees an invalid API key.

This points to missing or invalid Firebase public client env vars in Vercel for the PR/Preview environment, especially:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` if used by the deployed Firebase app

The failing page is `/bang-xep-hang`, but the underlying initializer is `src/firebase.ts`, which reads those `NEXT_PUBLIC_FIREBASE_*` variables.

Classification: **missing/invalid preview env vars**, not confirmed source-code failure.

Blocking status: **blocking** for PR merge/deploy if branch protection requires Vercel checks, and blocking for a clean production deploy signal.

## webtruyenhay-next Failure

- Project/check name: `Vercel - webtruyenhay-next`
- Deployment URL: https://vercel.com/pham-tungs-projects-09cdcc5e/webtruyenhay-next/H74KQqnDp3bWb98hN4ioVxg6dhs3
- Deployment id: `dpl_H74KQqnDp3bWb98hN4ioVxg6dhs3`
- Commit SHA: `04a5ba5`
- Install command visible in logs: Vercel default dependency install
- Build command visible in logs: `npm run build`
- Build status: failed
- Exact failure class: same Firebase preview build configuration failure

Relevant log excerpt:

```text
Running "npm run build"
> webtruyenhay-next@0.1.0 build
> next build

✓ Compiled successfully
Running TypeScript ...
Finished TypeScript ...
Collecting page data using 3 workers ...
Generating static pages using 3 workers (12/51)
Error occurred prerendering page "/bang-xep-hang".
Error [FirebaseError]: Firebase: Error (auth/invalid-api-key).
code: 'auth/invalid-api-key'
Export encountered an error on /bang-xep-hang/page: /bang-xep-hang, exiting the build.
Error: Command "npm run build" exited with 1
```

### Diagnosis

`webtruyenhay-next` fails for the same reason as `truyen24h-vn`: Firebase client config is invalid during Vercel preview build.

This project may be a legacy/duplicate Vercel project because the intended production-facing name appears to be `truyen24h-vn`, but both projects are currently connected to the same PR head and both run the same build.

Classification: **missing/invalid preview env vars or duplicate project config issue**.

Blocking status:

- If branch protection requires this check, it blocks merge.
- If this is a legacy duplicate project, owner should decide whether to disconnect it from the GitHub repo or remove it from required checks.

## Comparison With Local Validation

Local validation on branch `p0-security-hardening-integration`:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass `14/14`
- `npx.cmd tsc --noEmit --pretty false`: pass
- `npm.cmd run build`: pass
- `npm.cmd run lint`: fails known full-repo debt, `114 errors / 93 warnings`

Why local build differs:

- Local build loads `.env.local`, which provides valid Firebase public client values.
- Vercel preview build appears to lack valid Firebase public client values for at least `NEXT_PUBLIC_FIREBASE_API_KEY`.

## Build vs Preview Check

Both failed checks are real Vercel build failures:

- install completed
- `npm run build` started
- compile and TypeScript passed
- static prerender failed
- deployment did not complete successfully

This is not only a preview comment/status issue.

## Recommended Fix

Owner action in Vercel, no code change first:

1. Open Vercel project `truyen24h-vn`.
2. Check Settings -> Environment Variables.
3. Confirm the following variables exist with valid values for the Preview environment, and Production if production deploy is intended:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` if used
4. Redeploy the failed Vercel preview deployment or push a docs-only retry commit only after owner approval.
5. Decide whether `webtruyenhay-next` is an active project or legacy duplicate.
6. If `webtruyenhay-next` is legacy, disconnect it from the GitHub repo or remove it from required checks with owner approval.
7. If both projects are active, add the same valid Firebase public env vars to `webtruyenhay-next` Preview environment as well.

Do not change Firebase values in code. Do not commit env files.

## If Env Vars Are Already Present

If Vercel already has the variables, verify:

- the variables are enabled for Preview deployments, not only Production
- `NEXT_PUBLIC_FIREBASE_API_KEY` belongs to the same Firebase project as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- Vercel deployment was redeployed after env var changes
- there are no empty placeholder values

If that still fails, a minimal code hardening task can be planned separately to prevent build-time Firebase client initialization from crashing static prerender. That should be owner-approved because it touches runtime initialization behavior.

## Safety Confirmations

- No merge occurred.
- No deploy was manually triggered.
- Firestore rules were not deployed.
- No runtime code was changed.
- No env files were changed.
- No secret values were printed.
- PayOS was not triggered.
- No money was sent.

## Final Gate

`VERCEL_ENV_FIX_REQUIRED`

## Recommended Next Task

P0.12.8 - Owner updates Vercel Preview Firebase public env vars and reruns PR #2 checks.

If `webtruyenhay-next` is confirmed legacy, owner should decide whether to disconnect/ignore that project before treating it as a blocker.
