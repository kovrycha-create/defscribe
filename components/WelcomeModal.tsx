import React, { useState, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
  isTrueMobile: boolean;
}

const FeatureCard: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-start gap-4">
    <div className="w-10 h-10 bg-[var(--color-primary)]/20 rounded-lg flex items-center justify-center text-[var(--color-primary)] text-xl flex-shrink-0">
      <i className={`fas ${icon}`}></i>
    </div>
    <div>
      <h3 className="font-bold text-white">{title}</h3>
      <p className="text-sm text-slate-300">{children}</p>
    </div>
  </div>
);

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, onStartTour, isTrueMobile }) => {
  const modalRef = React.useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isOpen && countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.3s_ease-out]">
      <div
        ref={modalRef}
        className="cosmo-panel rounded-xl shadow-2xl p-6 w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <div className="text-center">
          <h2 id="welcome-title" className="text-2xl font-bold mb-2">Unlock the Power of Your Voice</h2>
          {isTrueMobile ? (
            <p className="text-slate-300 mb-6">DefScribe AI: Record, transcribe, and analyze your speech instantly. Tap Start Listening to begin.</p>
          ) : (
            <p className="text-slate-300 mb-6">Welcome to DefScribe AI, your personal assistant for capturing every word and idea.</p>
          )}
        </div>

        {!isTrueMobile && (
          <div className="space-y-4 mb-8">
            <FeatureCard icon="fa-microphone-alt" title="Flawless Real-Time Transcription">
              Capture your thoughts, meetings, and notes with lightning-fast, highly accurate voice-to-text. Just press 'Start Listening' and let the magic happen.
            </FeatureCard>
            <FeatureCard icon="fa-brain" title="Powerful AI Insights">
              Go beyond simple transcription. DefScribe analyzes your conversations to generate concise summaries, extract actionable tasks, identify key topics, and provide detailed speech analytics.
            </FeatureCard>
            <FeatureCard icon="fa-globe" title="Global Language Support">
              Choose from a wide range of supported languages in the Settings panel for accurate transcription. Live translation features are also available to bridge communication gaps.
            </FeatureCard>
          </div>
        )}

        <div className="text-center space-y-3">
          {!isTrueMobile && (
            <button
              onClick={onStartTour}
              className="w-full px-6 py-2 rounded-lg bg-[var(--color-accent)] text-black font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <i className="fas fa-route"></i>
              Start Guided Tour
            </button>
          )}
          <button
            onClick={onClose}
            disabled={countdown > 0}
            className="w-full px-6 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold transition-all duration-300 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed enabled:hover:opacity-90"
          >
            {countdown > 0 ? `Let's Get Started (${countdown})` : "Let's Get Started"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;