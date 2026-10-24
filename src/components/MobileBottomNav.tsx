"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Trophy, BookMarked, Sparkles } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();

  // If reading chapter, reader has its own full screen immersive controls
  if (pathname?.startsWith('/doc/')) {
    return null;
  }

  const navItems = [
    {
      label: 'Trang chủ',
      href: '/',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      label: 'Khám phá',
      href: '/tim-kiem',
      icon: Compass,
      isActive: pathname.startsWith('/tim-kiem') || pathname.startsWith('/the-loai'),
    },
    {
      label: 'Xếp hạng',
      href: '/bang-xep-hang',
      icon: Trophy,
      isActive: pathname.startsWith('/bang-xep-hang'),
    },
    {
      label: 'Tủ sách',
      href: '/tu-sach',
      icon: BookMarked,
      isActive: pathname.startsWith('/tu-sach'),
    },
    {
      label: 'Nạp Xu',
      href: '/vip',
      icon: Sparkles,
      isActive: pathname.startsWith('/vip'),
      isSpecial: true,
    },
  ];

  return (
    <nav 
      aria-label="Thanh điều hướng di động"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0B0C10]/95 backdrop-blur-2xl border-t border-amber-500/20 shadow-[0_-8px_30px_rgba(0,0,0,0.85)] pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-2 px-2"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          if (item.isSpecial) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex flex-col items-center justify-center -mt-3.5 transition-transform active:scale-95"
              >
                <div className={`p-2.5 rounded-2xl shadow-lg transition-all duration-300 ${
                  active
                    ? 'bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 shadow-amber-500/50 scale-105'
                    : 'bg-gradient-to-tr from-amber-600 to-orange-500 text-slate-950 shadow-amber-500/30 hover:brightness-110'
                }`}>
                  <Icon className="size-5 stroke-[2.5]" />
                </div>
                <span className={`text-[10px] font-bold mt-1 tracking-tight ${
                  active ? 'text-amber-400' : 'text-amber-500/90'
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 active:scale-95 ${
                active 
                  ? 'text-amber-400 font-bold' 
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`size-5 transition-transform duration-200 ${active ? 'scale-110 text-amber-400 stroke-[2.2]' : 'stroke-[1.8]'}`} />
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
