
import React from 'react';
import Tooltip from './Tooltip';

interface RecordingControlsProps {
  onStart: () => void;
  isRecordingEnabled: boolean;
  onToggle: () => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({ onStart, isRecordingEnabled, onToggle }) => {
  return (
    <div className="flex items-center justify-center gap-3 w-full animate-[fadeIn_0.3s_ease-out]">
      <button
        onClick={onStart}
        className="cosmo-button h-10 px-6 font-semibold flex items-center gap-2"
      >
        <i className="fas fa-microphone"></i>
        <span>Start Recording</span>
      </button>
      <Tooltip content={isRecordingEnabled ? "Disable Audio Recording" : "Enable Audio Recording"}>
        <button
          onClick={onToggle}
          className={`h-10 w-10 cosmo-button flex items-center justify-center rounded-lg transition-colors ${!isRecordingEnabled ? 'bg-red-500/30 border-red-500/50 text-red-400' : ''}`}
          aria-pressed={isRecordingEnabled}
        >
          <i className={`fas ${isRecordingEnabled ? 'fa-microphone' : 'fa-microphone-slash'} text-lg`}></i>
        </button>
      </Tooltip>
    </div>
  );
};

export default RecordingControls;
