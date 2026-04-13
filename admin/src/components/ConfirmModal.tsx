import React from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  danger?: boolean;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading,
  danger = true,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-bg-card border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${danger ? 'bg-error/10' : 'bg-warning/10'}`}>
          <ExclamationTriangleIcon className={`w-6 h-6 ${danger ? 'text-error' : 'text-warning'}`} />
        </div>

        <h3 className="text-lg font-bold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
              danger
                ? 'bg-error hover:bg-error/80 text-white'
                : 'bg-warning hover:bg-warning/80 text-bg-deep'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
