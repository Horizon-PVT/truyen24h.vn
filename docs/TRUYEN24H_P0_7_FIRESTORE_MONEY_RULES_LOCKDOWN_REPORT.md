# Truyen24h P0.7 Firestore Money Rules Lockdown Report

Date: 2026-06-04 17:10:54 +07:00

## Files Changed

- `firestore.rules`
- `docs/TRUYEN24H_P0_7_FIRESTORE_MONEY_RULES_LOCKDOWN_REPORT.md`

No runtime code was changed.

## Sensitive Fields Blocked From Client Writes

Client SDK writes to `users/{uid}` are now limited to safe profile/display
fields only. Money, VIP, paid unlock, admin, reward, and accounting fields are
not included in the client-writable allowlist.

Blocked sensitive user fields include:

- `coins`
- `vipUntil`
- `vipPlan`
- `unlockedChapters`
- `paidChapters`
- `transactions`
- `revenue`
- `totalSpent`
- `totalEarned`
- `withdrawableBalance`
- `pendingWithdraw`
- `role`
- `isAdmin`
- `admin`
- `badges`
- `contributionScore`
- author payout/accounting fields

The old rule that allowed users to decrease their own `coins` and change
`unlockedChapters` was removed. The old rule that allowed another user to
increase an author's `coins` was also removed.

## Server-Only Collections And Paths

These paths are now client read/write denied or client write denied:

- `orders/{orderId}`: own-user read only, no client writes.
- `transactions/{txId}`: involved-user read only, no client writes.
- `payments/{paymentId}`: own-user read only, no client writes.
- `payos_orders/{orderId}`: own-user read only, no client writes.
- `payment_logs/{logId}`: no client reads or writes.
- `revenue_events/{eventId}`: no client reads or writes.
- `platform_revenue/{docId}`: no client reads or writes.
- `withdraw_requests/{requestId}`: own-user read only, no client writes.
- `users/{uid}/checkins/{checkinId}`: owner read only, no client writes.
- `users/{uid}/missions/{missionId}`: owner read only, no client writes.
- `users/{uid}/profile/{profileDocId}`: owner read only, no client writes.
- `admin/{document=**}`: no client reads or writes.
- `config/{document=**}`: no client reads or writes.
- `ops_daily_runs/{runId}`: no client reads or writes.
- Unknown collections: fail closed through the final catch-all rule.

Firebase Admin SDK routes can still write these paths because Admin SDK bypasses
Firestore security rules.

## Client Reads Preserved

- `users/{uid}` public reads remain preserved for the current leaderboard/profile
  behavior.
- `novels/{novelId}` public reads remain preserved.
- `novels/{novelId}/chapters/{chapterId}` public reads remain preserved.
- `novels/{novelId}/chapters/{chapterId}/inline_comments/{commentId}` public
  reads remain preserved.
- `blog_posts/{postId}` public reads remain preserved.
- Users can read their own `orders`, `transactions`, `payments`,
  `payos_orders`, `withdraw_requests`, `bookshelf`, `checkins`, `missions`, and
  `profile` subdocs where owner fields allow it.
- `channels/{channelId}/messages/{messageId}` public reads remain preserved.

## Client Writes Preserved

The following non-money client writes remain allowed:

- Own user profile create/update for safe fields only:
  - `uid`
  - `displayName`
  - `email`
  - `photoURL`
  - `bio`
  - `preferences`
  - `readingSettings`
  - `theme`
  - `createdAt`
  - `updatedAt`
  - `lastActiveAt` on update
- Own `users/{uid}/bookshelf/{novelId}` create/update/delete for safe reading
  progress fields only.
- Authenticated authors can still create their own novels, update/delete their
  own novels, and create/update/delete chapters under their own novels.
- Authenticated users can create their own inline comments and edit/delete only
  their own inline comments.
- Authenticated users can create/edit/delete only their own community channel
  messages.

## Compatibility Risks

- Any old client path that still directly writes `coins`, `badges`,
  `contributionScore`, `vipUntil`, `vipPlan`, or `unlockedChapters` will now be
  denied after rules deployment.
- `ProfileEditModal` demo recharge/VIP buttons and `CreatorStudioView` admin
  test coin mutation are expected to be denied by these rules if deployed.
- The direct donate flow in `NovelDetailView` still attempts client-side coin
  transfer and will be denied until a future server-trusted donation hardening
  phase.
- Admin dashboard client-side withdrawal status updates will be denied. Owner or
  admin approval must move through a hardened server route before production
  rule deployment.
- If registration/login creates additional user fields beyond the safe allowlist,
  those fields will be denied until either moved server-side or explicitly
  classified as safe.
- Deploying these rules before smoke testing may expose remaining client SDK
  money-write dependencies. Firestore rules deployment remains owner-controlled.

## Required Follow-Up Smoke Tests

- Client attempt to increment or decrement `users/{uid}.coins` is denied.
- Client attempt to set `users/{uid}.vipUntil` or `vipPlan` is denied.
- Client attempt to append `users/{uid}.unlockedChapters` is denied.
- Client attempt to create `transactions/{txId}` is denied.
- Client attempt to create or update `orders/{orderId}` is denied.
- Client attempt to create or update `withdraw_requests/{requestId}` is denied.
- Own `users/{uid}/bookshelf/{novelId}` progress write still succeeds.
- Public reads for published novels, chapters, inline comments, and blog posts
  still succeed.
- Server API flows using Firebase Admin SDK for PayOS, unlock, check-in,
  missions, bookmark, and withdrawal request still succeed.

## Not Changed

- No `src/**` runtime code was changed.
- No PayOS route was changed.
- No unlock-chapter route was changed.
- No admin route was changed.
- No TTS route was changed.
- No `package.json`, deployment config, env file, client UI, or automation
  workflow was changed.
- No payout automation was added.
- Firestore rules were not deployed.

## Validation Results

Validation was run after the rules/report change:

- `npm.cmd run lint`: fails with known project lint debt, 77 errors / 85
  warnings. This did not increase from the current P0.6 baseline.
- `npx.cmd tsc --noEmit --pretty false`: pass.
- `npm.cmd run build`: pass.
- Firestore rules validation command: no repo script found in `package.json`,
  no `firebase.json` or `.firebaserc` exists, and Firebase CLI is not available
  in this environment. Rules were not deployed.

## Next Recommended Task

P0.8 Security smoke tests: add repeatable smoke checks for forged identity,
client money-write denial, PayOS mismatch/idempotency, unlock double-charge
prevention, and admin spoof rejection without making real payments or deploying
rules.
