"use client";

import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  ShieldCheck, 
  QrCode, 
  ArrowRight, 
  Sparkles, 
  Loader2, 
  Zap, 
  ArrowLeft, 
  Crown, 
  Flame, 
  CheckCircle2, 
  BookOpen, 
  EyeOff, 
  Award, 
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { vipRemainingLabel, isVipActive } from '@/lib/vip';

export const PACKAGES = [
  { 
    id: 'monthly', 
    vnd: 99000, 
    coins: 1500, 
    bonus: 500, 
    totalCoins: 2000,
    monthly: true, 
    featured: true,
    tag: '👑 KHUYÊN DÙNG - TIẾT KIỆM 65%',
    desc: 'Tặng 30 ngày VIP đọc không giới hạn + Khung Avatar Hoàng Gia'
  },
  { 
    id: 'pack2', 
    vnd: 50000, 
    coins: 500, 
    bonus: 350, 
    totalCoins: 850,
    popular: true,
    tag: '🔥 BÁN CHẠY (+70%)',
    desc: 'Gói đọc truyện thịnh hành, mở khóa ~40 chương VIP'
  },
  { 
    id: 'pack1', 
    vnd: 20000, 
    coins: 200, 
    bonus: 100, 
    totalCoins: 300,
    starter: true,
    tag: '🎉 TÂN THỦ (+50%)',
    desc: 'Nhân đôi ưu đãi cho độc giả mới bắt đầu đọc'
  },
  { 
    id: 'pack4', 
    vnd: 200000, 
    coins: 2500, 
    bonus: 2000, 
    totalCoins: 4500,
    whale: true,
    tag: '💎 ĐẠI GIA (+80%)',
    desc: 'Được vinh danh vĩnh viễn trên BXH Đại Gia Phú Hộ'
  },
  { 
    id: 'pack3', 
    vnd: 100000, 
    coins: 1000, 
    bonus: 800, 
    totalCoins: 1800,
    tag: '⚡ TĂNG TỐC (+80%)',
    desc: 'Đọc trọn vẹn 1-2 bộ tiểu thuyết dài tập'
  },
  { 
    id: 'pack5', 
    vnd: 500000, 
    coins: 5000, 
    bonus: 7500, 
    totalCoins: 12500,
    supreme: true,
    tag: '👑 TÔNG CHỦ (x2.5 XU)',
    desc: 'Đặc quyền Tông Chủ, nhận trọn bộ vật phẩm VIP tối cao'
  },
  { 
    id: 'pack0', 
    vnd: 10000, 
    coins: 100, 
    bonus: 0, 
    totalCoins: 100,
    trial: true,
    tag: 'Trải Nghiệm',
    desc: 'Gói nhỏ đọc thử một vài chương ngắn'
  },
];

