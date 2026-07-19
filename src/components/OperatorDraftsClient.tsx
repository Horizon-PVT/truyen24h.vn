'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminAuthHeaders } from '@/lib/adminClientAuth';
import {
  Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw,
  FileText, Check, X, AlertTriangle, ArrowRight, ShieldCheck,
  Undo2, BarChart2, Eye, HelpCircle, CornerDownRight
} from 'lucide-react';

interface QualityReport {
  passed: boolean;
  score: number;
  warnings: string[];
  blockers: string[];
}

interface OperatorDraft {
  id: string;
  type: 'story' | 'chapter' | 'blog';
  title: string;
  slug?: string;
  content: string;
  summary?: string;
  source: string;
  status: 'DRAFT' | 'NEEDS_FIX' | 'NEEDS_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  qualityReport?: QualityReport;
  targetCollection?: string;
  targetParentId?: string | null;
  targetDocId?: string | null;
  lastPublishLogId?: string;
  metadata?: Record<string, any>;
}

interface ReportMetrics {
  totalDrafts: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  averageQualityScore: number;
  totalBlockers: number;
  totalWarnings: number;
  reviewsCount: number;
  publishCount: number;
  rollbackCount: number;
}

export default function OperatorDraftsClient() {
  const { isAdminUser } = useAuth();
  const [drafts, setDrafts] = useState<OperatorDraft[]>([]);
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  
  // Selected draft for detail view
  const [selectedDraft, setSelectedDraft] = useState<OperatorDraft | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');

  useEffect(() => {
    if (isAdminUser) {
      loadData();
    }
  }, [isAdminUser]);

  async function loadData() {
    setLoading(true);
    setLoadingMetrics(true);
    try {
      const headers = await getAdminAuthHeaders();
      
      // Fetch drafts
      const rDrafts = await fetch('/api/operator/drafts', { headers });
      const dData = await rDrafts.json();
      if (rDrafts.ok && dData.ok) {
        setDrafts(dData.drafts || []);
      } else {
        showToast('err', dData.error || 'Không thể tải danh sách drafts');
      }

      // Fetch metrics
      const rMetrics = await fetch('/api/operator/report', { headers });
      const mData = await rMetrics.json();
      if (rMetrics.ok && mData.ok) {
        setMetrics(mData.metrics);
      } else {
        showToast('err', mData.error || 'Không thể tải báo cáo vận hành');
      }
    } catch (e: any) {
      showToast('err', e.message || 'Lỗi mạng hoặc xác thực');
    } finally {
      setLoading(false);
      setLoadingMetrics(false);
    }
  }

  function showToast(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 6000);
  }

  async function handleApprove(draftId: string) {
    if (busy) return;
    setBusy('approve-' + draftId);
    try {
      const headers = await getAdminAuthHeaders();
      const r = await fetch('/api/operator/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ draftId, action: 'approve' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Duyệt thất bại');
      
      showToast('ok', 'Đã duyệt APPROVED draft thành công!');
      // Update local state
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, status: 'APPROVED' } : d));
      if (selectedDraft?.id === draftId) {
        setSelectedDraft(prev => prev ? { ...prev, status: 'APPROVED' } : null);
      }
      // Reload metrics in background
      reloadMetrics();
    } catch (e: any) {
      showToast('err', e.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(null);
    }
  }

  async function handleRejectOrNeedsFix(draftId: string, action: 'reject' | 'needs_fix') {
    if (busy) return;
    if (!reviewNote.trim()) {
      showToast('err', 'Vui lòng điền ghi chú lý do trước khi từ chối hoặc yêu cầu sửa.');
      return;
    }
    
    setBusy(`${action}-${draftId}`);
    try {
      const headers = await getAdminAuthHeaders();
      const r = await fetch('/api/operator/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ draftId, action, note: reviewNote.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Thực hiện thất bại');
      
      const newStatus = action === 'reject' ? 'REJECTED' : 'NEEDS_FIX';
      showToast('ok', action === 'reject' ? 'Đã từ chối draft' : 'Đã chuyển trạng thái cần sửa');
      
      // Update local state
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, status: newStatus } : d));
      if (selectedDraft?.id === draftId) {
        setSelectedDraft(prev => prev ? { ...prev, status: newStatus } : null);
      }
      setReviewNote('');
      reloadMetrics();
    } catch (e: any) {
      showToast('err', e.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(null);
    }
  }

  async function handlePublish(draft: OperatorDraft) {
    if (busy) return;
    if (draft.type === 'chapter' && !draft.targetParentId) {
      showToast('err', 'Không thể xuất bản: Chapter này thiếu targetParentId (Novel cha).');
      return;
    }

    if (!confirm('Cảnh báo Publish: Nội dung sẽ xuất hiện công khai nếu query public cho phép. Bạn có chắc chắn muốn xuất bản?')) {
      return;
    }

    const draftId = draft.id;
    setBusy('publish-' + draftId);
    try {
      const headers = await getAdminAuthHeaders();
      const r = await fetch('/api/operator/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ draftId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Xuất bản thất bại');
      
      showToast('ok', `Xuất bản thành công thực thể ${data.type}!`);
      // Update local state
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, status: 'PUBLISHED', lastPublishLogId: data.publishLogId } : d));
      if (selectedDraft?.id === draftId) {
        setSelectedDraft(prev => prev ? { ...prev, status: 'PUBLISHED', lastPublishLogId: data.publishLogId } : null);
      }
      reloadMetrics();
    } catch (e: any) {
      showToast('err', e.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(null);
    }
  }

  async function handleRollback(draft: OperatorDraft) {
    const publishLogId = draft.lastPublishLogId;
    if (!publishLogId) {
      showToast('err', 'Không tìm thấy ID log xuất bản để rollback.');
      return;
    }

    if (!confirm('Cảnh báo Rollback: Nội dung sẽ được ẩn mềm, không xoá dữ liệu. Bạn có chắc chắn muốn tiếp tục?')) {
      return;
    }

    setBusy('rollback-' + draft.id);
    try {
      const headers = await getAdminAuthHeaders();
      const r = await fetch('/api/operator/rollback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ publishLogId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Rollback thất bại');
      
      showToast('ok', 'Đã thu hồi nội dung xuất bản và khôi phục draft thành APPROVED.');
      // Update local state
      setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'APPROVED' } : d));
      if (selectedDraft?.id === draft.id) {
        setSelectedDraft(prev => prev ? { ...prev, status: 'APPROVED' } : null);
      }
      reloadMetrics();
    } catch (e: any) {
      showToast('err', e.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(null);
    }
  }

  async function reloadMetrics() {
    try {
      const headers = await getAdminAuthHeaders();
      const rMetrics = await fetch('/api/operator/report', { headers });
      const mData = await rMetrics.json();
      if (rMetrics.ok && mData.ok) {
        setMetrics(mData.metrics);
      }
    } catch (e) {
      console.error('Lỗi khi tải lại metrics', e);
    }
  }

  const filteredDrafts = useMemo(() => {
    return drafts.filter(d => {
      const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
      const matchType = typeFilter === 'ALL' || d.type === typeFilter;
      return matchStatus && matchType;
    });
  }, [drafts, statusFilter, typeFilter]);

  if (!isAdminUser) {
    return (
      <div className="p-12 rounded-2xl bg-surface border border-accent/20 text-center">
        <AlertCircle className="size-12 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold mb-2">Cần quyền Admin</h2>
        <p className="text-muted">Bạn cần đăng nhập tài khoản admin để truy cập Operator Draft Queue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <ShieldCheck className="text-primary size-8" /> Operator Draft Queue
          </h1>
          <p className="text-muted text-sm mt-1">
            Duyệt & xuất bản an toàn các nội dung AI (Truyện, Chương, Blog) trước khi đưa lên production.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-surface hover:bg-accent/10 border border-accent/20 rounded-xl font-bold text-xs flex items-center gap-2 transition"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Tải lại dữ liệu
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`p-4 rounded-xl flex items-center gap-3 transition-all ${
          toast.kind === 'ok' ? 'bg-green-500/10 text-green-400 border border-green-500/30'
          : 'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>
          {toast.kind === 'ok' ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
          <span className="text-sm font-semibold">{toast.text}</span>
        </div>
      )}

      {/* Metrics Banner */}
      {!loadingMetrics && metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl bg-surface border border-accent/10 flex flex-col justify-between">
            <span className="text-xs text-muted font-bold uppercase tracking-wider">Tổng số Draft</span>
            <span className="text-3xl font-black mt-2 text-text-main">{metrics.totalDrafts}</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-accent/10 flex flex-col justify-between">
            <span className="text-xs text-muted font-bold uppercase tracking-wider">Chờ Duyệt</span>
            <span className="text-3xl font-black mt-2 text-yellow-500">
              {metrics.byStatus.NEEDS_REVIEW || 0}
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-accent/10 flex flex-col justify-between">
            <span className="text-xs text-muted font-bold uppercase tracking-wider">Đã Duyệt</span>
            <span className="text-3xl font-black mt-2 text-green-500">
              {metrics.byStatus.APPROVED || 0}
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-accent/10 flex flex-col justify-between">
            <span className="text-xs text-muted font-bold uppercase tracking-wider">Điểm TB</span>
            <span className="text-3xl font-black mt-2 text-primary">
              {metrics.averageQualityScore}/100
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-accent/10 flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-xs text-muted font-bold uppercase tracking-wider">Tổng Blockers</span>
            <span className="text-3xl font-black mt-2 text-red-500">{metrics.totalBlockers}</span>
          </div>
        </div>
      )}

      {/* Main layout: Table & Side Preview */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left column: List & Filters */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filters card */}
          <div className="p-4 bg-surface rounded-2xl border border-accent/10 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {/* Type filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted">Loại</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-background border border-accent/20 rounded-xl px-3 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">Tất cả loại</option>
                  <option value="story">Story (Truyện)</option>
                  <option value="chapter">Chapter (Chương)</option>
                  <option value="blog">Blog (Review)</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted">Trạng thái</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-background border border-accent/20 rounded-xl px-3 py-1.5 text-xs font-bold"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                  <option value="NEEDS_FIX">NEEDS_FIX</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>

            <span className="text-xs text-muted font-semibold">
              Hiển thị {filteredDrafts.length} dòng
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-12 text-center bg-surface border border-accent/10 rounded-2xl">
              <Loader2 className="animate-spin mx-auto size-8 text-primary" />
              <p className="text-xs text-muted mt-2">Đang tải danh sách drafts...</p>
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="p-12 text-center bg-surface border border-accent/10 rounded-2xl">
              <HelpCircle className="mx-auto size-8 text-muted mb-2" />
              <p className="text-sm font-semibold text-muted">Không tìm thấy draft nào phù hợp.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-accent/10 overflow-hidden bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-background-light text-xs uppercase tracking-wider text-muted border-b border-accent/10">
                    <tr>
                      <th className="p-4">Nội dung</th>
                      <th className="p-4 w-28 text-center">Chất lượng</th>
                      <th className="p-4 w-28 text-center">Trạng thái</th>
                      <th className="p-4 w-20 text-center">Xem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrafts.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedDraft(d)}
                        className={`border-b border-accent/5 cursor-pointer hover:bg-accent/5 transition ${
                          selectedDraft?.id === d.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="font-bold line-clamp-1">{d.title}</div>
                          <div className="text-[10px] text-muted flex gap-2 items-center mt-1 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-background uppercase font-bold text-primary">
                              {d.type}
                            </span>
                            <span>Source: <code className="text-text-main">{d.source}</code></span>
                            <span>•</span>
                            <span>{new Date(d.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {d.qualityReport ? (
                            <div className="flex flex-col items-center">
                              <span className={`text-xs font-black ${
                                d.qualityReport.passed ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {d.qualityReport.score}/100
                              </span>
                              <div className="flex gap-1.5 mt-0.5">
                                {d.qualityReport.blockers.length > 0 && (
                                  <span className="text-[9px] bg-red-500/10 text-red-400 px-1 rounded font-bold">
                                    {d.qualityReport.blockers.length} B
                                  </span>
                                )}
                                {d.qualityReport.warnings.length > 0 && (
                                  <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1 rounded font-bold">
                                    {d.qualityReport.warnings.length} W
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-[10px] font-black uppercase ${
                            d.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-500'
                            : d.status === 'APPROVED' ? 'bg-blue-500/15 text-blue-400'
                            : d.status === 'NEEDS_FIX' ? 'bg-orange-500/15 text-orange-400'
                            : d.status === 'REJECTED' ? 'bg-red-500/15 text-red-500'
                            : 'bg-muted/15 text-muted'
                          }`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <Eye className="size-4 mx-auto text-muted hover:text-primary transition" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Preview & Actions Panel */}
        <div className="lg:col-span-5">
          {selectedDraft ? (
            <div className="p-6 bg-surface rounded-2xl border border-accent/10 space-y-6 sticky top-24 max-h-[85vh] overflow-y-auto">
              {/* Preview Header */}
              <div className="flex justify-between items-start gap-2 border-b border-accent/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs font-bold uppercase">
                      {selectedDraft.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      selectedDraft.status === 'PUBLISHED' ? 'bg-green-500/20 text-green-400'
                      : selectedDraft.status === 'APPROVED' ? 'bg-blue-500/20 text-blue-400'
                      : selectedDraft.status === 'NEEDS_FIX' ? 'bg-orange-500/20 text-orange-400'
                      : selectedDraft.status === 'REJECTED' ? 'bg-red-500/20 text-red-400'
                      : 'bg-muted/20 text-muted'
                    }`}>
                      {selectedDraft.status}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold mt-2 text-text-main">{selectedDraft.title}</h2>
                  <p className="text-xs text-muted mt-1">ID: <code>{selectedDraft.id}</code></p>
                </div>
                <button
                  onClick={() => setSelectedDraft(null)}
                  className="p-1.5 bg-background border border-accent/20 rounded-lg text-muted hover:text-text-main transition"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Quality Report Section */}
              {selectedDraft.qualityReport && (
                <div className="p-4 bg-background rounded-xl border border-accent/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-muted flex items-center gap-1.5">
                      <Sparkles className="size-4 text-yellow-500" /> Báo cáo kiểm định chất lượng
                    </span>
                    <span className={`text-sm font-black ${
                      selectedDraft.qualityReport.passed ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {selectedDraft.qualityReport.score}/100
                    </span>
                  </div>

                  {/* Blockers & Warnings */}
                  {selectedDraft.qualityReport.blockers.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Blockers ({selectedDraft.qualityReport.blockers.length})
                      </div>
                      <ul className="text-xs text-red-400 pl-4 list-disc space-y-0.5">
                        {selectedDraft.qualityReport.blockers.map((b, idx) => (
                          <li key={idx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedDraft.qualityReport.warnings.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-yellow-500 font-bold uppercase flex items-center gap-1">
                        <AlertTriangle className="size-3" /> Cảnh báo ({selectedDraft.qualityReport.warnings.length})
                      </div>
                      <ul className="text-xs text-yellow-600 pl-4 list-disc space-y-0.5">
                        {selectedDraft.qualityReport.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedDraft.qualityReport.blockers.length === 0 && selectedDraft.qualityReport.warnings.length === 0 && (
                    <p className="text-xs text-green-500 font-medium">Báo cáo sạch! Không phát hiện lỗi hay cảnh báo nào.</p>
                  )}
                </div>
              )}

              {/* Actions Section */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-muted">Hành động của Owner</span>
                
                {/* Status-based actions */}
                <div className="flex gap-2 flex-wrap">
                  {/* Needs FIX & Reject requires note */}
                  {(selectedDraft.status === 'NEEDS_REVIEW' || selectedDraft.status === 'DRAFT' || selectedDraft.status === 'NEEDS_FIX') && (
                    <>
                      <button
                        onClick={() => handleApprove(selectedDraft.id)}
                        disabled={!!busy}
                        className="flex-1 min-w-[120px] px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      >
                        {busy === 'approve-' + selectedDraft.id ? <Loader2 className="animate-spin size-3.5" /> : <Check className="size-3.5" />}
                        Phê duyệt (Approve)
                      </button>
                    </>
                  )}

                  {selectedDraft.status === 'APPROVED' && (
                    <div className="w-full space-y-2">
                      {selectedDraft.type === 'chapter' && !selectedDraft.targetParentId && (
                        <p className="text-xs text-red-500 font-bold bg-red-500/15 p-2 rounded-lg">
                          ⚠️ Chapter thiếu Novel cha (targetParentId). Không thể xuất bản!
                        </p>
                      )}
                      <button
                        onClick={() => handlePublish(selectedDraft)}
                        disabled={!!busy || (selectedDraft.type === 'chapter' && !selectedDraft.targetParentId)}
                        className="w-full px-4 py-3 bg-primary hover:opacity-90 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      >
                        {busy === 'publish-' + selectedDraft.id ? <Loader2 className="animate-spin size-4" /> : <ArrowRight className="size-4" />}
                        Xuất bản ngay (Publish)
                      </button>
                      <p className="text-[10px] text-muted text-center">
                        Cảnh báo: Nội dung sẽ xuất hiện công khai nếu query public cho phép.
                      </p>
                    </div>
                  )}

                  {selectedDraft.status === 'PUBLISHED' && (
                    <div className="w-full space-y-2">
                      <button
                        onClick={() => handleRollback(selectedDraft)}
                        disabled={!!busy || !selectedDraft.lastPublishLogId}
                        className="w-full px-4 py-3 bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      >
                        {busy === 'rollback-' + selectedDraft.id ? <Loader2 className="animate-spin size-4" /> : <Undo2 className="size-4" />}
                        Thu hồi (Rollback MVP)
                      </button>
                      <p className="text-[10px] text-red-400 text-center">
                        Cảnh báo: Nội dung sẽ được ẩn mềm, không xoá dữ liệu.
                      </p>
                    </div>
                  )}
                </div>

                {/* Reject / Needs Fix Box */}
                {(selectedDraft.status === 'NEEDS_REVIEW' || selectedDraft.status === 'DRAFT' || selectedDraft.status === 'NEEDS_FIX' || selectedDraft.status === 'APPROVED') && (
                  <div className="space-y-2 pt-2 border-t border-accent/10">
                    <span className="text-[10px] text-muted font-bold uppercase">Ghi chú & Lý do (Bắt buộc cho Từ chối / Yêu cầu sửa)</span>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Nội dung cần chỉnh sửa, lí do từ chối..."
                      rows={3}
                      className="w-full p-3 bg-background border border-accent/20 rounded-xl text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectOrNeedsFix(selectedDraft.id, 'needs_fix')}
                        disabled={!!busy}
                        className="flex-1 px-3 py-2 bg-orange-600/10 text-orange-400 hover:bg-orange-600/20 border border-orange-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition"
                      >
                        Yêu cầu sửa (Needs Fix)
                      </button>
                      <button
                        onClick={() => handleRejectOrNeedsFix(selectedDraft.id, 'reject')}
                        disabled={!!busy}
                        className="flex-1 px-3 py-2 bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition"
                      >
                        Từ chối (Reject)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Draft Content & Metadata Preview */}
              <div className="space-y-4 pt-4 border-t border-accent/10">
                <span className="text-xs font-bold text-muted flex items-center gap-1">
                  <FileText className="size-4" /> Chi tiết nội dung nháp
                </span>

                {/* targetCollection detail */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-background border border-accent/5 rounded-lg">
                    <div className="text-[10px] text-muted">Target Collection</div>
                    <div className="font-semibold text-text-main mt-0.5">{selectedDraft.targetCollection}</div>
                  </div>
                  {selectedDraft.targetParentId && (
                    <div className="p-2 bg-background border border-accent/5 rounded-lg">
                      <div className="text-[10px] text-muted">Parent ID (Novel)</div>
                      <div className="font-semibold text-text-main mt-0.5">{selectedDraft.targetParentId}</div>
                    </div>
                  )}
                </div>

                {/* Metadata variables if present */}
                {selectedDraft.metadata && Object.keys(selectedDraft.metadata).length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted uppercase">Metadata</span>
                    <div className="p-3 bg-background border border-accent/10 rounded-xl text-xs overflow-x-auto font-mono max-h-40">
                      {Object.entries(selectedDraft.metadata).map(([key, val]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-primary font-bold">{key}:</span>
                          <span className="text-muted truncate">{JSON.stringify(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedDraft.summary && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted uppercase">Tóm tắt / Mô tả</span>
                    <p className="text-xs text-muted bg-background-light p-3 rounded-xl border border-accent/5 italic">
                      {selectedDraft.summary}
                    </p>
                  </div>
                )}

                {/* Main Content Preview */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted uppercase">Nội dung (Bản xem trước)</span>
                  <div className="p-4 bg-background border border-accent/10 rounded-xl text-xs overflow-y-auto max-h-96 whitespace-pre-wrap leading-relaxed select-text font-serif">
                    {selectedDraft.content}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-surface border border-accent/10 rounded-2xl sticky top-24">
              <Eye className="mx-auto size-12 text-muted mb-4 animate-pulse-slow" />
              <h3 className="font-bold text-lg mb-1">Bản xem trước Draft</h3>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Chọn một dòng nháp ở bảng bên trái để xem đầy đủ nội dung, kết quả kiểm định chất lượng và các thao tác xuất bản/thu hồi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
