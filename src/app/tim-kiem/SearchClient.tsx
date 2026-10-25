"use client";

import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import FilterView from '@/components/FilterView';
import { useSearchParams, useRouter } from 'next/navigation';

interface SearchClientProps {
  serverGenre?: string;
  serverSearch?: string;
  serverChapters?: string;
}

export default function SearchClient({ serverGenre, serverSearch, serverChapters }: SearchClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Support both 'genre' and 'the-loai' query parameters, with fallback to server-rendered props
  const genre = searchParams.get('genre') || searchParams.get('the-loai') || serverGenre;
  const chapters = searchParams.get('chapters') || searchParams.get('so-chuong') || serverChapters;
  const q = searchParams.get('q') || searchParams.get('tu-khoa') || serverSearch;

  return (
    <>
      <TopNavBarClientWrapper />
      <FilterView 
        initialGenre={genre} 
        initialChapters={chapters}
        initialSearch={q} 
        onNovelSelect={(novel) => router.push(`/truyen/${(novel as any).slug || novel.id}`)} 
      />
    </>
  );
}
