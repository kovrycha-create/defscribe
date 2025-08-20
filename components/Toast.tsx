
import React, { useEffect, useState, useRef } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'processing';

export interface ToastMessage {
  id: number;
  title: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}

const DURATION_MS = 3000; // 3 seconds
const EXIT_ANIMATION_MS = 500; // Matches `duration-500` in Tailwind class

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const typeClasses: Record<ToastType, { icon: string; iconColor: string; progress: string; shadow: string; borderColor: string; }> = {
    info: { icon: 'fa-info-circle', iconColor: 'text-[var(--color-primary)]', progress: 'bg-[var(--color-primary)]', shadow: 'shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.5)]', borderColor: 'border-[var(--color-primary)]/30' },
    success: { icon: 'fa-check-circle', iconColor: 'text-green-500', progress: 'bg-green-500', shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.5)]', borderColor: 'border-green-500/30' },
    warning: { icon: 'fa-exclamation-triangle', iconColor: 'text-amber-400', progress: 'bg-amber-400', shadow: 'shadow-[0_0_15px_rgba(251,191,36,0.5)]', borderColor: 'border-amber-400/30' },
    error: { icon: 'fa-exclamation-circle', iconColor: 'text-red-500', progress: 'bg-red-500', shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]', borderColor: 'border-red-500/30' },
    processing: { icon: 'fa-spinner fa-spin', iconColor: 'text-sky-400', progress: 'bg-sky-400', shadow: 'shadow-[0_0_15px_rgba(56,189,248,0.5)]', borderColor: 'border-sky-400/30' },
  };

  // Timer to start the exit animation. Runs only once.
  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, DURATION_MS);

    return () => clearTimeout(exitTimer);
  }, []);

  // When exiting, call dismiss after the animation finishes.
  useEffect(() => {
    if (isExiting) {
      const dismissTimer = setTimeout(() => {
        onDismissRef.current(toast.id);
      }, EXIT_ANIMATION_MS);

      return () => clearTimeout(dismissTimer);
    }
  }, [isExiting, toast.id]);
  
  const handleManualDismiss = () => {
      setIsExiting(true);
  };

  return (
    <div
      className={`relative w-full max-w-xs sm:max-w-sm overflow-hidden rounded-xl bg-slate-800/80 backdrop-blur-md border ${typeClasses[toast.type].borderColor} shadow-2xl transition-all duration-500 ease-out
        ${typeClasses[toast.type].shadow}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
      role="alert"
    >
      <div className="p-3 sm:p-4 flex items-start gap-3 sm:gap-4">
        <i className={`fas ${typeClasses[toast.type].icon} ${typeClasses[toast.type].iconColor} text-xl sm:text-2xl mt-1 animate-[bubble-pop-in_0.5s_ease-out]`}></i>
        <div className="flex-1">
          <h3 className="font-bold text-sm sm:text-base text-white">{toast.title}</h3>
          <p className="text-xs sm:text-sm text-slate-300">{toast.message}</p>
        </div>
      </div>
      
      <button 
        onClick={handleManualDismiss} 
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        aria-label="Close notification"
      >
        <i className="fas fa-times text-sm"></i>
      </button>
      
      <div 
        className={`absolute bottom-0 left-0 h-1 ${typeClasses[toast.type].progress}`} 
        style={{ animation: `progress ${DURATION_MS}ms linear forwards` }}
      ></div>
    </div>
  );
};

export default Toast;
