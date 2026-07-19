import { AlertCircle, X } from 'lucide-react';
import { Novel } from '../types';

interface AutoBotImportProps {
  user: unknown;
  novels: Novel[];
  onClose: () => void;
}

export default function AutoBotImport({ onClose }: AutoBotImportProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface rounded-[28px] shadow-2xl p-8 border border-accent/10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500">
              <AlertCircle className="size-6" />
            </div>
            <div>
              <h2 className="font-black text-xl text-text-main">Import AI tạm khóa</h2>
              <p className="text-xs text-muted font-bold uppercase tracking-widest">P0 security hardening</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted hover:text-text-main bg-background-light rounded-full">
            <X className="size-5" />
          </button>
        </div>

        <p className="text-sm leading-6 text-muted">
          Import AI đang được chuyển sang server-side để bảo mật. Tính năng này sẽ được mở lại sau khi dữ liệu upload
          đi qua API admin có Firebase ID token và nội dung tạo ra được lưu vào Draft/Needs Review.
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full py-4 bg-primary text-white rounded-full font-black text-sm uppercase tracking-widest shadow-xl hover:opacity-90 transition-all"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
