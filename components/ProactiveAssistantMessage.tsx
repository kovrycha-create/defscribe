import React, { useState, useEffect } from 'react';
import { type ProactiveMessage } from '../types';

interface ProactiveAssistantMessageProps {
  message: ProactiveMessage;
  onDismiss: () => void;
}

const ProactiveAssistantMessage: React.FC<ProactiveAssistantMessageProps> = ({ message, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true); // Trigger fade-in on new message

    const visibilityTimer = setTimeout(() => {
      setIsVisible(false); // Start fade-out
    }, 8000); // Message stays visible for 8 seconds

    const dismissTimer = setTimeout(() => {
      onDismiss();
    }, 8500); // Dismiss after fade-out animation (500ms)

    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(dismissTimer);
    };
  }, [message.id, onDismiss]);

  return (
    <div
      className={`absolute top-4 left-4 z-20 max-w-xs p-3 transition-all duration-500 ease-out transform-gpu
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'}
      `}
      role="status"
      aria-live="polite"
    >
      <div className="relative p-3 rounded-lg bg-slate-900/50 backdrop-blur-md border border-purple-400/30 shadow-lg animate-[pulse-glow_4s_ease-in-out_infinite]"
        style={{ '--color': 'rgba(var(--color-secondary-rgb), 0.4)' } as React.CSSProperties}
      >
        <p className="text-sm text-purple-200 flex items-start">
          <span className="flex-shrink-0 flex items-center mr-2 pt-0.5">
            <span className="font-bold text-purple-300">✦</span>
          </span>
          <span className="flex-1 italic">{message.text}</span>
        </p>
      </div>
    </div>
  );
};

export default ProactiveAssistantMessage;