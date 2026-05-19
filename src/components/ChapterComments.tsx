/**
 * Flat comment list shown at the bottom of every chapter in ReaderView.
 *
 * Distinct from inline_comments (which is paragraph-level highlight
 * comments triggered by text selection). This component shows the
 * "casual" bottom-of-chapter discussion users expect from any
 * mainstream reader.
 *
 * Path: novels/{novelId}/chapters/{chapterId}/comments
 */
'use client';

import { useEffect, useState } from 'react';
import { db } from '@/firebase';
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, deleteDoc, Timestamp,
} from 'firebase/firestore';
import { MessageSquare, Send, User as UserIcon, Trash2, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Timestamp | null;
}

export default function ChapterComments({
  novelId,
  chapterId,
  onLogin,
}: {
  novelId: string;
  chapterId: string;
  onLogin: () => void;
}) {
  const { user, userProfile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!novelId || !chapterId) return;
    const path = `novels/${novelId}/chapters/${chapterId}/comments`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Comment[]);
      },
      (err) => {
        console.error('comments listen error', err);
        setError('Không tải được bình luận');
      }
    );
    return () => unsub();
  }, [novelId, chapterId]);

  async function submit() {
    if (!user || !userProfile) return onLogin();
    const text = draft.trim();
    if (!text) return;
    if (text.length > 1500) {
      setError('Bình luận tối đa 1500 ký tự');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const path = `novels/${novelId}/chapters/${chapterId}/comments`;
      await addDoc(collection(db, path), {
        userId: user.uid,
        userName: userProfile.displayName || 'Khuyết danh',
        userAvatar: userProfile.photoURL || '',
        content: text,
        createdAt: serverTimestamp(),
      });
      setDraft('');
    } catch (e: any) {
      setError(e.message || 'Gửi thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!user) return;
    if (!confirm('Xoá bình luận này?')) return;
    try {
      const path = `novels/${novelId}/chapters/${chapterId}/comments/${id}`;
      await deleteDoc(doc(db, path));
    } catch (e) {
      console.error(e);
    }
  }

  function timeAgo(ts: Timestamp | null): string {
    if (!ts || typeof ts.toDate !== 'function') return '';
    const ms = Date.now() - ts.toDate().getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s trước`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} ngày trước`;
    return ts.toDate().toLocaleDateString('vi-VN');
  }

  return (
    <section className="max-w-3xl mx-auto px-4 py-12 border-t border-accent/10 mt-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquare className="size-5" />
        </div>
        <h3 className="text-xl font-black tracking-tight">Bình luận chương <span className="text-sm font-normal text-muted">({comments.length})</span></h3>
      </div>

      {/* Composer */}
      {user ? (
        <div className="mb-8 p-4 rounded-2xl bg-surface border border-accent/10">
          <div className="flex gap-3 items-start">
            <img
              src={userProfile?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userProfile?.displayName || 'user')}`}
              alt=""
              className="size-10 rounded-full"
            />
            <div className="flex-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Viết bình luận của anh về chương này..."
                rows={3}
                maxLength={1500}
                className="w-full px-3 py-2 bg-background rounded-xl border border-accent/20 text-sm resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted">{draft.length}/1500</span>
                <button
                  onClick={submit}
                  disabled={submitting || !draft.trim()}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <><Send className="size-4" /> Gửi</>}
                </button>
              </div>
              {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={onLogin}
          className="mb-8 w-full p-4 rounded-2xl bg-surface border border-accent/10 hover:border-primary/40 transition flex items-center justify-center gap-2 text-sm font-bold text-muted hover:text-primary"
        >
          <LogIn className="size-4" /> Đăng nhập để bình luận
        </button>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-10 text-muted text-sm">
          Chưa có bình luận nào. Anh là người đầu tiên 🚀
        </div>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3 p-4 rounded-2xl bg-surface border border-accent/10">
              <img
                src={c.userAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.userName || 'u')}`}
                alt=""
                className="size-10 rounded-full shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-sm truncate">{c.userName || 'Khuyết danh'}</span>
                    <span className="text-[10px] text-muted">{timeAgo(c.createdAt)}</span>
                  </div>
                  {user && c.userId === user.uid && (
                    <button
                      onClick={() => remove(c.id)}
                      className="text-muted hover:text-red-400 transition"
                      aria-label="Xoá"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-text-main/90 whitespace-pre-wrap break-words">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
