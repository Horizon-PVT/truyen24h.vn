# Truyen24h P0.6 Unlock Chapter Money Hardening Report

Date: 2026-06-03

## Files Changed

- `src/app/api/unlock-chapter/route.ts`
- `src/components/ReaderView.tsx`

## Unlock Behavior Before

- The client directly deducted buyer coins, appended `unlockedChapters`, credited
  the author, and wrote a transaction record.
- `/api/unlock-chapter` used the client Firebase SDK in a server route.
- The route trusted body-provided `buyerId`, `authorId`, and `chapterPrice`.
- Unlock writes were not transaction-idempotent against repeated requests.
- Public errors could expose internal error details.

## Unlock Behavior After

- `/api/unlock-chapter` requires `Authorization: Bearer <Firebase ID token>`.
- The route derives buyer identity from `requireFirebaseUser(request)`.
- The client sends only `novelId` and `chapterId`.
- The server reads `novels/{novelId}` and
  `novels/{novelId}/chapters/{chapterId}` before charging.
- If the chapter subcollection document is absent, the route can fall back to
  the embedded `novel.chapters` entry for compatibility.
- The server determines paid/free status from server-side chapter data.
- The server determines price from server-side chapter data.
- The server determines author payout recipient from server-side chapter/novel
  data.
- Coin deduction, author credit, unlock write, and audit transaction write happen
  inside a Firebase Admin transaction.

## Body Fields Now Ignored

These client fields no longer control unlock behavior:

- `buyerId`
- `uid`
- `authorId`
- `chapterPrice`
- `coins`
- `amount`
- client-side paid/free status

Only `novelId` and `chapterId` are accepted as request identifiers.

## Buyer Identity

Buyer identity is the verified Firebase ID token `uid`. The request body cannot
select another buyer.

## Price Derivation

The route reads server-side chapter data and calculates:

- free chapter: price `0`;
- VIP chapter: `chapter.price` if valid, otherwise default `50`;
- negative server price: rejected with `400 Invalid chapter price`.

## Author Payout Recipient

The route uses `chapter.authorId` if present, otherwise `novel.authorId`. The
client cannot choose the payout recipient.

Current payout model preserved:

- author share: `floor(price * 0.6)`;
- platform fee: remaining amount;
- if buyer is the author, no author self-payout is credited.

## Idempotency

The transaction re-reads the buyer document and checks
`buyer.unlockedChapters`.

- Already unlocked: returns success with `deducted: 0`.
- Free chapter: no deduction.
- Active VIP user: no deduction; the chapter is added to `unlockedChapters`.
- Paid chapter: deducts buyer coins once, credits server-derived author once,
  appends the chapter using `FieldValue.arrayUnion`, and writes a deterministic
  transaction id.

Repeated unlock requests do not double-charge.

## Client Compatibility

- `src/components/ReaderView.tsx` now calls `/api/unlock-chapter` with a
  Firebase ID token.
- It sends only `novelId` and `chapterId`.
- It no longer directly mutates buyer coins, author coins, unlocked chapters, or
  transactions for this flow.
- Unauthenticated unlock requests now receive 401 from the server route.

## Security Impact

- Users cannot spoof `buyerId` or unlock for another account.
- Users cannot fake chapter price or author payout recipient.
- Client-side coin deduction and author credit for unlock were removed.
- Server transaction protects against double-charge on repeated unlocks.
- Public errors avoid stack traces and raw Admin SDK error details.

## Not Changed

- PayOS create/webhook routes
- Firestore rules
- admin routes
- TTS route
- `package.json`
- deployment config
- env files
- withdrawal payout behavior

No payout automation was added and no money was sent.

## Remaining Risk

- Firestore rules still need P0.7 lockdown so clients cannot directly write
  money fields outside this hardened route.
- Some other money-like flows, such as donate and admin test coin mutation, are
  outside this P0.6 scope and remain to be hardened separately.
- The route preserves the existing 60/40 author/platform split; future payout
  accounting may need a fuller revenue ledger.

## Validation Results

- `npx.cmd eslint src/lib/apiAuth.ts`: pass.
- `npx.cmd eslint src/app/api/unlock-chapter/route.ts`: pass.
- `npx.cmd eslint src/components/ReaderView.tsx`: pass with 12 pre-existing
  warnings and 0 errors.
- `npm.cmd run lint`: fails with known project lint debt, now 77 errors / 85
  warnings. This is lower than the current P0.5 baseline of 78 errors / 85
  warnings.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.

## Next Recommended Task

P0.7 Firestore money rules lockdown: make client writes fail closed for coins,
VIP status, unlocked paid chapters, transactions, orders, withdrawal request
approval fields, and other money/accounting fields.
