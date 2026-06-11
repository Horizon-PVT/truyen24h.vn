# TRUYEN24H P0.12A Production Manual Smoke Execution Report

Updated: 2026-06-04 18:09:19 +07:00

## 1. Deployment State

- Code deployed: no / current P0 hardening was not observed on production.
- Deployment URL / production domain tested: `https://truyen24h.vn`, resolved to
  `https://www.truyen24h.vn/`.
- Firestore rules deployed: no. Firestore rules were not deployed in this task.
- Tester: Codex, using local validation plus non-mutating/unauthenticated
  production smoke requests.

Production domain public check:

- `HEAD https://truyen24h.vn`: `200`, resolved to `https://www.truyen24h.vn/`.

Critical deployment observation:

- Production responses do not match the P0 local hardening code.
- `/api/admin/withdraw/review` returns `404`, but the local P0.10 code/build
  contains this route.
- Several unauthenticated sensitive routes return `200`, `400`, or `500` where
  hardened production should return `401`.
- Conclusion: production appears to be on an older deployment, wrong branch, or
  mismatched build/runtime. Do not deploy Firestore rules yet.

## 2. Local Validation

Commands run:

```powershell
node scripts/security-smoke-tests/security-smoke.mjs
npm.cmd run lint
npx.cmd tsc --noEmit --pretty false
npm.cmd run build
```

Results:

- `node scripts/security-smoke-tests/security-smoke.mjs`: pass, 14/14 checks.
- `npm.cmd run lint`: fails with known lint debt, 75 errors / 84 warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

Lint count did not change from the P0.11/P0.12 baseline of 75 errors / 84
warnings.

## 3. Production Non-Mutating API Smoke

Only unauthenticated or spoof-header requests were sent. No valid token, secret,
PayOS payment action, or payout action was used.

| Flow | Request | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| Public homepage | `HEAD /` | `200` | `200`, resolves to `https://www.truyen24h.vn/` | Pass |
| PayOS create no auth | `POST /api/payos/create` with forged body | `401` | `200` | Fail |
| Unlock no auth | `POST /api/unlock-chapter` with forged buyer/price/author | `401` | `500` | Fail |
| Donate no auth | `POST /api/donate` with forged donor/author/amount | `401` | `500` | Fail |
| Check-in no auth | `POST /api/checkin/claim` with forged uid | `401` | `500` | Fail |
| Bookmark no auth | `POST /api/bookmark/toggle` with forged uid | `401` | `200` | Fail |
| Withdraw request no auth | `POST /api/withdraw/request` with forged uid/bank fields | `401` | `400` | Fail |
| Admin withdrawal review no auth | `POST /api/admin/withdraw/review` | `401` | `404` | Fail |
| Admin withdrawal review x-admin-email only | `POST /api/admin/withdraw/review` with `x-admin-email` | `401` or `403` | `404` | Fail / route absent |

Important PayOS note:

- A no-auth request to `/api/payos/create` returned `200`.
- No payment link was followed and no real money was sent.
- Because this route should reject unauthenticated requests in the P0 hardening
  code, this is a production blocker.

## 4. Admin Smoke

Overall status: failed / blocked by production deployment mismatch.

| Check | Status | Evidence / Note |
| --- | --- | --- |
| Admin UI works with Firebase login | Manual pending | Requires owner/admin browser session. |
| `x-admin-email`-only access fails | Not fully tested on generation routes | Avoided calling generation routes because old production code could trigger side effects. |
| Admin generation routes require secure admin auth | Manual pending | Not called to avoid AI/content generation mutation risk. |
| Admin withdrawal review requires secure admin auth | Fail | `/api/admin/withdraw/review` returned `404`, so current P0 route is not deployed. |
| Admin withdrawal review only changes status/audit, no payout | Manual pending | Cannot test until the route exists on production and a controlled test request exists. |

Issue:

- Production lacks the P0.10 admin withdrawal review route.

## 5. User Smoke

Overall status: failed / blocked by production deployment mismatch.

| Check | Status | Evidence / Note |
| --- | --- | --- |
| Login works | Manual pending | Requires browser login. |
| Check-in works | Not tested with login | Unauthenticated check-in returned `500`, expected `401`. |
| Bookmark/save/remove works | Not tested with login | Unauthenticated bookmark returned `200`, expected `401`. |
| Reading progress works | Manual pending | Requires logged-in reader flow. |
| Withdraw request creates `PENDING` only | Not tested with login | Unauthenticated withdraw request returned `400`, expected `401`. |
| User cannot act as another uid | Not ready | Forged unauth user route checks did not consistently reject with `401`. |

Issues:

- `/api/bookmark/toggle` accepted an unauthenticated forged request with `200`.
- `/api/checkin/claim` returned `500` instead of a safe auth rejection.
- `/api/withdraw/request` returned `400` instead of a safe auth rejection.

## 6. PayOS Smoke

Overall status: `PAYOS_TEST_PENDING` plus production auth blocker.

Owner did not explicitly approve a PayOS test transaction. No real/test payment
was triggered and no money was sent.

| Check | Status | Evidence / Note |
| --- | --- | --- |
| Logged-in user can create PayOS payment link | Manual pending | Requires owner-approved logged-in production test. |
| Unauthenticated PayOS create fails 401 | Fail | Returned `200`, expected `401`. |
| Client only sends `packId` | Static pass locally | Offline smoke passes; production response suggests old route/deploy. |
| Successful test payment credits once | PayOS test pending | Requires explicit owner approval. |
| Duplicate webhook does not double-credit | PayOS test pending | Requires safe replay/test harness. |
| Amount mismatch does not credit | PayOS test pending | Requires safe mismatch simulation. |
| Payment success/failure UI behaves correctly | Manual pending | Requires browser flow. |

