"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import ReaderView from '@/components/ReaderView';
import ChapterComments from '@/components/ChapterComments';
import { auth, loginWithGoogle } from '@/firebase';

export default function ReaderClient({ novel, chapter }: { novel: any, chapter: any }) {
  const router = useRouter();

  // Fire-and-forget mission ping: every chapter read counts up to 3/day.
  // Server dedupes by chapter id so re-opening the same chapter doesn't
  // farm extra points.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      fetch('/api/missions/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uid: u.uid,
          missionId: 'read_chapter',
          dedupKey: `chapter:${novel.id}:${chapter.id}`,
        }),
      }).catch(() => { /* non-fatal */ });

      // Persist reading progress so /api/reading/continue can resurface
      // this chapter on the homepage 'Tiếp tục đọc' rail. Fire-and-forget.
      fetch('/api/reading/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          uid: u.uid,
          novelId: novel.id,
          chapterId: chapter.id,
          chapterNumber: chapter.chapterNumber,
        }),
      }).catch(() => { /* non-fatal */ });
    });
    return () => unsub();
  }, [novel.id, chapter.id]);

  return (
    <>
      <ReaderView
        novel={novel}
        chapter={chapter}
        onBack={() => router.push(`/truyen/${novel.id}`)}
        onLogin={loginWithGoogle}
        onChapterChange={(ch) => {
           router.push(`/doc/${novel.id}/${ch.id}`);
        }}
      />
      <ChapterComments novelId={novel.id} chapterId={chapter.id} onLogin={loginWithGoogle} />
    </>
  );
}
