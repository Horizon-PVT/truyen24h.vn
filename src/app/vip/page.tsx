"use client";

import React, { useState, useEffect } from 'react';
import { Coins, ShieldCheck, QrCode, ArrowRight, Sparkles, Loader2, Zap, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { vipRemainingLabel, isVipActive } from '@/lib/vip';

/**
 * Xu top-up packages.
 *
 * Why we use a high-bonus xu pack instead of a true subscription flag:
 * the existing PayOS webhook only knows how to credit `coins` to a user.
 * Modelling "VIP tháng" as a fat xu bundle keeps the payment flow
 * unchanged while still giving readers ~30 chapters of headroom.
 *
 * If/when we wire a `vipUntil` timestamp end-to-end, we'll switch this
 * pack's id to "monthly" and update the webhook to set that field.
 */
const PACKAGES = [
  { id: 'pack0', vnd: 5000, coins: 60, bonus: 10, starter: true },
  { id: 'pack1', vnd: 10000, coins: 100, bonus: 0 },
  { id: 'pack2', vnd: 20000, coins: 200, bonus: 20, popular: true },
  { id: 'pack3', vnd: 50000, coins: 500, bonus: 100 },
  { id: 'monthly', vnd: 99000, coins: 1500, bonus: 300, monthly: true },
  { id: 'pack4', vnd: 100000, coins: 1000, bonus: 300 },
  { id: 'pack5', vnd: 200000, coins: 2000, bonus: 800, vip: true }
];

export default function VIPTopUpPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [selectedPack, setSelectedPack] = useState(PACKAGES[1]);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  // Live listen to the user's profile so the VIP status banner updates
  // immediately after the webhook flips vipUntil. No polling needed.
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

  const handlePayOS = async () => {
    if (!user) {
      alert("Bạn cần đăng nhập để nạp ưu đãi!");
      return;
    }
    setIsCreatingOrder(true);
    try {
      // Server-side order creation. We send only the trusted packId
      // (string) — the server uses an internal catalog to compute
      // {vnd, coins, isMonthly}. This prevents client-side tampering
      // with coin amounts before redirect to PayOS.
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
         alert("Lỗi tạo thanh toán: " + (data.error || 'Unknown'));
      }
    } catch (e: any) {
      alert("Lỗi kết nối PayOS: " + e.message);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-12 px-4 selection:bg-primary/30">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group w-fit"
        >
          <ArrowLeft className="size-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold uppercase tracking-widest text-sm">Quay Lại Sảnh</span>
        </button>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
            
          {/* Left Side: Packages */}
          <div className="w-full lg:w-3/5">
            {vipActive && (
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-yellow-500/15 to-amber-400/10 border border-yellow-500/40 flex items-center gap-4">
                <Sparkles className="size-6 text-yellow-300 shrink-0" />
                <div className="flex-1">
                  <div className="font-black text-yellow-200 text-lg">Bạn đang là Hội Viên VIP</div>
                  <div className="text-yellow-200/70 text-sm mt-0.5">Còn lại: {vipRemain}. Mua thêm gói tháng để gia hạn (cộng dồn 30 ngày).</div>
                </div>
              </div>
            )}
            <div className="mb-10 lg:mb-12">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary w-fit mb-6 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(230,57,70,0.2)]">
                 <Zap className="size-4" />
                 Hệ Thống Tự Động 24/7
               </div>
               <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 font-display leading-[1.1]"><span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40">GÓI TÀI TRỢ</span> <br className="hidden md:block"/> <span className="text-primary">ĐỘC QUYỀN.</span></h1>
               <p className="text-white/40 text-lg max-w-md font-medium">Bơm Xu cực nhanh, an toàn tuyệt đối. Mở khóa hàng chục ngàn chương truyện VIP không giới hạn.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PACKAGES.map(pack => {
                const isSelected = selectedPack.id === pack.id;
                return (
                  <div 
                    key={pack.id} 
                    onClick={() => setSelectedPack(pack)}
                    className={`relative p-6 rounded-[2rem] border-2 transition-all duration-300 cursor-pointer group overflow-hidden ${
                      isSelected 
                        ? 'border-primary bg-primary/5 shadow-[0_0_40px_rgba(230,57,70,0.15)] scale-[1.02]' 
                        : 'border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/[0.07]'
                    }`}
                  >
                    {isSelected && <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 blur-2xl"></div>}
                    
                    {pack.starter && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-500 to-cyan-400 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-3xl rounded-tr-3xl flex items-center gap-1.5 shadow-lg">
                        Khởi Đầu
                      </div>
                    )}
                    {pack.popular && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-orange-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-3xl rounded-tr-3xl flex items-center gap-1.5 shadow-lg">
                        <Sparkles className="size-3" /> BEST
                      </div>
                    )}
                    {pack.monthly && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-pink-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-3xl rounded-tr-3xl flex items-center gap-1.5 shadow-lg">
                        <Sparkles className="size-3" /> Combo Tháng
                      </div>
                    )}
                    {pack.vip && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-600 to-yellow-400 text-black text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-3xl rounded-tr-3xl flex items-center gap-1.5 shadow-lg">
                        MAX LỜI
                      </div>
                    )}
                    
                    <div className="flex flex-col relative z-10">
                        <div className={`size-12 rounded-2xl flex items-center justify-center mb-4 ${isSelected ? 'bg-primary/20 text-primary scale-110 shadow-lg shadow-primary/20' : 'bg-white/10 text-white/50 group-hover:text-white transition-all'}`}>
                           <Coins className="size-6" />
                        </div>
                        <span className={`text-2xl font-black font-display tracking-tight mb-1 ${isSelected ? 'text-white' : 'text-white/80'}`}>{pack.coins.toLocaleString('vi-VN')} Xu</span>
                        
                        {pack.bonus > 0 ? (
                          <span className={`text-xs font-black uppercase tracking-wider mb-8 ${isSelected ? 'text-green-400' : 'text-white/40'}`}>
                            + {pack.bonus.toLocaleString('vi-VN')} Xu Thưởng
                          </span>
                        ) : (
                           <span className="text-xs font-black uppercase tracking-wider mb-8 text-transparent select-none">No bonus</span>
                        )}

                        <span className={`text-xl mt-auto font-bold ${isSelected ? 'text-primary' : 'text-white/60 group-hover:text-white transition-colors'}`}>
                          {pack.vnd.toLocaleString('vi-VN')} đ
                        </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Sticky Payment Summary */}
          <div className="w-full lg:w-2/5 lg:sticky lg:top-32">
             <div className="w-full bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                <div className="absolute -top-40 -right-40 size-80 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>

                <div className="flex justify-center mb-8">
                  <div className="relative group">
                     <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-700"></div>
                     <div className="size-28 rounded-[2rem] bg-gradient-to-br from-[#141414] to-[#050505] flex items-center justify-center ring-1 ring-white/10 shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-300 relative z-10">
                        <QrCode className="size-12 text-primary drop-shadow-[0_0_10px_rgba(230,57,70,0.5)]" />
                     </div>
                  </div>
                </div>

                <h3 className="font-display font-black text-2xl text-white mb-6 text-center">
                  Tổng Quan Giao Dịch
                </h3>
                
                <div className="bg-white/5 border border-white/5 rounded-3xl p-6 mb-8 w-full">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                    <span className="font-medium text-white/50">Gói đã chọn</span>
                    <span className="font-black text-white text-lg">{(selectedPack.coins + selectedPack.bonus).toLocaleString('vi-VN')} Xu</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-white/50">Thành tiền</span>
                    <span className="font-black text-primary text-3xl">{selectedPack.vnd.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>

                <div className="w-full space-y-4">
                  <button 
                    onClick={handlePayOS}
                    disabled={isCreatingOrder}
                    className="group relative w-full h-16 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:scale-[1.02] transition-all flex items-center justify-center overflow-hidden disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-black/10 to-transparent group-hover:animate-[shine_1.5s_ease-in-out_infinite]"></div>
                    
                    <div className="relative z-10 flex items-center gap-3">
                      {isCreatingOrder ? (
                        <>
                          <Loader2 className="size-5 animate-spin" />
                          Đang tạo cổng an toàn...
                        </>
                      ) : (
                        <>
                          Thanh Toán Bằng PayOS
                          <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs text-white/30 font-bold uppercase tracking-widest pt-2">
                    <ShieldCheck className="size-4 text-green-500/70" />
                    <span>Chứng thực an toàn bởi Ngân Hàng Nhà Nước</span>
                  </div>
                </div>
             </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
