import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const modalRef = React.useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

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
          <h2 id="welcome-title" className="text-2xl font-bold mb-2">Welcome to DefScribe AI!</h2>
          <p className="text-slate-300 mb-6">Your advanced dictation and transcription assistant.</p>
        </div>

        <div className="space-y-4 mb-8">
          <FeatureCard icon="fa-microphone-alt" title="Real-Time Transcription">
            Simply press "Start Listening" and see your speech transcribed instantly with high accuracy.
          </FeatureCard>
          <FeatureCard icon="fa-brain" title="AI-Powered Analytics">
            After recording, get AI-generated summaries, action items, key topics, and detailed speech statistics.
          </FeatureCard>
          <FeatureCard icon="fa-globe" title="Multilingual Transcription">
            Use the "Spoken Language" setting to transcribe in multiple languages, with auto-detection and live translation capabilities.
          </FeatureCard>
        </div>

        <div className="text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
