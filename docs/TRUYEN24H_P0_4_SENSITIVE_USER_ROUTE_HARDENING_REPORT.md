# Truyen24h P0.4 Sensitive User Route Hardening Report

Date: 2026-06-03

## Routes Hardened

- `src/app/api/checkin/claim/route.ts`
- `src/app/api/missions/progress/route.ts`
- `src/app/api/missions/claim/route.ts`
- `src/app/api/bookmark/toggle/route.ts`
- `src/app/api/withdraw/request/route.ts`

All five routes now require `Authorization: Bearer <Firebase ID token>` and use
`requireFirebaseUser(request)` to derive the trusted `uid`.

## Body Fields Ignored For Identity Or Money

- `uid` and `email` from request body are not used.
- `amount`, `coins`, `balance`, and client-selected withdrawal amount are not
  used.
- Bookmark/check-in/mission writes target `users/{verifiedUid}/...` only.
- Withdrawal requests are created for `verifiedUid` only.
- Withdrawal amount is calculated by the server from the verified user's
  Firestore balance inside a transaction.

## Client Callers Updated

- `src/components/CheckInModal.tsx`
  - Check-in claim now calls `/api/checkin/claim` with a Firebase ID token.
  - The client no longer increments `users/{uid}.coins` directly for this flow.
- `src/components/BookshelfView.tsx`
  - Daily check-in card now calls `/api/checkin/claim`.
  - Delete from bookshelf now calls `/api/bookmark/toggle` with `action:
    "remove"`.
- `src/components/ReaderView.tsx`
  - Reading progress save now calls `/api/bookmark/toggle` with `action:
    "progress"`.
- `src/components/NovelDetailView.tsx`
  - Add-to-bookshelf now calls `/api/bookmark/toggle` with `action: "follow"`.
- `src/components/CreatorStudioView.tsx`
  - Withdrawal request now calls `/api/withdraw/request` with a Firebase ID
    token.
  - The client no longer sets the user's coin balance to zero or creates
    `withdraw_requests` directly for this flow.

## Security Impact

- Forged `body.uid` can no longer target another user's check-in, mission,
  bookmark, or withdrawal records.
- Check-in coin rewards and mission claim rewards are server-side constants.
- Mission claim credits coins only from a small server-side mission catalog.
- Withdrawal reads the verified user's current coin balance server-side and
  creates a `PENDING` request only.
- No payout automation was added.
- No token values are logged.
- Public error responses avoid stack traces and token details.

## Compatibility Risks

- Existing callers that do not send a Firebase ID token will now receive 401.
- Any old caller that relied on `uid` in the body to act on another user will no
  longer work.
- Mission routes have no current client callers in this pass; internal/server
  systems must send a user Firebase ID token before using them.
- Firestore rules are still unchanged, so direct client money-write paths outside
  the P0.4 selected flows may remain until P0.6.
- PayOS, PayOS webhook, unlock-chapter, donate, admin, and TTS routes were not
  modified in this phase by design.

## Validation Results

- `npx.cmd eslint src/lib/apiAuth.ts src/app/api/checkin/claim/route.ts src/app/api/missions/progress/route.ts src/app/api/missions/claim/route.ts src/app/api/bookmark/toggle/route.ts src/app/api/withdraw/request/route.ts src/components/CheckInModal.tsx src/components/BookshelfView.tsx src/components/ReaderView.tsx src/components/NovelDetailView.tsx src/components/CreatorStudioView.tsx`:
  pass with 29 warnings in pre-existing component lint debt and 0 errors.
- `npm.cmd run lint`: fails with known project lint debt, now 81 errors / 87
  warnings. This is lower than the baseline 88 errors / 89 warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

## Next Recommended Task

P0.5 PayOS hardening: make PayOS order creation and webhook crediting
server-trusted, authenticated, amount-verified, and idempotent without trusting
client-provided `amount`, `coins`, `orderCode`, or payment status.