export default function VipClient() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [selectedPack, setSelectedPack] = useState(PACKAGES[0]); // Default to highest upsell: monthly
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setUserProfile(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [user]);

  const vipActive = isVipActive(userProfile);
  const vipRemain = vipRemainingLabel(userProfile);
  const userCoins = userProfile?.coins ?? 0;

  const handlePayOS = async () => {
    if (!user) {
      alert("Bạn cần đăng nhập tài khoản để nhận Xu ưu đãi!");
      return;
    }
    setIsCreatingOrder(true);
    try {
      const res = await fetch('/api/payos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          packId: selectedPack.id,
          returnUrl: `${window.location.origin}/vip?payment=success`,
          cancelUrl: `${window.location.origin}/vip?payment=cancelled`,
        })
      });

      const data = await res.json();

      if (data.checkoutUrl) {
         window.location.href = data.checkoutUrl;
      } else {
         alert("Lỗi tạo thanh toán: " + (data.error || 'Vui lòng thử lại'));
      }
    } catch (e: any) {
      alert("Lỗi kết nối cổng thanh toán PayOS: " + e.message);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080B] text-slate-100 pt-20 pb-28 md:pb-20 px-3 sm:px-6 selection:bg-amber-500/30">
      <div className="max-w-6xl mx-auto flex flex-col gap-8 md:gap-10">
        
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors group w-fit text-xs font-bold uppercase tracking-wider"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            <span>Quay lại trang chủ</span>
          </button>

          {/* User Live Coin & VIP Status Pill */}
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-2 w-fit">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <Coins className="size-4" />
              </div>
              <div className="text-xs">
                <span className="text-slate-400">Số dư hiện tại: </span>
                <span className="font-black text-amber-400">{userCoins.toLocaleString('vi-VN')} Xu</span>
              </div>
            </div>
            {vipActive && (
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-500 text-black shadow-sm">
                VIP
              </span>
            )}
          </div>
        </div>

        {/* Hero Banner Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-wider shadow-sm">
              <Zap className="size-3.5 fill-amber-400" />
              Nạp Tự Động 24/7 Qua VietQR • Hoàn Tiền 100% Nếu Lỗi
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">
              Gói Nạp Ưu Đãi <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500">Độc Quyền</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl font-medium">
              Mở khóa hàng chục ngàn chương truyện VIP, đọc trước không giới hạn, không quảng cáo và nhận khung Avatar Hoàng Gia.
            </p>
          </div>

          {vipActive && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border border-amber-500/40 flex items-center gap-3">
              <Crown className="size-6 text-amber-400 shrink-0" />
              <div>
                <div className="font-black text-amber-300 text-sm">Hội Viên VIP Đang Kích Hoạt</div>
                <div className="text-slate-400 text-xs mt-0.5">Thời hạn còn: <strong className="text-white">{vipRemain}</strong> (Nạp thêm để cộng dồn).</div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content: Left Packages Grid + Right Checkout Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
          {/* Left Column: Packages List */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Chọn Gói Nạp</span>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">Khuyến mãi x2</span>
              </h2>
              <span className="text-xs text-slate-400">1.000đ = 10-25 Xu</span>
            </div>

            <div className="flex flex-col gap-3.5">
              {PACKAGES.map((pack) => {
                const isSelected = selectedPack.id === pack.id;
                const isFeatured = pack.featured;

                return (
                  <div 
                    key={pack.id} 
                    onClick={() => setSelectedPack(pack)}
                    className={`relative p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isSelected 
                        ? 'border-amber-400 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent shadow-[0_0_30px_rgba(245,158,11,0.2)] scale-[1.01]' 
                        : isFeatured
                          ? 'border-amber-500/40 bg-white/[0.04] hover:border-amber-500/70 hover:bg-white/[0.06]'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Floating Badge */}
                    {pack.tag && (
                      <div className={`absolute -top-3 left-4 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md ${
                        isFeatured
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-amber-500/40'
                          : pack.popular
                            ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-red-500/30'
                            : pack.whale
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white'
                              : 'bg-white/15 text-slate-200 border border-white/10'
                      }`}>
                        {pack.tag}
                      </div>
                    )}

                    {/* Left: Pack Info */}
                    <div className="flex items-center gap-3.5 mt-1 sm:mt-0">
                      <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                        isSelected 
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-lg shadow-amber-500/30 scale-105' 
                          : 'bg-white/10 text-amber-400 group-hover:scale-105'
                      }`}>
                        {isFeatured ? (
                          <Crown className="size-6 stroke-[2.2]" />
                        ) : pack.whale ? (
                          <Sparkles className="size-6" />
                        ) : (
                          <Coins className="size-6" />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xl font-black text-white font-display tracking-tight">
                            Tổng {pack.totalCoins.toLocaleString('vi-VN')} Xu
                          </span>
                          {pack.bonus > 0 ? (
                            <span className="text-xs font-bold text-slate-300">
                              ({pack.coins.toLocaleString('vi-VN')} gốc + <span className="text-emerald-400 font-bold">+{pack.bonus.toLocaleString('vi-VN')} thưởng</span>)
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-400">
                              ({pack.coins.toLocaleString('vi-VN')} Xu gốc)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium line-clamp-1">{pack.desc}</p>
                      </div>
                    </div>

                    {/* Right: Price & Selector */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <div className="text-left sm:text-right">
                        <div className={`text-lg font-black tracking-tight ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                          {pack.vnd.toLocaleString('vi-VN')} đ
                        </div>
                        {pack.bonus > 0 && (
                          <div className="text-[10px] text-slate-400">
                            Giá gốc: <span className="line-through">{((pack.vnd * 1.5)).toLocaleString('vi-VN')}đ</span>
                          </div>
                        )}
                      </div>

                      <div className={`size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected 
                          ? 'border-amber-400 bg-amber-400 text-black' 
                          : 'border-white/20 group-hover:border-white/40'
                      }`}>
                        {isSelected && <CheckCircle2 className="size-4 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VIP Value Propositions Showcase */}
            <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] flex flex-col gap-4">
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                <Sparkles className="size-4" />
                4 Quyền Lợi Độc Quyền Khi Kích Hoạt VIP
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <BookOpen className="size-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-bold">Đọc Trước 10 Chương VIP</strong>
                    <span className="text-slate-400 text-[11px]">Cập nhật chương mới nhanh hơn độc giả thường 24 giờ.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <EyeOff className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-bold">100% Sạch Bóng Quảng Cáo</strong>
                    <span className="text-slate-400 text-[11px]">Không pop-up, không banner phiền toái, đọc mượt mà.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <Award className="size-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-bold">Khung Avatar Hoàng Gia</strong>
                    <span className="text-slate-400 text-[11px]">Hiển thị huy hiệu kim cương phát sáng trong phòng chat.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <TrendingUp className="size-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-bold">x2 EXP Cấp Độ Tu Tiên</strong>
                    <span className="text-slate-400 text-[11px]">Tăng tốc độ thăng hoa cảnh giới và đua top Bảng Xếp Hạng.</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Modern Checkout Summary */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <div className="w-full bg-[#0D0F17] border border-amber-500/20 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col gap-6">
              
              {/* Top Accent Line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500"></div>

              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                    <QrCode className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base uppercase tracking-tight">Chi Tiết Đơn Hàng</h3>
                    <p className="text-[11px] text-slate-400">Thanh toán tự động 24/7</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase">
                  An toàn 100%
                </span>
              </div>

              {/* Order breakdown */}
              <div className="flex flex-col gap-3 bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span className="text-slate-400">Gói chọn:</span>
                  <span className="font-bold text-white">{selectedPack.tag || 'Gói nạp Xu'}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span className="text-slate-400">Số Xu gốc:</span>
                  <span className="font-bold text-white">{selectedPack.coins.toLocaleString('vi-VN')} Xu</span>
                </div>
                {selectedPack.bonus > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-400 font-bold">
                    <span>Xu tặng thêm (+Bonus):</span>
                    <span>+{selectedPack.bonus.toLocaleString('vi-VN')} Xu</span>
                  </div>
                )}
                {selectedPack.monthly && (
                  <div className="flex justify-between items-center text-xs text-amber-400 font-bold">
                    <span>Thời hạn VIP:</span>
                    <span>+30 Ngày Hội Viên VIP</span>
                  </div>
                )}
                <div className="h-px bg-white/10 my-1"></div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-300">Tổng Xu Nhận:</span>
                  <span className="text-2xl font-black text-amber-400 font-display">
                    {selectedPack.totalCoins.toLocaleString('vi-VN')} Xu
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-300">Số tiền thanh toán:</span>
                  <span className="text-2xl font-black text-white font-display">
                    {selectedPack.vnd.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              {/* CTA Payment Button */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handlePayOS}
                  disabled={isCreatingOrder}
                  className="w-full h-14 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/25 active:scale-98 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingOrder ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      <span>Đang tạo mã QR VietQR...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-5 stroke-[2.5]" />
                      <span>Quét Mã QR Thanh Toán</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                  <span>Xác thực qua PayOS • Ngân hàng Nhà nước</span>
                </div>
              </div>

              {/* 3-Step Rapid Guide */}
              <div className="pt-2 border-t border-white/[0.08] flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  3 Bước Nạp Cực Nhanh:
                </span>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside font-medium">
                  <li>Bấm nút <strong className="text-white">Quét Mã QR</strong> ở trên.</li>
                  <li>Mở App Ngân hàng hoặc MoMo quét mã VietQR.</li>
                  <li>Xu được cộng tự động trong <strong className="text-emerald-400">3 giây</strong>.</li>
                </ol>
              </div>

            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
