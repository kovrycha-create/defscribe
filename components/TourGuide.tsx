import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { type TourStep } from '../hooks/useTour';

interface TourGuideProps {
  step: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onEnd: () => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ step, currentStepIndex, totalSteps, onNext, onPrev, onEnd }) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const targetElement = document.querySelector<HTMLElement>(step.selector);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);
      
      // Don't scroll if element is already fully in view
      const isInView = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );
      if (!isInView) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    } else {
        setTargetRect(null);
        console.warn(`Tour step element not found: ${step.selector}`);
    }
    
    const handleResize = () => {
        const el = document.querySelector<HTMLElement>(step.selector);
        if (el) {
            setTargetRect(el.getBoundingClientRect());
        } else {
            setTargetRect(null);
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [step]);

  const getTooltipPosition = (): React.CSSProperties => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const style: React.CSSProperties = { visibility: 'visible' };
    const offset = 12; // Space between tooltip and element
    const tooltipWidth = 288; // w-72
    const tooltipHeight = 160; // Approximate height

    // Default to bottom and centered
    let top = targetRect.bottom + offset;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    
    // Adjust horizontal position to stay in viewport
    if (left < offset) left = offset;
    if (left + tooltipWidth > window.innerWidth - offset) {
      left = window.innerWidth - tooltipWidth - offset;
    }

    // Adjust vertical position if not enough space at the bottom
    if (top + tooltipHeight > window.innerHeight - offset) {
      top = targetRect.top - offset - tooltipHeight;
    }

    // If still not enough space (e.g., small screen), center it
    if (top < offset) {
      top = window.innerHeight / 2 - tooltipHeight / 2;
    }

    style.top = `${top}px`;
    style.left = `${left}px`;
    
    return style;
  };
  
  const PADDING = 8;
  const overlayPath = targetRect 
    ? `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z M${targetRect.left - PADDING},${targetRect.top - PADDING} V${targetRect.bottom + PADDING} H${targetRect.right + PADDING} V${targetRect.top - PADDING} Z`
    : `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z`;

  return createPortal(
    <div className="fixed inset-0 z-[500]">
      <svg className="fixed inset-0 w-full h-full" style={{ fill: 'rgba(0, 0, 0, 0.6)' }}>
        <path d={overlayPath} fillRule="evenodd" className="tour-overlay-path" />
      </svg>
      <div
        className="fixed z-[501] cosmo-panel w-72 rounded-lg p-4 shadow-2xl transition-all duration-300 animate-[fadeIn_0.3s_ease-out]"
        style={{...getTooltipPosition(), visibility: targetRect ? 'visible' : 'hidden'}}
      >
        <h3 className="font-bold text-lg mb-2 text-white">{step.title}</h3>
        <p className="text-sm text-slate-300 mb-4">{step.content}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-semibold">{currentStepIndex + 1} / {totalSteps}</span>
          <div className="flex items-center gap-2">
            <button onClick={onEnd} className="text-xs text-slate-400 hover:text-white transition-colors">Skip Tour</button>
            {currentStepIndex > 0 && <button onClick={onPrev} className="cosmo-button px-3 py-1 text-sm rounded-md">Back</button>}
            <button onClick={onNext} className="px-3 py-1 text-sm rounded-md bg-[var(--color-primary)] text-black font-semibold">
              {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TourGuide;
