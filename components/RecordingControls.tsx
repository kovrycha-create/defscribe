import React, { useRef, useState, useEffect } from 'react';
import Tooltip from './Tooltip';

interface RecordingControlsProps {
  onStart: () => void;
  isRecordingEnabled: boolean;
  onToggle: () => void;
  onFileUpload: (file: File) => void;
  isTranscribingFile: boolean;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({ onStart, isRecordingEnabled, onToggle, onFileUpload, isTranscribingFile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const newIsCompact = entry.contentRect.width < 360;
        if (newIsCompact !== isCompact) {
          setIsCompact(newIsCompact);
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [isCompact]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    if(e.target) e.target.value = '';
  };

  return (
    <div ref={containerRef} className="flex items-center justify-center gap-3 w-full animate-[fadeIn_0.3s_ease-out]">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="audio/*,video/*" hidden />
      
      <button
        onClick={onStart}
        disabled={isTranscribingFile}
        className="cosmo-button h-10 px-6 font-semibold flex items-center gap-2 flex-1 justify-center"
      >
        <i className="fas fa-play"></i>
        <span className="whitespace-nowrap">{isCompact ? 'Record' : 'Start Recording'}</span>
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isTranscribingFile}
        className="cosmo-button h-10 px-6 font-semibold flex items-center gap-2 flex-1 justify-center"
      >
        {isTranscribingFile ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            <span className="whitespace-nowrap">Processing...</span>
          </>
        ) : (
          <>
            <i className="fas fa-upload"></i>
            <span className="whitespace-nowrap">{isCompact ? 'Upload' : 'Upload File'}</span>
          </>
        )}
      </button>

      <Tooltip content={isRecordingEnabled ? "Audio Recording On (Live)" : "Audio Recording Off (Live)"}>
        <button
          onClick={onToggle}
          className={`h-10 w-10 cosmo-button flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${!isRecordingEnabled ? 'bg-red-500/30 border-red-500/50 text-red-400' : ''}`}
          aria-pressed={isRecordingEnabled}
        >
          <i className={`fas ${isRecordingEnabled ? 'fa-microphone' : 'fa-microphone-slash'} text-lg`}></i>
        </button>
      </Tooltip>
    </div>
  );
};

export default RecordingControls;