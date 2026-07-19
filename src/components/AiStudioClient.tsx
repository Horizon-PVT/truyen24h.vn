/**
 * Admin AI Studio.
 *
 * AI output is saved as operator drafts and requires owner review before
 * anything can reach public novels/chapters.
 */
'use client';

import { useState } from 'react';
import { Sparkles, Loader2, BookPlus, Zap, Rocket, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { buildCoverUrl } from '@/services/aiCoverService';
import { getAdminAuthHeaders } from '@/lib/adminClientAuth';

interface TrendingTopic {
  topic: string;
  reasoning: string;
  suggestedGenres: string[];
}

interface GeneratedNovel {
  title: string;
  author: string;
  description: string;
  genres: string[];
  status: string;
  hook: string;
  tags: string[];
  coverPrompt: string;
}

type Toast = { kind: 'ok' | 'err'; text: string };

export default function AiStudioClient() {
  const { isAdminUser } = useAuth();
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [novel, setNovel] = useState<GeneratedNovel | null>(null);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dailySummary, setDailySummary] = useState<Record<string, unknown> | null>(null);

  function flash(kind: Toast['kind'], text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 5000);
  }

  async function callApi(path: string, body: Record<string, unknown>) {
    const authHeaders = await getAdminAuthHeaders();
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function brainstorm() {
    setBusy('topics');
    try {
      const data = await callApi('/api/ai/generate-novel', { autoTopic: true });
      if (data.topic) {
        setTopics([{ topic: data.topic, reasoning: data.topicReasoning || '', suggestedGenres: data.novel?.genres || [] }]);
        setNovel(data.novel);
        setSelectedTopic(data.topic);
      }
      flash('ok', 'Đã sinh ý tưởng + outline.');
    } catch (error) {
      flash('err', getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function generateFromTopic() {
    if (!selectedTopic) return flash('err', 'Nhập 1 topic trước.');
    setBusy('novel');
    try {
      const data = await callApi('/api/ai/generate-novel', { topic: selectedTopic });
      setNovel(data.novel);
      flash('ok', 'Đã tạo outline truyện.');
    } catch (error) {
      flash('err', getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function createDrafts() {
    if (!novel) return;
    setBusy('draft');
    try {
      const slug = slugifyDraft(novel.title);
      const storyDraft = await callApi('/api/operator/drafts', {
        type: 'story',
        title: novel.title,
        slug,
        content: novel.description,
        summary: novel.hook,
        source: 'ai_studio',
        targetCollection: 'novels',
        targetDocId: slug,
        aiAssisted: true,
        metadata: {
          author: novel.author,
          genres: novel.genres,
          tags: novel.tags,
          coverPrompt: novel.coverPrompt,
          coverUrl: buildCoverUrl(novel.coverPrompt),
          status: novel.status,
        },
      });

      let previousSummary = '';
      for (const chapterNumber of [1, 2]) {
        const generated = await callApi('/api/ai/generate-chapter', {
          novelTitle: novel.title,
          novelDescription: novel.description,
          genres: novel.genres,
          chapterNumber,
          previousSummary,
          targetWordCount: 1700,
        });
        previousSummary = generated.chapter.cliffhanger;
        await callApi('/api/operator/drafts', {
          type: 'chapter',
          title: generated.chapter.title,
          content: generated.chapter.content,
          summary: generated.chapter.cliffhanger,
          source: 'ai_studio',
          targetCollection: 'novels/{id}/chapters',
          targetParentId: slug,
          targetDocId: `c${chapterNumber}`,
          aiAssisted: true,
          metadata: {
            chapterNumber,
            isVip: false,
            price: 0,
            wordCount: generated.chapter.wordCount,
            parentDraftId: storyDraft.draftId,
          },
        });
      }

      flash('ok', 'Đã tạo draft, cần duyệt trước khi xuất bản.');
      setNovel(null);
      setSelectedTopic('');
    } catch (error) {
      flash('err', getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function runDailyJob() {
    if (!confirm('Chạy daily pipeline tạo draft? Nội dung sẽ nằm ở Needs Review, không publish.')) return;
    setBusy('daily');
    setDailySummary(null);
    try {
      const data = await callApi('/api/admin/daily-run', { newNovels: 1, continueNovels: 3 });
      setDailySummary(data);
      flash('ok', `Đã tạo ${data.totals?.newNovels || 0} draft truyện và ${data.totals?.continuedChapters || 0} draft chương.`);
    } catch (error) {
      flash('err', getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  if (!isAdminUser) {
    return (
      <div className="p-12 rounded-2xl bg-surface border border-accent/20 text-center">
        <AlertCircle className="size-12 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold mb-2">Cần quyền Admin</h2>
        <p className="text-muted">Bạn cần đăng nhập tài khoản admin để dùng AI Studio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Sparkles className="text-primary" /> AI Studio
          </h1>
          <p className="text-muted text-sm mt-1">Sinh nội dung bằng AI và lưu vào Draft/Needs Review.</p>
        </div>
        <button
          onClick={runDailyJob}
          disabled={!!busy}
          className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {busy === 'daily' ? <Loader2 className="animate-spin size-5" /> : <Rocket className="size-5" />}
          Chạy Daily Draft
        </button>
      </div>

      {toast && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          toast.kind === 'ok' ? 'bg-green-500/10 text-green-400 border border-green-500/30'
            : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          {toast.kind === 'ok' ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
          <span className="text-sm">{toast.text}</span>
        </div>
      )}

      <section className="p-6 rounded-2xl bg-surface border border-accent/10">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Zap className="size-4 text-yellow-500" /> Bước 1 - Topic</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            value={selectedTopic}
            onChange={(event) => setSelectedTopic(event.target.value)}
            placeholder="vd: Cô vợ phế vật trùng sinh báo thù chồng cũ"
            className="flex-1 min-w-[280px] px-4 py-3 bg-background rounded-xl border border-accent/20 text-sm"
          />
          <button onClick={brainstorm} disabled={!!busy}
            className="px-4 py-3 bg-yellow-500/10 text-yellow-500 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {busy === 'topics' ? <Loader2 className="animate-spin size-4" /> : <RefreshCw className="size-4" />}
            Gợi ý hot từ trend
          </button>
          <button onClick={generateFromTopic} disabled={!!busy || !selectedTopic}
            className="px-4 py-3 bg-primary/10 text-primary rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {busy === 'novel' ? <Loader2 className="animate-spin size-4" /> : <Sparkles className="size-4" />}
            Sinh outline
          </button>
        </div>
        {topics.length > 0 && (
          <div className="mt-4 text-xs text-muted bg-background/40 rounded-lg p-3">
            <strong>Lý do hot:</strong> {topics[0].reasoning}
          </div>
        )}
      </section>

      {novel && (
        <section className="p-6 rounded-2xl bg-surface border border-primary/30">
          <h2 className="font-bold mb-4 flex items-center gap-2"><BookPlus className="size-4 text-primary" /> Bước 2 - Outline & Draft</h2>
          <div className="grid md:grid-cols-[180px_1fr] gap-4">
            <div>
              <img
                src={buildCoverUrl(novel.coverPrompt)}
                alt={`Bìa ${novel.title}`}
                className="w-full aspect-[2/3] rounded-xl object-cover border border-accent/10 bg-background"
                loading="lazy"
              />
              <p className="text-[10px] text-muted mt-2 text-center">Cover AI - Pollinations</p>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div><span className="text-muted">Tiêu đề:</span> <span className="font-bold">{novel.title}</span></div>
              <div><span className="text-muted">Tác giả:</span> {novel.author}</div>
              <div><span className="text-muted">Mô tả:</span> {novel.description}</div>
              <div><span className="text-muted">Thể loại:</span> {novel.genres.join(', ')}</div>
              <div><span className="text-muted">Hook social:</span> {novel.hook}</div>
              <div><span className="text-muted">SEO tags:</span> {novel.tags.join(' · ')}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createDrafts} disabled={!!busy}
              className="px-5 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50">
              {busy === 'draft' ? <Loader2 className="animate-spin size-4" /> : <CheckCircle2 className="size-4" />}
              Tạo draft + 2 chương đầu
            </button>
            <button onClick={() => setNovel(null)} className="px-5 py-3 bg-background border border-accent/20 rounded-xl text-sm">
              Bỏ
            </button>
          </div>
        </section>
      )}

      {dailySummary && (
        <section className="p-6 rounded-2xl bg-surface border border-green-500/30">
          <h2 className="font-bold mb-3">Daily draft summary</h2>
          <pre className="text-xs mt-2 p-3 bg-background/40 rounded overflow-auto max-h-80">{JSON.stringify(dailySummary, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}

function slugifyDraft(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Có lỗi không xác định.';
}
