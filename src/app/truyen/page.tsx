import TruyenClient from './TruyenClient';
import { getSiteUrl, SITE_NAME } from '@/lib/site';

export const metadata = {
  title: 'Danh Sách Truyện & Bộ Lọc Truyện | ' + SITE_NAME,
  description: 'Khám phá danh sách truyện chữ, tiểu thuyết phong phú tại Truyen24h.vn. Bộ lọc truyện thông minh theo thể loại, số chương, trạng thái.',
  alternates: {
    canonical: getSiteUrl() + '/truyen',
  },
};

export default function TruyenPage() {
  return <TruyenClient />;
}
