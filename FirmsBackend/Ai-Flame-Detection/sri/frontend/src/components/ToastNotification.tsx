import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  ShieldAlert 
} from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'warning' | 'info' | 'error';
  timestamp?: number;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const renderIcon = () => {
          switch (toast.type) {
            case 'success':
              return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
            case 'warning':
              return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
            case 'error':
              return <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />;
            default:
              return <Info className="w-4 h-4 text-sky-500 shrink-0" />;
          }
        };

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xl flex items-start gap-2.5 animate-in slide-in-from-bottom-2 duration-150 text-xs text-zinc-800 dark:text-zinc-200"
          >
            {renderIcon()}

            <div className="flex-1 min-w-0">
              <h5 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                {toast.title}
              </h5>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-0.5 cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
