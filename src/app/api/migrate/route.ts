import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase-backend';
import { NOVELS } from '@/constants';
import { doc, setDoc } from 'firebase/firestore';
import { authorizeAdmin } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status || 401 });

  try {
    let novelCount = 0;
    
    // Push novels and chapters
    for (const novel of NOVELS) {
      // Clean up chapters from novel document to save document size if needed, 
      // but for simplicity we can store the whole structure as is for now,
      // or we can store NOVEL doc without chapters, and CHAPTER docs separate.
      // Firestore has 1MB limit. Let's separate them.
      
      const { chapters, ...novelData } = novel;
      
      await setDoc(doc(db, 'novels', novel.id), novelData);
      novelCount++;
      
      // Store chapters in a subcollection or separate collection
      if (chapters) {
        for (const chap of chapters) {
          await setDoc(doc(db, `novels/${novel.id}/chapters`, chap.id), chap);
        }
      }
    }

    return NextResponse.json({ message: `Đã Migrate thành công ${novelCount} bộ truyện!` });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Migrate failed' }, { status: 500 });
  }
}
