import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const files = {
  apiAuth: 'src/lib/apiAuth.ts',
  adminGenerateBlog: 'src/app/api/admin/generate-blog-post/route.ts',
  checkinClaim: 'src/app/api/checkin/claim/route.ts',
  missionsProgress: 'src/app/api/missions/progress/route.ts',
  missionsClaim: 'src/app/api/missions/claim/route.ts',
  bookmarkToggle: 'src/app/api/bookmark/toggle/route.ts',
  withdrawRequest: 'src/app/api/withdraw/request/route.ts',
  payosCreate: 'src/app/api/payos/create/route.ts',
  payosWebhook: 'src/app/api/webhooks/payos/route.ts',
  unlockChapter: 'src/app/api/unlock-chapter/route.ts',
  donateRoute: 'src/app/api/donate/route.ts',
  novelDetailView: 'src/components/NovelDetailView.tsx',
  profileEditModal: 'src/components/ProfileEditModal.tsx',
  creatorStudioView: 'src/components/CreatorStudioView.tsx',
  adminDashboard: 'src/components/AdminDashboard.tsx',
  adminWithdrawReview: 'src/app/api/admin/withdraw/review/route.ts',
  firestoreRules: 'firestore.rules',
};

function read(relativePath) {
  return readFileSync(resolve(rootDir, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function includesAll(content, snippets) {
  return snippets.every((snippet) => content.includes(snippet));
}

function excludesAll(content, patterns) {
  return patterns.every((pattern) => !pattern.test(content));
}

function result(name, passed, detail) {
  return { name, passed, detail };
}

function checkAdminAuth() {
  const apiAuth = read(files.apiAuth);
  const adminRoute = read(files.adminGenerateBlog);
  const required = [
    'export async function authorizeAdmin',
    'await requireFirebaseUser',
    'getServerAdminEmails',
    'ADMIN_API_TOKEN',
    'x-admin-token',
  ];
  const forbidden = [/x-admin-email/i, /NEXT_PUBLIC_ADMIN_EMAILS/];

  return result(
    'admin auth rejects spoofable email-only access',
    includesAll(apiAuth, required)
      && excludesAll(apiAuth, forbidden)
      && adminRoute.includes('await authorizeAdmin(req)')
      && adminRoute.includes('if (!auth.ok)'),
    'authorizeAdmin must use Firebase ID token or machine token, never x-admin-email'
  );
}

function checkUserRoute(name, relativePath, expectedPathSnippet) {
  const content = read(relativePath);
  const required = [
    'requireFirebaseUser',
    'const auth = await requireFirebaseUser(request)',
    'if (!auth.ok) return auth.response',
    'const uid = auth.user.uid',
    expectedPathSnippet,
  ];
  const forbidden = [/body\.uid\b/, /body\.email\b/];

  return result(
    `${name} requires verified Firebase uid`,
    includesAll(content, required) && excludesAll(content, forbidden),
    `${relativePath} must derive uid from auth.user.uid and ignore body.uid/email`
  );
}

function checkUserSensitiveRoutes() {
  return [
    checkUserRoute('checkin claim', files.checkinClaim, 'users/${uid}/checkins'),
    checkUserRoute('missions progress', files.missionsProgress, 'users/${uid}/missions'),
    checkUserRoute('missions claim', files.missionsClaim, 'users/${uid}/missions'),
    checkUserRoute('bookmark toggle', files.bookmarkToggle, 'users/${uid}/bookshelf'),
    checkUserRoute('withdraw request', files.withdrawRequest, "collection('withdraw_requests').doc()"),
  ];
}

function checkPayosCreate() {
  const content = read(files.payosCreate);
  const required = [
    'requireFirebaseUser',
    'const auth = await requireFirebaseUser(request)',
    'type CreatePayOSBody = {\n  packId?: unknown;\n};',
    'const pack = PAYMENT_PACKS[packId]',
    'uid: auth.user.uid',
    'const orderCode = createOrderCode()',
    'const siteUrl = getSiteUrl()',
    'returnUrl = `${siteUrl}/vip?payment=success',
    'cancelUrl = `${siteUrl}/vip?payment=cancelled',
  ];
  const forbidden = [
    /body\.uid\b/,
    /body\.amount\b/,
    /body\.coins\b/,
    /body\.orderCode\b/,
    /body\.isMonthly\b/,
    /body\.returnUrl\b/,
    /body\.cancelUrl\b/,
  ];

  return result(
    'PayOS create is authenticated and server-derived',
    includesAll(content, required) && excludesAll(content, forbidden),
    'PayOS create must accept only packId and derive uid, amount, coins, orderCode, monthly status, and URLs server-side'
  );
}

function checkPayosWebhook() {
  const content = read(files.payosWebhook);
  const required = [
    'payos.webhooks.verify',
    "return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })",
    'const expectedAmount = asPositiveNumber(order.amount)',
    'if (paidAmount !== expectedAmount)',
    "status: 'PAYMENT_MISMATCH'",
    "if (order.status === 'PAID')",
    'db.runTransaction',
    'FieldValue.increment(coins)',
    'transactions/payos_${orderCode}',
  ];

  return result(
    'PayOS webhook verifies signature, amount, and idempotency',
    includesAll(content, required),
    'Webhook must reject invalid signatures, block amount mismatch, and avoid duplicate credit'
  );
}

function checkUnlockChapter() {
  const content = read(files.unlockChapter);
  const required = [
    'requireFirebaseUser',
    'const auth = await requireFirebaseUser(request)',
    'const buyerId = auth.user.uid',
    'const novelRef = db.doc(`novels/${novelId}`)',
    'const chapterRef = db.doc(`novels/${novelId}/chapters/${chapterId}`)',
    'const serverPrice = isVipChapter ? toMoneyNumber(chapter.price) || DEFAULT_VIP_PRICE : 0',
    'const alreadyUnlocked = unlockedChapters.includes(chapterId)',
    'const activeVip = isActiveVip(buyer.vipUntil)',
    'db.runTransaction',
    'safeTransactionId(buyerId, novelId, chapterId)',
  ];
  const forbidden = [
    /body\.buyerId\b/,
    /body\.uid\b/,
    /body\.authorId\b/,
    /body\.chapterPrice\b/,
    /body\.coins\b/,
    /body\.amount\b/,
  ];

  return result(
    'unlock chapter is buyer-authenticated and server-priced',
    includesAll(content, required) && excludesAll(content, forbidden),
    'Unlock must derive buyer, price, author payout, VIP/free handling, and idempotency server-side'
  );
}

function checkFirestoreRules() {
  const rules = read(files.firestoreRules);
  const required = [
    'function safeUserCreateFields()',
    'function safeUserUpdateFields()',
    'request.resource.data.diff(resource.data).affectedKeys().hasOnly(safeUserUpdateFields())',
    'match /orders/{orderId}',
    'allow write: if false',
    'match /transactions/{txId}',
    'match /withdraw_requests/{requestId}',
    'match /novels/{novelId}',
    'allow read: if true',
    'match /blog_posts/{postId}',
    'match /{document=**}',
  ];
  const safeUserAllowlists = [
    ...rules.match(/function safeUser(?:Create|Update)Fields\(\) \{[\s\S]*?\n    \}/g),
  ].join('\n');
  const forbiddenSensitiveFields = [
    'coins',
    'vipUntil',
    'vipPlan',
    'unlockedChapters',
    'paidChapters',
    'transactions',
    'revenue',
    'totalSpent',
    'totalEarned',
    'withdrawableBalance',
    'pendingWithdraw',
    'role',
    'isAdmin',
    'admin',
    'badges',
    'contributionScore',
  ];
  const allowlistsExcludeSensitive = forbiddenSensitiveFields.every(
    (fieldName) => !safeUserAllowlists.includes(`'${fieldName}'`)
  );
  const serverOnlyPatterns = [
    /match \/orders\/\{orderId\}[\s\S]*?allow write: if false;/,
    /match \/transactions\/\{txId\}[\s\S]*?allow write: if false;/,
    /match \/withdraw_requests\/\{requestId\}[\s\S]*?allow write: if false;/,
    /match \/payment_logs\/\{logId\}[\s\S]*?allow read, write: if false;/,
    /match \/platform_revenue\/\{docId\}[\s\S]*?allow read, write: if false;/,
  ];

  return result(
    'Firestore rules block client money writes and preserve public reads',
    includesAll(rules, required)
      && allowlistsExcludeSensitive
      && serverOnlyPatterns.every((pattern) => pattern.test(rules)),
    'Rules must deny money/order/transaction/withdrawal writes while preserving public novel/chapter/blog reads'
  );
}

function checkDonateHardening() {
  const route = read(files.donateRoute);
  const caller = read(files.novelDetailView);
  const requiredRoute = [
    'requireFirebaseUser',
    'const auth = await requireFirebaseUser(request)',
    'const donorId = auth.user.uid',
    'adminDb()',
    'db.runTransaction',
    'FieldValue.increment(-donateAmount)',
    'FieldValue.increment(donateAmount)',
    "type: 'DONATE'",
  ];
  const forbiddenRoute = [
    /firebase\/app/,
    /firebase\/firestore/,
    /body\.donorId\b/,
    /details: error/,
  ];
  const requiredCaller = [
    "fetch('/api/donate'",
    'Authorization: `Bearer ${idToken}`',
    'authorId: novel.authorId',
    'amount',
  ];
  const forbiddenCaller = [
    /updateDoc\(doc\(db,\s*'users'/,
    /coins:\s*increment/,
  ];

  return result(
    'direct donate uses verified donor and server transaction',
    includesAll(route, requiredRoute)
      && excludesAll(route, forbiddenRoute)
      && includesAll(caller, requiredCaller)
      && excludesAll(caller, forbiddenCaller),
    'Donation must require Firebase auth, use auth.user.uid as donor, mutate coins with Admin SDK transaction, and avoid client direct coin writes'
  );
}

function checkDemoRechargeVipDisabled() {
  const content = read(files.profileEditModal);
  const forbidden = [
    /handleRecharge/,
    /handleUpgradeVIP/,
    /updateDoc/,
    /increment/,
    /coins:\s*increment/,
    /isVip:\s*true/,
    /badges:\s*\[/,
  ];

  return result(
    'demo recharge and VIP mutation are removed from profile modal',
    excludesAll(content, forbidden) && content.includes("window.location.href = '/vip'"),
    'Profile modal must not directly mutate coins, VIP, or badges; top-up/VIP actions should route to the real payment flow'
  );
}

function checkAdminTestCoinDisabled() {
  const content = read(files.creatorStudioView);
  const forbidden = [
    /coins:\s*increment\(500\)/,
    /Bơm 500 Xu/,
    /Test Admin/,
    /\bincrement\b/,
  ];

  return result(
    'admin test coin mutation is removed from Creator Studio',
    excludesAll(content, forbidden),
    'Creator Studio must not expose a direct client-side admin test coin mutation'
  );
}

function checkAdminWithdrawReviewHardened() {
  const route = read(files.adminWithdrawReview);
  const dashboard = read(files.adminDashboard);
  const requiredRoute = [
    'authorizeAdmin',
    'const auth = await authorizeAdmin(request)',
    'adminDb()',
    'db.runTransaction',
    "withdraw_requests/${requestId}",
    'reviewedBy',
    'reviewedAt',
    'FieldValue.serverTimestamp()',
  ];
  const forbiddenRoute = [
    /sendMoney/i,
    /payout/i,
    /x-admin-email/i,
  ];
  const requiredDashboard = [
    "fetch('/api/admin/withdraw/review'",
    'Authorization: `Bearer ${idToken}`',
    "status: 'COMPLETED'",
  ];
  const forbiddenDashboard = [
    /updateDoc\(doc\(db,\s*'withdraw_requests'/,
  ];

  return result(
    'admin withdrawal review uses secure admin API',
    includesAll(route, requiredRoute)
      && excludesAll(route, forbiddenRoute)
      && includesAll(dashboard, requiredDashboard)
      && excludesAll(dashboard, forbiddenDashboard),
    'Withdrawal status changes must require secure authorizeAdmin and avoid client direct Firestore status writes'
  );
}

const results = [
  checkAdminAuth(),
  ...checkUserSensitiveRoutes(),
  checkPayosCreate(),
  checkPayosWebhook(),
  checkUnlockChapter(),
  checkDonateHardening(),
  checkDemoRechargeVipDisabled(),
  checkAdminTestCoinDisabled(),
  checkAdminWithdrawReviewHardened(),
  checkFirestoreRules(),
];

const failed = results.filter((item) => !item.passed);

for (const item of results) {
  const marker = item.passed ? 'PASS' : 'FAIL';
  console.log(`${marker} ${item.name}`);
  if (!item.passed) {
    console.log(`  ${item.detail}`);
  }
}

if (failed.length > 0) {
  console.error(`Security smoke failed: ${failed.length}/${results.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`Security smoke passed: ${results.length}/${results.length} checks passed.`);
}
