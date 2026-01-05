'use client';

import { AlertCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg flex items-center justify-center ${isDangerous ? 'bg-red-100' : 'bg-gray-100'}`}>
              <AlertCircle className={`w-6 h-6 ${isDangerous ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 border border-gray-300 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-6 pt-0">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg font-bold transition-all duration-200 ${
              isDangerous
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gradient-to-r from-health-gradient-start to-health-gradient-end text-white hover:shadow-lg'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

