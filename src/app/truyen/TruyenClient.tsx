"use client";

import TopNavBarClientWrapper from '@/components/TopNavBarClientWrapper';
import FilterView from '@/components/FilterView';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function TruyenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const genre = searchParams.get('genre') || undefined;
  const chapters = searchParams.get('chapters') || undefined;
  const q = searchParams.get('q') || undefined;

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

export default function TruyenClient() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-muted">Đang tải danh sách truyện...</div>}>
      <TruyenContent />
    </Suspense>
  );
}
