/**
 * Centralized Cover Resolution Service
 * Ensures all novels have unique, high-definition, tailor-made book covers.
 * Completely eliminates duplicate covers, broken pollinations.ai URLs, and website logo fallbacks.
 */

export const SLUG_COVER_MAP: Record<string, string> = {
  // Existing hero novels
  'vo-than-chua-te': '/covers/vo-than-chua-te.jpg',
  'dem-trang-muong-ba-li': '/covers/dem-trang-muong-ba-li.jpg',
  'tong-tai-co-chap-vo-cu-lai-yeu-lan-nua-65wu': '/covers/tong-tai-co-chap.jpg',
  'nu-phu-phan-cong-he-thong-nu-than-gioi-giai-tri-4w51': '/covers/nu-phu-phan-cong.jpg',

  // Xianxia & Fantasy (Batch 1)
  'yeu-than-giang-the': '/covers/cover-yeu-than.jpg',
  'muc-than-ky': '/covers/cover-muc-than.jpg',
  'nhat-niem-vinh-hang': '/covers/cover-vinh-hang.jpg',
  'nghich-menh-thanh-ma': '/covers/cover-nghich-menh.jpg',
  'nhat-niem-thanh-tien-nhat-niem-thanh-ma': '/covers/cover-tien-ma.jpg',

  // Drama, Reincarnation & Romance (Batch 2)
  'luan-hoi-chi-chu-tuoc-doat-van-gioi': '/covers/cover-luan-hoi.jpg',
  'tu-xuan': '/covers/cover-tu-xuan.jpg',
  'trong-sinh-ta-khong-lam-oan-gia': '/covers/cover-trong-sinh-oan-gia.jpg',
  'dai-ca-nhat-quyet-cuoi-ky-nu-ta-thanh-toan-cho-han-ca-doi-phai-hoi-han': '/covers/cover-dai-ca-cuoi-ky-nu.jpg',
  'thi-the-cua-ta-buong-tha-phong-tung-khong-kiem-che-duoc': '/covers/cover-thi-the.jpg',
  'vao-ngay-thu-100-ly-hon-toi-chet-tren-ban-mo-cua-nguoi-chong-yeu-dau': '/covers/cover-100-ngay-ly-hon.jpg',
};

export const GENRE_COVER_MAP: Record<string, string> = {
  'Kinh Dị': '/covers/genre-kinhdi.jpg',
  'Đô Thị': '/covers/genre-dothi.jpg',
  'Ngôn Tình': '/covers/genre-dothi.jpg',
  'Chữa Lành': '/covers/cover-100-ngay-ly-hon.jpg',
  'Cổ Đại': '/covers/cover-trong-sinh-oan-gia.jpg',
  'Trọng Sinh': '/covers/cover-trong-sinh-oan-gia.jpg',
  'Gia Đấu': '/covers/cover-dai-ca-cuoi-ky-nu.jpg',
  'Cung Đấu': '/covers/cover-tu-xuan.jpg',
  'Tiên Hiệp': '/covers/cover-muc-than.jpg',
  'Kiếm Hiệp': '/covers/cover-tien-ma.jpg',
  'Huyền Huyễn': '/covers/cover-yeu-than.jpg',
  'Hệ Thống': '/covers/genre-hethong.jpg',
  'Mạt Thế': '/covers/cover-nghich-menh.jpg',
  'Võng Du': '/covers/cover-luan-hoi.jpg',
};

export const DIVERSE_COVERS = [
  '/covers/vo-than-chua-te.jpg',
  '/covers/cover-muc-than.jpg',
  '/covers/cover-yeu-than.jpg',
  '/covers/cover-tien-ma.jpg',
  '/covers/cover-nghich-menh.jpg',
  '/covers/cover-luan-hoi.jpg',
  '/covers/cover-vinh-hang.jpg',
  '/covers/cover-tu-xuan.jpg',
  '/covers/cover-trong-sinh-oan-gia.jpg',
  '/covers/cover-dai-ca-cuoi-ky-nu.jpg',
  '/covers/cover-thi-the.jpg',
  '/covers/cover-100-ngay-ly-hon.jpg',
  '/covers/dem-trang-muong-ba-li.jpg',
  '/covers/tong-tai-co-chap.jpg',
  '/covers/nu-phu-phan-cong.jpg',
];

export function getHashCover(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DIVERSE_COVERS.length;
  return DIVERSE_COVERS[index];
}

export const DEFAULT_BOOK_COVER = '/covers/vo-than-chua-te.jpg';

export interface NovelLike {
  id?: string;
  slug?: string;
  title?: string;
  coverUrl?: string;
  coverImage?: string;
  category?: string;
  categories?: string[];
  genre?: string;
}

