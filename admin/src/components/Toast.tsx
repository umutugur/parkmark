import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const iconMap = {
    success: <CheckCircleIcon className="w-5 h-5 text-success" />,
    error: <XCircleIcon className="w-5 h-5 text-error" />,
    warning: <ExclamationTriangleIcon className="w-5 h-5 text-warning" />,
  };

  const bgMap = {
    success: 'border-success/30',
    error: 'border-error/30',
    warning: 'border-warning/30',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 bg-bg-card border ${bgMap[toast.type]} rounded-xl px-4 py-3 shadow-xl animate-in slide-in-from-right-4`}
          >
            {iconMap[toast.type]}
            <p className="text-sm text-text-primary flex-1">{toast.message}</p>
            <button
              onClick={() => remove(toast.id)}
              className="text-text-secondary hover:text-text-primary flex-shrink-0"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
