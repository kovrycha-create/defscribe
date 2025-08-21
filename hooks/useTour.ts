import { useState, useEffect, useCallback } from 'react';

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'start',
    selector: '[data-tour-id="start-button"]',
    title: 'Start/Stop Listening',
    content: 'This is your main control. Press it to start transcribing your voice in real-time. Press it again to stop.',
    placement: 'bottom',
  },
  {
    id: 'transcript',
    selector: '[data-tour-id="transcript-panel"]',
    title: 'The Transcript Panel',
    content: "Your live transcription and audio visualizer appear here. You can also find controls for search, timestamps, and font size.",
    placement: 'right',
  },
  {
    id: 'analytics',
    selector: '[data-tour-id="analytics-panel"]',
    title: 'AI-Powered Analytics',
    content: 'After you stop a recording, this panel fills with powerful insights like summaries, action items, and speech statistics.',
    placement: 'left',
  },
  {
    id: 'summary',
    selector: '[data-tour-id="summary-buttons"]',
    title: 'Generate Summaries',
    content: 'Choose from different styles to get a concise summary of your entire transcript, powered by Gemini AI.',
    placement: 'left',
  },
  {
    id: 'open-settings',
    selector: '[data-tour-id="settings-toggle"]',
    title: 'Advanced Settings',
    content: "Let's open up the settings panel to see more options.",
    placement: 'top',
  },
  {
    id: 'language',
    selector: '[data-tour-id="language-select"]',
    title: 'Language Selection',
    content: 'Choose the language you will be speaking for the most accurate transcription. You can also select a language for on-demand translation.',
    placement: 'top',
  },
  {
    id: 'diarization',
    selector: '[data-tour-id="diarization-toggle"]',
    title: 'Speaker Detection (Diarization)',
    content: 'When enabled, DefScribe will automatically identify and label different speakers in the conversation.',
    placement: 'top',
  },
  {
    id: 'theme',
    selector: '[data-tour-id="theme-picker"]',
    title: 'Customize Your Look',
    content: 'Personalize your experience by choosing from a variety of themes, or create your own custom color scheme!',
    placement: 'top',
  },
  {
    id: 'close-settings',
    selector: '[data-tour-id="settings-toggle"]',
    title: "That's All for Settings",
    content: 'You can collapse this panel to get more screen space.',
    placement: 'top',
  },
  {
    id: 'immersive',
    selector: '[data-tour-id="immersive-button"]',
    title: 'Immersive Mode',
    content: 'Enter a distraction-free view with a large transcript display and a reactive AI avatar. Perfect for focused work or presentations.',
    placement: 'top',
  },
  {
    id: 'export',
    selector: '[data-tour-id="export-button"]',
    title: 'Export & Share',
    content: 'When you are finished, you can export your transcript and all associated analytics in various formats, including PDF and Markdown.',
    placement: 'top',
  },
];

export const useTour = ({ onStepChange }: { onStepChange?: (step: TourStep) => void }) => {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsTourActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsTourActive(false);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      endTour();
    }
  }, [currentStepIndex, endTour]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < TOUR_STEPS.length) {
      setCurrentStepIndex(index);
    }
  }, []);
  
  const currentStep = isTourActive ? TOUR_STEPS[currentStepIndex] : null;

  useEffect(() => {
    if (currentStep && isTourActive) {
      onStepChange?.(currentStep);
    }
  }, [currentStep, onStepChange, isTourActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTourActive) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        endTour();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTourActive, nextStep, prevStep, endTour]);

  return {
    isTourActive,
    currentStep,
    currentStepIndex,
    totalSteps: TOUR_STEPS.length,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
  };
};
