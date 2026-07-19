# Truyen24h P0.5 PayOS Hardening Report

Date: 2026-06-03

## Files Changed

- `src/app/api/payos/create/route.ts`
- `src/app/api/webhooks/payos/route.ts`
- `src/app/vip/page.tsx`

## PayOS Create Before

- Client generated `orderCode`.
- Client created `orders/{orderCode}` directly.
- Client sent `orderCode`, `amount`, `description`, `returnUrl`, and
  `cancelUrl` to `/api/payos/create`.
- The create route trusted body-provided `orderCode` and `amount`.
- Redirect URLs could be influenced by client input.

## PayOS Create After

- `/api/payos/create` requires `Authorization: Bearer <Firebase ID token>`.
- The route uses `requireFirebaseUser(request)` and derives `uid` from the
  verified token.
- The client sends only `packId`.
- Server selects `amount`, `coins`, `isMonthly`, `vipDays`, title, and
  description from a server-side package catalog.
- Server generates `orderCode`.
- Server creates `orders/{orderCode}` as `PENDING` with trusted data before
  creating the PayOS payment link.
- Return/cancel URLs are derived from `getSiteUrl()` and are not accepted from
  arbitrary client input.

## Webhook Before

- Webhook verified PayOS signature, then read the order.
- It did not compare webhook paid amount with stored order amount before
  crediting.
- It credited `orderData.coins`, which could come from a client-created order.
- User credit and order status update were separate writes, so duplicate or
  partial processing risk remained.
- It used the client Firebase SDK in a server route.

## Webhook After

- Webhook verifies PayOS signature before trusting webhook data.
- Webhook extracts `orderCode` and `amount` only from verified PayOS data.
- Webhook reads the matching server-created order.
- Webhook compares paid amount with server-stored `order.amount`.
- Amount mismatch is recorded as `PAYMENT_MISMATCH` and does not credit
  coins/VIP.
- Already `PAID` orders return an idempotent success message and are not credited
  again.
- Valid pending orders are processed inside a Firebase Admin transaction:
  - mark order `PAID`;
  - credit server-stored `coins`;
  - set `vipPlan`/`vipUntil` for monthly packs;
  - write `transactions/payos_{orderCode}` as an audit record.

## Body Fields Now Ignored

Legacy client fields no longer control payment creation:

- `uid`
- `amount`
- `coins`
- `orderCode`
- `isMonthly`
- `description`
- `returnUrl`
- `cancelUrl`

The only accepted create body field is `packId`.

## Amount Verification

The webhook compares:

- verified PayOS webhook `amount`
- server-stored `orders/{orderCode}.amount`

Coins/VIP are credited only if the amounts match exactly and the order is still
`PENDING`.

## Idempotency

The webhook checks `orders/{orderCode}.status` inside the Admin transaction.

- `PAID`: returns success without another credit.
- `PENDING` + valid amount: credits exactly once and marks `PAID`.
- Mismatch/invalid server order: records a non-paid status and does not credit.

## Client Compatibility

- `src/app/vip/page.tsx` now sends Firebase ID token and `{ packId }` only.
- Old unauthenticated requests to `/api/payos/create` now receive 401.
- Old callers sending `amount`, `coins`, `orderCode`, `returnUrl`, or
  `cancelUrl` may still send them, but they no longer control server behavior.

## Required Env Vars

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or valid Google application credentials
- `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL` for production-safe redirect URLs

## Not Changed

- `src/app/api/unlock-chapter/**`
- `src/app/api/donate/**`
- `firestore.rules`
- admin routes
- TTS route
- `package.json`
- deployment config
- env files
- payout/withdrawal approval behavior

No payout automation was added.

## Validation Results

- `npx.cmd eslint src/lib/apiAuth.ts`: pass.
- `npx.cmd eslint src/app/api/payos/create/route.ts`: pass.
- `npx.cmd eslint src/app/api/webhooks/payos/route.ts`: pass.
- `npx.cmd eslint src/app/vip/page.tsx`: pass.
- `npm.cmd run lint`: fails with known project lint debt, now 78 errors / 85
  warnings. This is lower than the P0.4 baseline of 81 errors / 87 warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

## Next Recommended Task

P0.6 Unlock/chapter money hardening: make paid chapter unlock server-trusted by
verifying Firebase identity, reading chapter price/author server-side, and
removing trust in body-provided `buyerId`, `authorId`, and `chapterPrice`.