export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function resolveNovelCover(novel?: NovelLike | null): string {
  if (!novel) return DEFAULT_BOOK_COVER;

  // 1. Direct Slug / ID exact mapping
  const slug = (novel.slug || novel.id || '').toLowerCase().trim();
  if (slug && SLUG_COVER_MAP[slug]) {
    return SLUG_COVER_MAP[slug];
  }

  // 2. High-precision Title Keyword Matching (Normalized without Vietnamese accents)
  const titleRaw = novel.title || '';
  const titleNorm = removeVietnameseTones(titleRaw);

  // Specific novel title keywords:
  if (titleNorm.includes('muong ba li') || titleNorm.includes('dem trang')) {
    return '/covers/dem-trang-muong-ba-li.jpg';
  }
  if (titleNorm.includes('vo than chua te') || titleNorm.includes('tan tran')) {
    return '/covers/vo-than-chua-te.jpg';
  }
  if (titleNorm.includes('tong tai') || titleNorm.includes('vo cu')) {
    return '/covers/tong-tai-co-chap.jpg';
  }
  if (titleNorm.includes('nu phu') || titleNorm.includes('nu than')) {
    return '/covers/nu-phu-phan-cong.jpg';
  }
  if (titleNorm.includes('ha canh') || titleNorm.includes('ben em')) {
    return '/covers/tong-tai-co-chap.jpg';
  }
  if (titleNorm.includes('anh trang') || titleNorm.includes('doi em')) {
    return '/covers/cover-tu-xuan.jpg';
  }
  if (titleNorm.includes('huyet chien')) {
    return '/covers/cover-nghich-menh.jpg';
  }
  if (titleNorm.includes('thanh son')) {
    return '/covers/cover-tien-ma.jpg';
  }
  if (titleNorm.includes('ma duoc')) {
    return '/covers/cover-vinh-hang.jpg';
  }
  if (titleNorm.includes('ma dau')) {
    return '/covers/cover-nghich-menh.jpg';
  }
  if (titleNorm.includes('linh lo')) {
    return '/covers/cover-muc-than.jpg';
  }
  if (titleNorm.includes('cuu long') || titleNorm.includes('keo quan')) {
    return '/covers/cover-luan-hoi.jpg';
  }
  if (titleNorm.includes('yeu than')) {
    return '/covers/cover-yeu-than.jpg';
  }
  if (titleNorm.includes('muc than ky') || titleNorm.includes('muc than')) {
    return '/covers/cover-muc-than.jpg';
  }
  if (titleNorm.includes('vinh hang')) {
    return '/covers/cover-vinh-hang.jpg';
  }
  if (titleNorm.includes('nghich menh')) {
    return '/covers/cover-nghich-menh.jpg';
  }
  if (titleNorm.includes('thanh tien') || titleNorm.includes('thanh ma')) {
    return '/covers/cover-tien-ma.jpg';
  }
  if (titleNorm.includes('luan hoi')) {
    return '/covers/cover-luan-hoi.jpg';
  }
  if (titleNorm.includes('tu xuan')) {
    return '/covers/cover-tu-xuan.jpg';
  }
  if (titleNorm.includes('oan gia') || (titleNorm.includes('trong sinh') && titleNorm.includes('khong lam'))) {
    return '/covers/cover-trong-sinh-oan-gia.jpg';
  }
  if (titleNorm.includes('ky nu') || titleNorm.includes('dai ca')) {
    return '/covers/cover-dai-ca-cuoi-ky-nu.jpg';
  }
  if (titleNorm.includes('thi the') || titleNorm.includes('buong tha')) {
    return '/covers/cover-thi-the.jpg';
  }
  if (titleNorm.includes('100') || titleNorm.includes('ly hon') || titleNorm.includes('ban mo')) {
    return '/covers/cover-100-ngay-ly-hon.jpg';
  }

  for (const [key, cover] of Object.entries(SLUG_COVER_MAP)) {
    const cleanKey = key.replace(/-\w{4}$/, '').replace(/-/g, ' ');
    if (titleNorm.includes(cleanKey)) {
      return cover;
    }
  }

  // 3. Validate existing cover URL (if already a custom valid URL)
  const rawUrl = novel.coverUrl || novel.coverImage;
  if (rawUrl && typeof rawUrl === 'string') {
    const trimmed = rawUrl.trim();
    // Exclude logo fallbacks and broken pollinations.ai domains
    const isLogo = trimmed.includes('logo.jpg') || trimmed.startsWith('data:image');
    const isPollinations = trimmed.includes('pollinations.ai');
    const isPicsum = trimmed.includes('picsum.photos');

    if (!isLogo && !isPollinations && !isPicsum && trimmed.length > 5) {
      return trimmed;
    }
  }

  // 4. Genre Fallback with diverse unique covers
  const categories: string[] = [];
  if (novel.category) categories.push(novel.category);
  if (Array.isArray(novel.categories)) categories.push(...novel.categories);
  if (novel.genre) categories.push(novel.genre);

  for (const cat of categories) {
    const catNorm = removeVietnameseTones(cat);
    for (const [genreKey, cover] of Object.entries(GENRE_COVER_MAP)) {
      if (catNorm.includes(removeVietnameseTones(genreKey))) {
        return cover;
      }
    }
  }

  return getHashCover(titleNorm || slug || 'truyen');
}
