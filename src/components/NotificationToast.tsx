import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'SUCCESS' | 'WARNING' | 'INFO';
  title: string;
  message?: string;
  timestamp: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div 
      id="toast-notification-container" 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded shadow-xl border text-xs font-mono-tech transition-all animate-in fade-in duration-200 ${
            toast.type === 'SUCCESS'
              ? 'bg-[#091410] border-emerald-600/70 text-emerald-200'
              : toast.type === 'WARNING'
              ? 'bg-[#181106] border-amber-600/70 text-amber-200'
              : 'bg-[#0a111e] border-sky-600/70 text-sky-200'
          }`}
        >
          {toast.type === 'SUCCESS' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
          {toast.type === 'WARNING' && <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
          {toast.type === 'INFO' && <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />}

          <div className="flex-1">
            <div className="font-semibold">{toast.title}</div>
            {toast.message && <div className="text-[11px] opacity-85 mt-0.5">{toast.message}</div>}
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="text-slate-400 hover:text-slate-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
