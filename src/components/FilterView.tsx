import { Filter, ChevronDown, BookOpen, Star, Eye, Loader2 } from 'lucide-react';
import { Novel } from '../types';
import { GENRES } from '../constants';
import { useState, useMemo, useEffect } from 'react';
import Pagination from './Pagination';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { isPublicItem } from '../lib/visibilityGuard';
import { formatViews, getNovelTotalChapters } from '@/lib/novelStats';
import { FALLBACK_NOVELS } from '@/data/fallbackNovels';
import { resolveNovelCover } from '@/lib/covers';

interface FilterViewProps {
  initialGenre?: string;
  initialSearch?: string;
  initialChapters?: string;
  onNovelSelect: (novel: Novel) => void;
}

const ITEMS_PER_PAGE = 12;

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
}

export function slugifyGenre(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveGenreName(input?: string): string {
  if (!input || input === 'Tất cả' || input === 'all') return 'Tất cả';
  const clean = input.trim();
  const slug = slugifyGenre(clean);

  // Exact match in GENRES
  const exact = GENRES.find(g => g.toLowerCase() === clean.toLowerCase());
  if (exact) return exact;

  // Slug match in GENRES (e.g. 'huyen-huyen' -> 'Huyền Huyễn')
  const bySlug = GENRES.find(g => slugifyGenre(g) === slug);
  if (bySlug) return bySlug;

  // Normalized match
  const byNorm = GENRES.find(g => normalize(g) === normalize(clean));
  if (byNorm) return byNorm;

  return clean;
}

export default function FilterView({ initialGenre, initialSearch, initialChapters, onNovelSelect }: FilterViewProps) {
  const [selectedGenre, setSelectedGenre] = useState<string>(resolveGenreName(initialGenre));
  const [selectedStatus, setSelectedStatus] = useState<'Tất cả' | 'Đang ra' | 'Hoàn thành'>('Tất cả');
  const [selectedGroup, setSelectedGroup] = useState<string>('Tất cả');
  const [selectedChapters, setSelectedChapters] = useState<string>(initialChapters || 'Tất cả');
  const [sortBy, setSortBy] = useState<'Lượt xem' | 'Đánh giá' | 'Mới nhất'>('Mới nhất');
  const [searchTerm, setSearchTerm] = useState<string>(initialSearch || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [allNovels, setAllNovels] = useState<Novel[]>(FALLBACK_NOVELS as unknown as Novel[]);
  const [loading, setLoading] = useState(false);

  // Fetch live data with fallback resilience
  useEffect(() => {
    const qNovels = query(collection(db, 'novels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(qNovels, (snapshot) => {
      if (snapshot && !snapshot.empty) {
        const fetched = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Novel))
          .filter(isPublicItem);
        if (fetched.length > 0) {
          setAllNovels(fetched);
        }
      }
      setLoading(false);
    }, (error) => {
      console.warn('[FilterView] Using static novel catalog fallback:', error?.message || error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync props changes
  useEffect(() => {
    if (initialGenre !== undefined) {
      setSelectedGenre(resolveGenreName(initialGenre));
      setCurrentPage(1);
    }
  }, [initialGenre]);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearchTerm(initialSearch);
      setCurrentPage(1);
    }
  }, [initialSearch]);
  
  useEffect(() => {
    if (initialChapters !== undefined) {
      setSelectedChapters(initialChapters);
      setCurrentPage(1);
    }
  }, [initialChapters]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGenre, selectedStatus, selectedGroup, selectedChapters, searchTerm]);

  const translationGroups = useMemo(() => {
    const groups = new Set<string>();
    allNovels.forEach(novel => {
      if (novel.translationGroup) {
        groups.add(novel.translationGroup);
      }
    });
    return Array.from(groups).sort();
  }, [allNovels]);

  const filteredNovels = useMemo(() => {
    const normalizedSearch = normalize(searchTerm);
    const targetGenreSlug = slugifyGenre(selectedGenre);
    const targetGenreNorm = normalize(selectedGenre);

    return allNovels.filter(novel => {
      const genreMatch = selectedGenre === 'Tất cả' || (novel.genres && novel.genres.some(g => {
        return g.toLowerCase() === selectedGenre.toLowerCase()
          || slugifyGenre(g) === targetGenreSlug
          || normalize(g) === targetGenreNorm;
      }));

      const statusMatch = selectedStatus === 'Tất cả' || novel.status === selectedStatus;
      const groupMatch = selectedGroup === 'Tất cả' || novel.translationGroup === selectedGroup;
      
      const chapterCount = getNovelTotalChapters(novel);
      let chapterMatch = true;
      if (selectedChapters === 'Dưới 100 chương') chapterMatch = chapterCount < 100;
      else if (selectedChapters === '100 - 500 chương') chapterMatch = chapterCount >= 100 && chapterCount <= 500;
      else if (selectedChapters === '500 - 1000 chương') chapterMatch = chapterCount > 500 && chapterCount <= 1000;
      else if (selectedChapters === 'Trên 1000 chương') chapterMatch = chapterCount > 1000;

      const searchMatch = !searchTerm || 
        (novel.title && normalize(novel.title).includes(normalizedSearch)) || 
        (novel.author && normalize(novel.author).includes(normalizedSearch));
        
      return genreMatch && statusMatch && groupMatch && chapterMatch && searchMatch;
    });
  }, [allNovels, selectedGenre, selectedStatus, selectedGroup, selectedChapters, searchTerm]);

  const totalPages = Math.ceil(filteredNovels.length / ITEMS_PER_PAGE);
  const paginatedNovels = filteredNovels.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="w-full max-w-[1200px] px-4 md:px-8 pb-32 mx-auto pt-6 md:pt-12">
      <div className="flex flex-col gap-8 md:gap-12">
        {/* Header & Filter Controls */}
        <div className="bg-surface p-6 md:p-10 rounded-[32px] md:rounded-[40px] shadow-2xl border border-accent/10">
          <div className="flex items-center gap-4 mb-8 md:mb-10">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Filter className="size-6 md:size-7" />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-black text-text-main tracking-tighter uppercase">
                {selectedGenre !== 'Tất cả' ? `Truyện ${selectedGenre}` : 'Bộ lọc truyện'}
              </h1>
              <p className="text-xs md:text-sm text-muted font-medium">Tìm kiếm tác phẩm phù hợp theo thể loại và tiêu chí của bạn</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {/* Genre Filter */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">Thể loại</label>
              <div className="relative">
                <select 
                  value={selectedGenre} 
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full bg-background-light text-text-main font-bold text-sm px-4 py-3.5 rounded-2xl appearance-none border border-accent/20 focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Tất cả">Tất cả thể loại</option>
                  {GENRES.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">Tình trạng</label>
              <div className="relative">
                <select 
                  value={selectedStatus} 
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="w-full bg-background-light text-text-main font-bold text-sm px-4 py-3.5 rounded-2xl appearance-none border border-accent/20 focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Tất cả">Tất cả tình trạng</option>
                  <option value="Đang ra">Đang ra</option>
                  <option value="Hoàn thành">Hoàn thành (Full)</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Translation Group Filter */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">Nhóm dịch</label>
              <div className="relative">
                <select 
                  value={selectedGroup} 
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full bg-background-light text-text-main font-bold text-sm px-4 py-3.5 rounded-2xl appearance-none border border-accent/20 focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Tất cả">Tất cả nhóm</option>
                  {translationGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Chapters Filter */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">Số chương</label>
              <div className="relative">
                <select 
                  value={selectedChapters} 
                  onChange={(e) => setSelectedChapters(e.target.value)}
                  className="w-full bg-background-light text-text-main font-bold text-sm px-4 py-3.5 rounded-2xl appearance-none border border-accent/20 focus:outline-none focus:border-primary transition-all cursor-pointer"
                >
                  <option value="Tất cả">Mọi số chương</option>
                  <option value="Dưới 100 chương">&lt; 100 chương</option>
                  <option value="100 - 500 chương">100 - 500 chương</option>
                  <option value="500 - 1000 chương">500 - 1000 chương</option>
                  <option value="Trên 1000 chương">&gt; 1000 chương</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <span className="text-sm font-bold text-muted">
              Kết quả ({filteredNovels.length})
              {selectedGenre !== 'Tất cả' && <span className="text-primary ml-1.5">• {selectedGenre}</span>}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider hidden sm:inline">Sắp xếp:</span>
              <div className="flex bg-surface p-1 rounded-xl border border-accent/10">
                {(['Mới nhất', 'Lượt xem', 'Đánh giá'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === option ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted hover:text-text-main'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && allNovels.length === 0 ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="animate-spin text-primary size-10" />
            </div>
          ) : paginatedNovels.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6 mb-16">
                {paginatedNovels.map((novel) => (
                  <div 
                    key={novel.id} 
                    onClick={() => onNovelSelect(novel)}
                    className="flex flex-col gap-3 group cursor-pointer"
                  >
                    <div className="relative aspect-[3/4.2] rounded-2xl overflow-hidden shadow-lg border border-accent/10 group-hover:border-primary/50 group-hover:shadow-2xl transition-all duration-500 bg-background-light">
                      <img 
                        src={resolveNovelCover(novel)} 
                        alt={novel.title} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      />
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10">
                        {novel.isHot && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[9px] font-black rounded-md uppercase shadow-lg shadow-red-500/40">
                            <Star className="size-2.5 fill-white text-white" />
                            <span>Hot</span>
                          </div>
                        )}
                        {(novel.isFull || novel.status === 'Hoàn thành') && (
                          <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-md uppercase shadow-md">Full</span>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
                         <div className="flex items-center gap-3 text-white">
                            <div className="flex items-center gap-1">
                              <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                              <span className="font-black text-xs">{novel.rating || '4.9'}</span>
                            </div>
                            <div className="w-[1px] h-3 bg-white/20"></div>
                            <div className="flex items-center gap-1">
                              <Eye className="size-3.5 text-white/80" />
                              <span className="font-bold text-xs">{formatViews(novel)}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                    <div className="flex flex-col px-1">
                      <h3 className="font-bold text-text-main line-clamp-1 group-hover:text-primary transition-colors leading-tight text-sm mb-1">{novel.title}</h3>
                      <p className="text-xs text-muted font-medium truncate">{novel.author}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={handlePageChange} 
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 bg-surface rounded-[40px] border border-dashed border-accent/20">
              <div className="p-6 bg-background-light rounded-full text-muted mb-6">
                <BookOpen className="size-12" />
              </div>
              <h3 className="text-xl font-bold text-text-main mb-2">Không tìm thấy truyện</h3>
              <p className="text-muted text-sm">Hãy thử chọn thể loại khác hoặc chuyển về &quot;Tất cả thể loại&quot; nhé!</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
