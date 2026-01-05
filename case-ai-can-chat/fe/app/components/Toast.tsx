'use client';

import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
  type?: 'success' | 'error' | 'info';
}

export default function Toast({ message, onClose, duration = 3000, type = 'error' }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Define styles based on type
  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      icon: <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />,
      text: 'text-green-800',
      button: 'border-green-300 hover:bg-green-50 text-green-600',
      progressBg: 'bg-green-100',
      progressBar: 'bg-green-500',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      icon: <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
      text: 'text-red-800',
      button: 'border-red-300 hover:bg-red-50 text-red-600',
      progressBg: 'bg-red-100',
      progressBar: 'bg-red-500',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      icon: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
      text: 'text-blue-800',
      button: 'border-blue-300 hover:bg-blue-50 text-blue-600',
      progressBg: 'bg-blue-100',
      progressBar: 'bg-blue-500',
    },
  };

  const currentStyle = styles[type];

  return (
    <div className="animate-slide-in-right">
      <div className={`${currentStyle.bg} border-l-4 ${currentStyle.border} rounded-lg shadow-2xl overflow-hidden max-w-md`}>
        <div className="p-4 flex items-center space-x-3">
          {currentStyle.icon}
          <p className={`text-sm ${currentStyle.text} flex-1`}>{message}</p>
          <button
            onClick={onClose}
            className={`p-1.5 border ${currentStyle.button} rounded transition-colors flex-shrink-0`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Progress bar */}
        <div className={`h-1 ${currentStyle.progressBg}`}>
          <div 
            className={`h-full ${currentStyle.progressBar} animate-progress-bar`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

