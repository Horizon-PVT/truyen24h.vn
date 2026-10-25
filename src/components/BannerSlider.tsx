import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Flame, Star, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Novel } from '../types';
import { resolveNovelCover } from '@/lib/covers';
import { formatViews } from '@/lib/novelStats';

interface BannerSliderProps {
  novels: Novel[];
}

export default function BannerSlider({ novels }: BannerSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const hotNovels = novels.filter(n => n.isHot);
  const bannerNovels = novels.length <= 5 && novels.length > 0 ? novels : (hotNovels.length > 0 ? hotNovels.slice(0, 5) : novels.slice(0, 3));

  useEffect(() => {
    if (bannerNovels.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerNovels.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [bannerNovels.length]);

  if (bannerNovels.length === 0) return null;

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % bannerNovels.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + bannerNovels.length) % bannerNovels.length);

  return (
    <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] mb-8 md:mb-14 rounded-[28px] md:rounded-[36px] overflow-hidden group border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.7)] bg-[#0D0F17]">
      {bannerNovels.map((novel, index) => {
        const cover = resolveNovelCover(novel);
        const isActive = index === currentIndex;

        return (
          <div 
            key={novel.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${isActive ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0 pointer-events-none'}`}
          >
            {/* Cinematic Ambient Backdrop Blur */}
            <div className="absolute inset-0 overflow-hidden">
              <img 
                src={cover}
                alt={novel.title}
                className="w-full h-full object-cover opacity-30 blur-3xl scale-125 saturate-150 transform -translate-y-10"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-[#0B0C10]/75 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C10] via-[#0B0C10]/85 to-transparent"></div>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent"></div>
            </div>
            
            {/* Content Layer */}
            <div className="absolute inset-0 z-20 flex items-center p-6 md:p-12 lg:p-14 gap-8 md:gap-12">
              
              {/* 3D Angled Book Cover Presentation */}
              <div className="hidden md:block relative w-[200px] h-[280px] lg:w-[220px] lg:h-[310px] shrink-0 group/cover">
                <div className="absolute -inset-2 bg-gradient-to-tr from-amber-500/30 to-orange-500/30 rounded-2xl blur-xl opacity-75 group-hover/cover:opacity-100 transition-opacity"></div>
                <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/15 shadow-[0_15px_35px_rgba(0,0,0,0.8)] transform -rotate-1 group-hover/cover:rotate-0 transition-transform duration-500">
                  <img 
                    src={cover}
                    alt={novel.title}
                    className="w-full h-full object-cover transform group-hover/cover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  
                  {novel.isHot && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md shadow-lg shadow-red-500/40">
                      <Flame className="size-3 fill-white" />
                      <span>HOT</span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/90 font-bold bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="size-3 fill-amber-400" />
                      {novel.rating || '4.9'}
                    </span>
                    <span>{formatViews(novel)} xem</span>
                  </div>
                </div>
              </div>

              {/* Text Info */}
              <div className="flex-1 text-left max-w-2xl">
                
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
                    <Sparkles className="size-3 fill-amber-400 text-amber-400" />
                    Siêu Phẩm Đề Cử
                  </span>
                  
                  {novel.genres?.slice(0, 3).map((g) => (
                    <span 
                      key={g}
                      className="px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-bold text-slate-300 bg-white/5 border border-white/10 backdrop-blur-md"
                    >
                      {g}
                    </span>
                  ))}
                </div>

                {/* Title */}
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-3 md:mb-4 leading-tight tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                  {novel.title}
                </h2>

                {/* Author & Status */}
                <div className="flex items-center gap-3 text-xs md:text-sm text-slate-400 mb-4 font-medium">
                  <span>Tác giả: <strong className="text-slate-200 font-bold">{novel.author}</strong></span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">{novel.status || 'Đang ra'}</span>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm md:text-base text-slate-300/90 line-clamp-2 md:line-clamp-3 mb-6 md:mb-8 leading-relaxed max-w-xl font-normal">
                  {novel.description || 'Truyện chữ đỉnh cao, khám phá ngay cốt truyện đặc sắc và những màn đối đầu kịch tính...'}
                </p>
                
                {/* CTA Action */}
                <div className="flex items-center gap-4">
                  <Link 
                    href={`/truyen/${novel.id}`} 
                    className="gold-gradient-btn px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider inline-flex items-center gap-2.5 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50"
                  >
                    <BookOpen className="size-4" />
                    <span>Đọc Ngay</span>
                  </Link>
                  <Link 
                    href={`/truyen/${novel.id}`}
                    className="px-5 py-3 rounded-xl font-bold text-xs md:text-sm text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all hidden sm:inline-flex"
                  >
                    Chi tiết
                  </Link>
                </div>

              </div>
            </div>
          </div>
        );
      })}

      {/* Navigation Arrows */}
      <button 
        onClick={prevSlide}
        aria-label="Previous slide"
        className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-30 p-2.5 md:p-3 rounded-full bg-black/40 text-white/80 hover:text-amber-400 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 border border-white/10 hover:border-amber-500/40 hover:scale-110"
      >
        <ChevronLeft className="size-5 md:size-6" />
      </button>
      <button 
        onClick={nextSlide}
        aria-label="Next slide"
        className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-30 p-2.5 md:p-3 rounded-full bg-black/40 text-white/80 hover:text-amber-400 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 border border-white/10 hover:border-amber-500/40 hover:scale-110"
      >
        <ChevronRight className="size-5 md:size-6" />
      </button>

      {/* Progress Bars */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
        {bannerNovels.map((_, idx) => (
          <button 
            key={idx} 
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1.5 transition-all duration-300 rounded-full ${idx === currentIndex ? 'w-7 bg-gradient-to-r from-amber-400 to-orange-500' : 'w-2 bg-white/30 hover:bg-white/60'}`}
          />
        ))}
      </div>
    </div>
  );
}
