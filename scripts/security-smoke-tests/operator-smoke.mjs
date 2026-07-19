import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const files = {
  approveRoute: 'src/app/api/operator/approve/route.ts',
  publishRoute: 'src/app/api/operator/publish/route.ts',
  rollbackRoute: 'src/app/api/operator/rollback/route.ts',
  reportRoute: 'src/app/api/operator/report/route.ts',
  visibilityGuard: 'src/lib/visibilityGuard.ts',
  sitemap: 'src/app/sitemap.ts',
  discoverView: 'src/components/DiscoverView.tsx',
  novelPage: 'src/app/truyen/[slug]/page.tsx',
  novelView: 'src/components/NovelDetailView.tsx',
  chapterPage: 'src/app/doc/[slug]/[chapter_id]/page.tsx',
  blogPage: 'src/app/blog/page.tsx',
  blogSlugPage: 'src/app/blog/[slug]/page.tsx',
  filterView: 'src/components/FilterView.tsx',
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

function checkApproveRoute() {
  const content = read(files.approveRoute);
  const required = [
    'authorizeAdmin',
    'const auth = await authorizeAdmin(req)',
    "action === 'approve'",
    "action === 'reject'",
    "action === 'needs_fix'",
    "db.collection('operator_reviews')",
    'db.runTransaction',
    'status: newStatus',
  ];
  const forbidden = [/x-admin-email/i, /NEXT_PUBLIC_ADMIN_EMAILS/];

  return result(
    'approve API is secure and updates status with logging',
    includesAll(content, required) && excludesAll(content, forbidden),
    'Approve route must require authorizeAdmin, support needs_fix/reject notes, log to operator_reviews, and avoid spoofable x-admin-email'
  );
}

function checkPublishRoute() {
  const content = read(files.publishRoute);
  const required = [
    'authorizeAdmin',
    'const auth = await authorizeAdmin(req)',
    "status !== 'APPROVED'",
    "type === 'blog'",
    "type === 'story'",
    "type === 'chapter'",
    "db.collection('operator_publish_logs')",
    'db.runTransaction',
    'lastPublishLogId: publishLogRef.id',
  ];
  const forbidden = [/x-admin-email/i, /NEXT_PUBLIC_ADMIN_EMAILS/];

  return result(
    'publish API is secure and updates novels/chapters/blogs with logs',
    includesAll(content, required) && excludesAll(content, forbidden),
    'Publish route must require APPROVED drafts, write content using transaction, update novel chapter counts, and write to operator_publish_logs'
  );
}

function checkRollbackRoute() {
  const content = read(files.rollbackRoute);
  const required = [
    'authorizeAdmin',
    'const auth = await authorizeAdmin(req)',
    "db.collection('operator_publish_logs')",
    "db.collection('operator_rollback_logs')",
    "status: 'Tạm ẩn'",
    "hidden: true",
    "status: 'APPROVED'",
  ];
  const forbidden = [/x-admin-email/i, /NEXT_PUBLIC_ADMIN_EMAILS/];

  return result(
    'rollback API is secure and reverts content to hidden/approved states',
    includesAll(content, required) && excludesAll(content, forbidden),
    'Rollback route must query publish logs, soft rollback by hidden=true or status=Tạm ẩn, and restore draft status'
  );
}

function checkReportRoute() {
  const content = read(files.reportRoute);
  const required = [
    'authorizeAdmin',
    'const auth = await authorizeAdmin(req)',
    "collection('operator_drafts')",
    'byStatus',
    'byType',
    'averageQualityScore',
  ];
  const forbidden = [/x-admin-email/i];

  return result(
    'report API is secure and returns formatted operation metrics',
    includesAll(content, required) && excludesAll(content, forbidden),
    'Report route must require authorizeAdmin and compute quality score averages along with status tallies'
  );
}

function checkVisibilityGuard() {
  const content = read(files.visibilityGuard);
  const required = [
    'export function isPublicItem',
    'hidden === true',
    'isPrivate === true',
    'published === false',
    "['tạm ẩn', 'private', 'draft', 'hidden', 'unpublished']",
  ];
  return result(
    'visibility guard helper is correctly implemented',
    includesAll(content, required),
    'Visibility guard helper must filter hidden, private, published=false, and private statuses'
  );
}

function checkPublicVisibilityApplied() {
  const sitemap = read(files.sitemap);
  const discover = read(files.discoverView);
  const novelPage = read(files.novelPage);
  const novelView = read(files.novelView);
  const chapterPage = read(files.chapterPage);
  const blogPage = read(files.blogPage);
  const blogSlugPage = read(files.blogSlugPage);
  const filterView = read(files.filterView);

  const appliedSitemap = sitemap.includes('isPublicItem');
  const appliedDiscover = discover.includes('isPublicItem');
  const appliedNovelPage = novelPage.includes('isPublicItem');
  const appliedNovelView = novelView.includes('isPublicItem');
  const appliedChapterPage = chapterPage.includes('isPublicItem');
  const appliedBlogPage = blogPage.includes('isPublicItem');
  const appliedBlogSlugPage = blogSlugPage.includes('isPublicItem');
  const appliedFilterView = filterView.includes('isPublicItem');

  const passed = appliedSitemap && appliedDiscover && appliedNovelPage && appliedNovelView && appliedChapterPage && appliedBlogPage && appliedBlogSlugPage && appliedFilterView;

  return result(
    'public pages/routes filter out non-public content via visibility guard',
    passed,
    `Visibility guard must be imported/used in sitemap, homepage, novel SSR page, novel detail view, chapter page, blog index, blog slug, and search view.
     Sitemap: ${appliedSitemap}, Discover: ${appliedDiscover}, NovelPage: ${appliedNovelPage}, NovelView: ${appliedNovelView}, ChapterPage: ${appliedChapterPage}, BlogPage: ${appliedBlogPage}, BlogSlugPage: ${appliedBlogSlugPage}, FilterView: ${appliedFilterView}`
  );
}

function checkRollbackChapterGuard() {
  const rollbackContent = read(files.rollbackRoute);
  const required = [
    'needsChapterRecount: true',
    "db.collection('novels').doc(targetParentId)",
  ];
  return result(
    'rollback chapter API marks parent novel with needsChapterRecount',
    includesAll(rollbackContent, required),
    'Rollback route must set needsChapterRecount: true on the parent novel document during rollback transaction'
  );
}

function checkApproveTransitions() {
  const content = read(files.approveRoute);
  const required = [
    'transaction.get(draftRef)',
    "currentStatus === 'PUBLISHED'",
    'currentStatus === newStatus',
    'idempotent: true',
    'ALLOWED_TRANSITIONS',
    'NEEDS_REVIEW',
    'NEEDS_FIX',
    'INVALID_STATUS_TRANSITION',
    '409',
  ];

  const basicCheck = includesAll(content, required);

  const idxIdempotent = content.indexOf('currentStatus === newStatus');
  const idxPublished = content.indexOf("currentStatus === 'PUBLISHED'");
  const idxSetLog = content.indexOf('transaction.set(');

  const orderCorrect = idxIdempotent !== -1 && idxPublished !== -1 && idxSetLog !== -1 &&
                       idxIdempotent < idxSetLog && idxPublished < idxSetLog;

  const passed = basicCheck && orderCorrect;

  return result(
    'approve API transition rules are verified',
    passed,
    'Approve route must perform read inside transaction, block transition from PUBLISHED, support idempotent success when new status matches current status, and enforce ALLOWED_TRANSITIONS matrix returning 409 INVALID_STATUS_TRANSITION'
  );
}

function checkPublishIdempotentAndConflict() {
  const content = read(files.publishRoute);
  const required = [
    'transaction.get(draftRef)',
    'transaction.get(targetRef)',
    'publishedFromDraftId',
    'publishedFromDraftId === draftId',
    'idempotent: true',
    'publishedFromDraftId !== draftId',
    'Conflict',
    '409',
  ];
  return result(
    'publish API enforces idempotency and blocks target overwrites by other drafts',
    includesAll(content, required),
    'Publish route must check target document existence and publishedFromDraftId inside transaction, return 409 on draft mismatch, and return idempotent success if already published by same draft'
  );
}

function checkRollbackIdempotentAndConflict() {
  const content = read(files.rollbackRoute);
  const required = [
    'transaction.get(publishLogRef)',
    'transaction.get(targetRef)',
    "logData.status === 'ROLLED_BACK'",
    "logData.status !== 'ACTIVE'",
    'publishedFromDraftId !== draftId',
    '409',
    "status: 'ROLLED_BACK'",
  ];
  return result(
    'rollback API validates active status, owner draft ID, and updates log status',
    includesAll(content, required),
    'Rollback route must check publish log status ACTIVE/ROLLED_BACK, check publishedFromDraftId match inside transaction, update log status to ROLLED_BACK, and avoid rollback of hijacked documents'
  );
}

const results = [
  checkApproveRoute(),
  checkPublishRoute(),
  checkRollbackRoute(),
  checkReportRoute(),
  checkVisibilityGuard(),
  checkPublicVisibilityApplied(),
  checkRollbackChapterGuard(),
  checkApproveTransitions(),
  checkPublishIdempotentAndConflict(),
  checkRollbackIdempotentAndConflict(),
];

const failed = results.filter((item) => !item.passed);

console.log('=== OPERATOR PHASE 2.8D SMOKE TESTS ===');
for (const item of results) {
  const marker = item.passed ? 'PASS' : 'FAIL';
  console.log(`${marker} ${item.name}`);
  if (!item.passed) {
    console.log(`  ${item.detail}`);
  }
}

if (failed.length > 0) {
  console.error(`\nOperator smoke failed: ${failed.length}/${results.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nOperator smoke passed: ${results.length}/${results.length} checks passed.`);
}