Production blocker:

- Do not run a PayOS paid test until `/api/payos/create` returns `401` for
  unauthenticated requests on production.

## 7. Unlock Smoke

Overall status: failed / blocked by production deployment mismatch.

| Check | Status | Evidence / Note |
| --- | --- | --- |
| Logged-in user can unlock paid chapter with enough coins | Manual pending | Requires test user/chapter. |
| Unauthenticated unlock fails 401 | Fail | Returned `500`, expected `401`. |
| Repeated unlock does not double-charge | Manual pending | Requires controlled logged-in test. |
| Free/VIP/already-unlocked does not charge | Manual pending | Requires controlled logged-in test fixtures. |
| Client cannot control `chapterPrice` / `authorId` | Not ready | Forged unauth request returned `500`; production route behavior is not matching P0 hardening. |

## 8. Donate Smoke

Overall status: failed / blocked by production deployment mismatch.

| Check | Status | Evidence / Note |
| --- | --- | --- |
| Donate requires login | Fail | Unauthenticated forged donate returned `500`, expected `401`. |
| Donate uses verified donor uid | Static pass locally | Offline smoke confirms local code; production needs redeploy. |
| Donate does not trust `donorId` | Static pass locally | Offline smoke confirms local code; production needs redeploy. |
| Donate only works with valid balance | Manual pending | Requires logged-in test user and known balance. |
| No direct client coin mutation | Static pass locally | Offline smoke confirms client no direct coin write in local code. |

## 9. Firestore Rules Smoke

Firestore rules deployment status: pending / not deployed.

Rules must remain undeployed until production code smoke passes. Current
production code smoke does not pass.

Pending checks after owner-controlled rules deploy:

- Client cannot write `users/{uid}.coins`.
- Client cannot write `users/{uid}.vipUntil`.
- Client cannot write `users/{uid}.unlockedChapters`.
- Client cannot create/update `orders`.
- Client cannot create/update `transactions`.
- Client cannot write `withdraw_requests` directly.
- Public novels/chapters/blog reads still work.
- Bookshelf/progress still works.

## 10. Issues Found

| Flow | Expected | Actual | Severity | Suspected file/area | Recommended fix phase |
| --- | --- | --- | --- | --- | --- |
| Production deployment | P0.10 routes and auth behavior present | `/api/admin/withdraw/review` is `404`; several routes mismatch P0 behavior | Critical | Vercel deployment branch/build/domain routing | P0.12.1 |
| PayOS create no auth | `401` | `200` | Critical | `/api/payos/create` production route likely old/insecure | P0.12.1 |
| Bookmark no auth | `401` | `200` | High | `/api/bookmark/toggle` production route likely old/insecure | P0.12.1 |
| Unlock no auth | `401` | `500` | High | `/api/unlock-chapter` production route or env/runtime mismatch | P0.12.1 |
| Donate no auth | `401` | `500` | High | `/api/donate` production route or env/runtime mismatch | P0.12.1 |
| Check-in no auth | `401` | `500` | High | `/api/checkin/claim` production route or env/runtime mismatch | P0.12.1 |
| Withdraw request no auth | `401` | `400` | Medium | `/api/withdraw/request` production route mismatch | P0.12.1 |
| Admin withdrawal review | `401` without auth, secured success with admin auth | `404` | High | Missing deployed route `/api/admin/withdraw/review` | P0.12.1 |

## 11. Final Gate

Final gate: `NOT_READY_FIX_REQUIRED`.

Reasons:

- Local P0 hardening is validation-ready: smoke 14/14, typecheck pass, build
  pass, lint debt unchanged.
- Production public domain responds with `200`.
- Production sensitive API behavior does not match P0 hardening.
- Production appears not to have the current P0.10/P0.12 code-only deploy.
- Firestore rules must not be deployed while production API hardening is absent
  or unverified.
- PayOS test must not proceed while unauthenticated PayOS create returns `200`.

## 12. Recommended Next Task

Recommended next task: P0.12.1 Verify production deployment source/branch and
redeploy code-only P0 hardening, then rerun P0.12A smoke.

P0.12.1 should:

- Confirm Vercel production deployment commit/branch matches the current P0
  hardened code.
- Confirm production domain routing points to the intended Vercel project.
- Redeploy code only with owner approval.
- Do not deploy Firestore rules.
- Re-run the same non-mutating production smoke:
  - `/api/payos/create` no auth should return `401`.
  - `/api/bookmark/toggle` no auth should return `401`.
  - `/api/unlock-chapter` no auth should return `401`.
  - `/api/donate` no auth should return `401`.
  - `/api/checkin/claim` no auth should return `401`.
  - `/api/withdraw/request` no auth should return `401`.
  - `/api/admin/withdraw/review` no auth should return `401`.
  - `x-admin-email` alone should not authorize admin review.

After that passes, proceed with owner/admin authenticated smoke and then decide
whether to run PayOS test payment.

## 13. Safety Confirmations

- No runtime code changed.
- No Firestore rules changed.
- Firestore rules were not deployed.
- No `package.json`, `vercel.json`, env file, workflow, PayOS config, or
  Firebase config changed.
- No secrets were printed.
- No real money was sent.
- No PayOS payment was triggered or followed.
- No owner/admin token was used.
- No production authenticated mutation was intentionally triggered.
