/**
 * Visibility Guard Helper
 *
 * Checks if a novel, chapter, or blog post is safe to display on the public site.
 * Filters out items that are hidden, private, draft, unpublished, or rolled back.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPublicItem(data: any): boolean {
  if (!data) return false;

  // 1. Check explicit hidden flag
  if (data.hidden === true) return false;

  // 2. Check explicit private flag
  if (data.isPrivate === true) return false;

  // 3. Check published boolean flag
  if (data.published === false) return false;

  // 4. Check status string values case-insensitively
  const status = (data.status || '').toString().toLowerCase().trim();
  const hiddenStatuses = ['tạm ẩn', 'private', 'draft', 'hidden', 'unpublished'];
  if (hiddenStatuses.includes(status)) return false;

  return true;
}
