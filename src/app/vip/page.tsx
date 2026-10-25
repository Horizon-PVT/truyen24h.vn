import VipClient from './VipClient';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

export const metadata = {
  title: 'Nạp Xu & Gói Hội Viên VIP Độc Quyền - Truyen24h.vn',
  description: 'Nạp xu tự động 24/7 qua VietQR, PayOS. Mở khóa hàng chục ngàn chương truyện VIP, đọc trước không giới hạn, chiết khấu lên đến 70% cùng khung avatar Hoàng Gia độc quyền.',
  alternates: { canonical: absoluteUrl('/vip') },
  openGraph: {
    title: `Nạp Xu & Gói VIP Độc Quyền - ${SITE_NAME}`,
    description: 'Nạp xu tự động 24/7 qua VietQR. Mở khóa toàn bộ chương VIP trên Truyen24h.vn.',
    url: absoluteUrl('/vip'),
    siteName: SITE_NAME,
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function VIPPage() {
  return <VipClient />;
}
