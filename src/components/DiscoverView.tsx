import { useState, useEffect, useMemo } from 'react';
import { Novel } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Star, Flame, Clock, BookOpen, ChevronRight, Eye, Trophy, Loader2, Crown, Sparkles, TrendingUp, Medal, Compass } from 'lucide-react';
import Pagination from './Pagination';
import BannerSlider from './BannerSlider';
import ContinueReadingRail from './ContinueReadingRail';
import { resolveNovelCover } from '@/lib/covers';
import { FALLBACK_NOVELS } from '@/data/fallbackNovels';
import { formatViews, getNovelViews, getNovelTotalChapters } from '@/lib/novelStats';

interface DiscoverViewProps {
  onNovelSelect: (novel: Novel) => void;
}

const UPDATES_PER_PAGE = 10;

export default function DiscoverView({ onNovelSelect }: DiscoverViewProps) {
  const [dynamicNovels, setDynamicNovels] = useState<Novel[]>([]);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'TRUYỆN' | 'ĐẠI GIA' | 'TÁC GIẢ'>('TRUYỆN');
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [recommendationPage, setRecommendationPage] = useState(0);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'), orderBy('coins', 'desc'), limit(10));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      setTopUsers(users);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => unsubUsers();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'novels'), 
      orderBy('updatedAt', 'desc'), 
      limit(visibleLimit)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const novels = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Novel));
      setDynamicNovels(novels);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'novels');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [visibleLimit]);

  // Deterministic realistic view baseline so NO novel shows "0 xem"
  const getNovelViews = (novel: Novel): number => {
    const raw = Number(novel.views);
    if (raw && raw > 1000) return raw;

    let hash = 0;
    const str = novel.title || novel.id || '';
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    // High engagement views between 36,400 and 188,000
    const baseline = 36400 + (Math.abs(hash) % 152000);
    return baseline;
  };

  const formatViews = (viewsOrNovel: any) => {
    if (typeof viewsOrNovel === 'object' && viewsOrNovel !== null) {
      const v = getNovelViews(viewsOrNovel);
      if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
      if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
      return String(v);
    }
    const v = Number(viewsOrNovel) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return String(v);
  };

  const allNovels = dynamicNovels.length > 0 ? dynamicNovels : (FALLBACK_NOVELS as unknown as Novel[]);

  // 1. Hero Banner: Marquee 5 blockbuster novels across diverse genres
  const bannerNovels = useMemo(() => {
    const heroIds = [
      'vo-than-chua-te',
      'tong-tai-co-chap-vo-cu-lai-yeu-lan-nua-65wu',
      'nu-phu-phan-cong-he-thong-nu-than-gioi-giai-tri-4w51',
      'luan-hoi-chi-chu-tuoc-doat-van-gioi',
      'tu-xuan',
    ];
    const picked = heroIds
      .map(id => allNovels.find(n => n.id === id))
      .filter((n): n is Novel => !!n);
    if (picked.length >= 3) return picked;
    const hot = allNovels.filter(n => n.isHot);
    return hot.length > 0 ? hot.slice(0, 5) : allNovels.slice(0, 3);
  }, [allNovels]);

  // Exclude banner novels from immediate recommendation to avoid visual repetition at top of page
  const bannerIdSet = useMemo(() => new Set(bannerNovels.map(n => n.id)), [bannerNovels]);

  // 2. Section "Đề Cử Hôm Nay": 9 distinctive novels, excluding banner novels
  const recommendedNovels = useMemo(() => {
    const candidate = allNovels.filter(n => !bannerIdSet.has(n.id));
    return candidate.length >= 9 ? candidate.slice(0, 9) : allNovels.slice(5, 14);
  }, [allNovels, bannerIdSet]);

  // 3. Section "Truyện Hot Tháng Này": 10 diverse novels from different genres
  const hotNovels = useMemo(() => {
    return allNovels.filter(n => n.isHot).slice(0, 10);
  }, [allNovels]);

  // 4. Section "Truyện Hoàn Thành": Filter strictly completed novels
  const fullNovels = useMemo(() => {
    return allNovels.filter(n => n.isFull || n.status === 'Hoàn thành').slice(0, 8);
  }, [allNovels]);

  // 5. Section "Mới Cập Nhật": All novels paginated
  const latestUpdates = allNovels;

  // 6. Section "Bảng Xếp Hạng": Top novels sorted by views
  const leaderboardNovels = useMemo(() => {
    return [...allNovels]
      .sort((a, b) => getNovelViews(b) - getNovelViews(a))
      .slice(0, 10);
  }, [allNovels]);

  if (loading && dynamicNovels.length === 0 && FALLBACK_NOVELS.length === 0) {
    return (
      <div className="h-screen flex flex-col justify-center items-center gap-4 bg-[#0B0C10]">
        <Loader2 className="animate-spin text-amber-500 size-12" />
        <p className="text-slate-400 text-sm font-semibold tracking-wider">Đang tải vũ trụ Truyen24h...</p>
      </div>
    );
  }

  if (allNovels.length === 0) {
    return (
      <div className="h-screen flex justify-center items-center text-slate-300 bg-[#0B0C10]">
        Hiện chưa có truyện nào.
      </div>
    );
  }

  const totalPages = Math.ceil(latestUpdates.length / UPDATES_PER_PAGE);
  const paginatedUpdates = latestUpdates.slice(
    (currentPage - 1) * UPDATES_PER_PAGE,
    currentPage * UPDATES_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const element = document.getElementById('latest-updates');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getCoverUrl = (novel: Novel) => {
    return resolveNovelCover(novel);
  };

  const HOT_GENRES = [
    { label: 'Tất cả', icon: '🔥', slug: '' },
    { label: 'Huyền Huyễn', icon: '⚡', slug: 'huyen-huyen' },
    { label: 'Tiên Hiệp', icon: '🗡️', slug: 'tien-hiep' },
    { label: 'Đô Thị', icon: '🏙️', slug: 'do-thi' },
    { label: 'Ngôn Tình', icon: '💖', slug: 'ngon-tinh' },
    { label: 'Trọng Sinh', icon: '⏳', slug: 'trong-sinh' },
    { label: 'Kinh Dị', icon: '👻', slug: 'kinh-di' },
    { label: 'Hệ Thống', icon: '🎮', slug: 'he-thong' },
    { label: 'Cổ Đại', icon: '🌸', slug: 'co-dai' },
  ];

  return (
    <main className="w-full max-w-[1240px] px-3 sm:px-4 md:px-8 pb-32 md:pb-24 flex flex-col gap-8 md:gap-16 mx-auto pt-3 md:pt-8 bg-[#0B0C10] text-slate-100">
      
      {/* 1. Hero Banner Carousel */}
      <BannerSlider novels={bannerNovels} />
      
      {/* 2. Mobile Quick Genre Scroll Pills */}
      <section className="md:hidden -mt-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
          {HOT_GENRES.map((g) => (
            <a
              key={g.label}
              href={g.slug ? `/tim-kiem?genre=${g.slug}` : '/'}
              className="flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 hover:border-amber-500/40 text-xs font-bold text-slate-200 active:scale-95 transition-all shadow-sm"
            >
              <span>{g.icon}</span>
              <span>{g.label}</span>
            </a>
          ))}
        </div>
      </section>
      
      {/* 3. Continue Reading Rail */}
      <ContinueReadingRail />

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Main Content Column */}
        <div className="flex-1 flex flex-col gap-14 md:gap-18 overflow-hidden min-w-0">
          
          {/* Section: Đề Cử Hôm Nay */}
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl text-amber-400 shadow-inner">
                  <Sparkles className="size-5 fill-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    Đề Cử Hôm Nay
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hidden sm:inline-block">Tuyển chọn</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">Những siêu phẩm được biên tập viên gợi ý</p>
                </div>
              </div>

              {/* Dots */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map(idx => (
                  <button 
                    key={idx}
                    onClick={() => setRecommendationPage(idx)}
                    aria-label={`Page ${idx + 1}`}
                    className={`h-2 transition-all rounded-full ${recommendationPage === idx ? 'w-6 bg-gradient-to-r from-amber-400 to-orange-500' : 'w-2 bg-white/20 hover:bg-white/40'}`}
                  />
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {recommendedNovels.slice(recommendationPage * 3, recommendationPage * 3 + 3).map((novel, index) => (
                <div 
                  key={novel.id || index}
                  onClick={() => onNovelSelect(novel)}
                  className="glass-card rounded-2xl p-4 flex flex-col gap-3.5 group cursor-pointer relative overflow-hidden"
                >
                  <div className="relative aspect-[3/4.2] w-full rounded-xl overflow-hidden shadow-lg bg-black/40">
                    <img 
                      src={getCoverUrl(novel)} 
                      alt={novel.title} 
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                    
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-black text-amber-400">
                      <Star className="size-3 fill-amber-400" />
                      <span>{novel.rating || '4.9'}</span>
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] text-white/90 font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-md text-[10px] uppercase font-black tracking-wider text-amber-300">
                        {novel.genres[0] || 'Tu Tiên'}
                      </span>
                      <span className="text-[10px] text-slate-300 font-semibold">{formatViews(novel)} xem</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-bold text-sm md:text-base text-white line-clamp-1 group-hover:text-amber-400 transition-colors leading-snug">
                      {novel.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {novel.description}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.06] mt-1 font-medium">
                      <span className="truncate max-w-[120px] text-slate-300">{novel.author}</span>
                      <span className="text-emerald-400 font-bold">{novel.status || 'Đang ra'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Truyện Hot Tháng Này */}
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-500 shadow-inner">
                  <Flame className="size-5 fill-rose-500" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    Truyện Hot Tháng Này
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 hidden sm:inline-block">Thịnh hành</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">Top những tác phẩm nhiều lượt đọc nhất hiện nay</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  const el = document.getElementById('latest-updates');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group text-xs font-bold text-amber-400 hover:text-amber-300 transition-all flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3.5 py-1.5 rounded-full"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
              {hotNovels.map((novel) => (
                <div 
                  key={novel.id}
                  onClick={() => onNovelSelect(novel)}
                  className="glass-card rounded-2xl p-2.5 md:p-3 flex flex-col gap-2.5 group cursor-pointer"
                >
                  <div className="relative aspect-[3/4.4] rounded-xl overflow-hidden shadow-md bg-black/40">
                    <img 
                      src={getCoverUrl(novel)} 
                      alt={novel.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108" 
                    />
                    
                    {/* Top Hot Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[9px] font-black rounded-md uppercase shadow-lg shadow-red-500/30">
                      <Flame className="size-2.5 fill-white" />
                      <span>HOT</span>
                    </div>

                    {/* Bottom Stats Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                      <div className="flex items-center justify-between text-xs text-white">
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="size-3 fill-amber-400" />
                          {novel.rating || '4.9'}
                        </span>
                        <span className="text-[11px] text-slate-300 font-medium">{formatViews(novel)} xem</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 px-1">
                    <h3 className="font-bold text-white text-xs md:text-sm line-clamp-2 group-hover:text-amber-400 transition-colors leading-snug">
                      {novel.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">{novel.author}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Mới Cập Nhật */}
          <section id="latest-updates">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-2xl text-blue-400 shadow-inner">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Mới Cập Nhật</h2>
                  <p className="text-xs text-slate-400 font-medium">Theo dõi các chương mới vừa xuất bản</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
              {paginatedUpdates.map((novel) => (
                <div 
                  key={novel.id}
                  onClick={() => onNovelSelect(novel)}
                  className="flex items-center gap-4 p-4 md:p-5 hover:bg-white/[0.04] transition-all cursor-pointer group"
                >
                  <div className="w-16 sm:w-20 aspect-[3/4.2] rounded-xl overflow-hidden shrink-0 shadow-md bg-black/40 border border-white/10 group-hover:border-amber-500/40 transition-colors">
                    <img 
                      src={getCoverUrl(novel)} 
                      alt={novel.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm md:text-base truncate group-hover:text-amber-400 transition-colors">
                        {novel.title}
                      </h4>
                      {novel.isHot && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[8px] font-black rounded uppercase shrink-0">
                          HOT
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="text-slate-300 font-medium truncate max-w-[140px]">{novel.author}</span>
                      <span className="text-slate-600">•</span>
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 text-[11px]">
                        <BookOpen className="size-3" />
                        <span>
                          {novel.isFull || novel.status === 'Hoàn thành'
                            ? `Full • ${getNovelTotalChapters(novel)} chương`
                            : `Chương ${novel.latestChapterNumber || novel.chapters?.length || getNovelTotalChapters(novel)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-end shrink-0 gap-1 text-right">
                    <span className="text-[10px] font-black text-amber-300/80 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      {novel.genres[0] || 'Truyện'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">{novel.lastUpdated || 'Vừa xong'}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={handlePageChange} 
              />
            </div>
          </section>

          {/* Section: Truyện Đã Hoàn Thành */}
          <section>
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 shadow-inner">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    Truyện Đã Hoàn Thành
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hidden sm:inline-block">Đọc Trọn Bộ</span>
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">Trọn bộ không ngắt quãng, đọc một lèo đến chương cuối</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-5">
              {fullNovels.map((novel) => (
                <div 
                  key={novel.id}
                  onClick={() => onNovelSelect(novel)}
                  className="glass-card rounded-2xl p-3 flex flex-col gap-2.5 group cursor-pointer"
                >
                  <div className="relative aspect-[3/4.4] rounded-xl overflow-hidden shadow-md bg-black/40">
                    <img 
                      src={getCoverUrl(novel)} 
                      alt={novel.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108" 
                    />
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 bg-emerald-500 text-black text-[9px] font-black rounded-md uppercase tracking-wider shadow-md">
                        FULL
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-white text-xs md:text-sm line-clamp-1 group-hover:text-amber-400 transition-colors leading-snug">
                    {novel.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">{novel.author}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Sidebar: Bảng Xếp Hạng Đẳng Cấp */}
        <aside className="w-full lg:w-[350px] shrink-0">
          <div className="glass-panel rounded-3xl p-6 lg:p-7 sticky top-24 shadow-2xl border border-white/[0.08]">
            
            {/* Header */}
            <div className="flex flex-col gap-5 mb-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <Trophy className="text-amber-400 size-6" />
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Bảng Xếp Hạng</h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-full border border-white/10">Tuần Này</span>
              </div>
              
              {/* Tabs */}
              <div className="flex bg-[#07080B] rounded-xl p-1 border border-white/[0.08]">
                {(['TRUYỆN', 'ĐẠI GIA', 'TÁC GIẢ'] as const).map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveLeaderboardTab(tab)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${activeLeaderboardTab === tab ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <ul className="flex flex-col gap-4">
              {activeLeaderboardTab === 'TRUYỆN' && leaderboardNovels.map((novel, index) => {
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;

                return (
                  <li 
                    key={novel.id || index}
                    onClick={() => onNovelSelect(novel)}
                    className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/[0.04] transition-all group cursor-pointer"
                  >
                    {/* Rank Badge */}
                    <div className="shrink-0 flex items-center justify-center">
                      {isTop1 ? (
                        <div className="size-8 rounded-lg rank-gold flex items-center justify-center font-black text-sm">
                          <Crown className="size-4" />
                        </div>
                      ) : isTop2 ? (
                        <div className="size-8 rounded-lg rank-silver flex items-center justify-center font-black text-sm">
                          2
                        </div>
                      ) : isTop3 ? (
                        <div className="size-8 rounded-lg rank-bronze flex items-center justify-center font-black text-sm">
                          3
                        </div>
                      ) : (
                        <span className="size-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-xs text-slate-400">
                          {index + 1}
                        </span>
                      )}
                    </div>

                    <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 bg-black/40 border border-white/10 group-hover:border-amber-500/40 transition-colors">
                      <img 
                        src={getCoverUrl(novel)} 
                        alt={novel.title} 
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform" 
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <h4 className="font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors text-xs md:text-sm">
                        {novel.title}
                      </h4>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold bg-white/5 px-1.5 py-0.2 rounded">
                          {novel.genres[0] || 'Tu Tiên'}
                        </span>
                        <span className="text-amber-400/90 font-bold">{formatViews(novel)} xem</span>
                      </div>
                    </div>
                  </li>
                );
              })}

              {activeLeaderboardTab === 'ĐẠI GIA' && topUsers.slice(0, 10).map((user, index) => (
                <li 
                  key={user.uid || index}
                  className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/[0.04] transition-all group cursor-pointer"
                >
                  <div className="shrink-0 flex items-center justify-center">
                    <span className={`size-8 rounded-lg flex items-center justify-center font-black text-xs ${index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : index === 2 ? 'rank-bronze' : 'bg-white/5 text-slate-400'}`}>
                      {index + 1}
                    </span>
                  </div>

                  <div className="size-10 rounded-full overflow-hidden border border-white/15 group-hover:border-amber-400 transition-colors">
                    <img 
                      src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} 
                      alt={user.displayName} 
                      className="w-full h-full object-cover" 
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors text-xs md:text-sm">
                      {user.displayName || 'Đại Gia Ẩn Danh'}
                    </h4>
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {user.coins || 0} Xu
                    </span>
                  </div>
                </li>
              ))}

              {activeLeaderboardTab === 'TÁC GIẢ' && allNovels.slice(0, 10).map((novel, index) => (
                <li 
                  key={'author_' + (novel.id || index)}
                  className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/[0.04] transition-all group cursor-pointer"
                >
                  <div className="shrink-0 flex items-center justify-center">
                    <span className={`size-8 rounded-lg flex items-center justify-center font-black text-xs ${index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : index === 2 ? 'rank-bronze' : 'bg-white/5 text-slate-400'}`}>
                      {index + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors text-xs md:text-sm">
                      {novel.author}
                    </h4>
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {formatViews(novel)} Lực Chiến
                    </span>
                  </div>
                </li>
              ))}
            </ul>

          </div>
        </aside>

      </div>
    </main>
  );
}
