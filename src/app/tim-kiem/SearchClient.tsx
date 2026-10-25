"use client";

import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import FilterView from '@/components/FilterView';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SearchClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Support both 'genre' and 'the-loai' query parameters
  const genre = searchParams.get('genre') || searchParams.get('the-loai') || undefined;
  const chapters = searchParams.get('chapters') || searchParams.get('so-chuong') || undefined;
  const q = searchParams.get('q') || searchParams.get('tu-khoa') || undefined;

  return (
    <>
      <TopNavBarClientWrapper />
      <FilterView 
        initialGenre={genre} 
        initialChapters={chapters}
        initialSearch={q} 
        onNovelSelect={(novel) => router.push(`/truyen/${novel.id}`)} 
      />
    </>
  );
}
