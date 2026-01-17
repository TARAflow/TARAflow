import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// ==================== TYPES ====================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

// ==================== TOAST CONFIGURATION ====================

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-600'
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-600'
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-600'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600'
  }
};

// ==================== TOAST COMPONENT ====================

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = TOAST_CONFIG[type];
  const Icon = config.icon;

  return (
    <div
      className={`
        fixed top-4 right-4 z-50
        flex items-start gap-3 p-4 rounded-lg shadow-lg border
        ${config.bgColor} ${config.borderColor}
        animate-slide-in max-w-md
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />
      <div className={`flex-1 text-sm ${config.textColor}`}>
        {message}
      </div>
      <button
        onClick={onClose}
        className={`flex-shrink-0 p-1 hover:bg-white/50 rounded ${config.textColor}`}
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ==================== TOAST CONTAINER ====================

export interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
  }>;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};

// ==================== TOAST HOOK ====================

export interface ToastState {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = React.useState<ToastState[]>([]);

  const showToast = (
    message: string,
    type: ToastType = "info",
    duration: number = 3000
  ) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (message: string, duration?: number) =>
    showToast(message, "success", duration ?? 3000);
  const error = (message: string, duration?: number) =>
    showToast(message, "error", duration ?? 3000);
  const warning = (message: string, duration?: number) =>
    showToast(message, "warning", duration ?? 3000);
  const info = (message: string, duration?: number) =>
    showToast(message, "info", duration ?? 3000);

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
};

// ==================== STYLES ====================

export const toastAnimationStyles = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
`;