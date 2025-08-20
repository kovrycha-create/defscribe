import React, { useState, useRef, useEffect } from 'react';
import Visualizer from '../Visualizer';
import TranscriptDisplay from '../TranscriptDisplay';
import Tooltip from '../Tooltip';
import SpeakerEditorModal from '../SpeakerEditorModal';
import AudioPlayer from '../AudioPlayer';
import RecordingControls from '../RecordingControls';
import { type TranscriptEntry, type SpeakerId, type SpeakerProfile } from '../../types';

interface MainContentPanelProps {
  isListening: boolean;
  stream: MediaStream | null;
  themeColors: { primary: string; secondary: string; accent: string; };
  transcriptEntries: TranscriptEntry[];
  liveText: string;
  liveTextState: 'visible' | 'fading-out' | 'hidden';
  activeSpeaker: SpeakerId | null;
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
  handleUpdateSpeakerLabel: (speakerId: SpeakerId, newLabel: string) => void;
  showTimestamps: boolean;
  diarizationEnabled: boolean;
  onOpenChat: () => void;
  onTranslateEntry: (entryId: string) => void;
  onReassignSpeaker: (entryId: string, newSpeakerId: SpeakerId) => void;
  transcriptTextSize: 'sm' | 'base' | 'lg' | 'xl';
  setTranscriptTextSize: (size: 'sm' | 'base' | 'lg' | 'xl') => void;
  visualizerHeight: number;
  setVisualizerHeight: React.Dispatch<React.SetStateAction<number>>;
  highlightedTopic: string | null;
  audioBlobUrl: string | null;
  onDeleteAudio: () => void;
  recordingDuration: number;
  onStop: () => void;
  onStart: () => void;
  isRecordingEnabled: boolean;
  setIsRecordingEnabled: (enabled: boolean) => void;
}

const MainContentPanel: React.FC<MainContentPanelProps> = ({
  isListening, stream, themeColors, transcriptEntries, liveText, liveTextState,
  activeSpeaker, speakerProfiles, handleUpdateSpeakerLabel, showTimestamps, diarizationEnabled, onOpenChat,
  onTranslateEntry, onReassignSpeaker, transcriptTextSize, setTranscriptTextSize,
  visualizerHeight, setVisualizerHeight, highlightedTopic, audioBlobUrl, onDeleteAudio,
  recordingDuration, onStop, onStart, isRecordingEnabled, setIsRecordingEnabled,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSpeaker, setEditingSpeaker] = useState<SpeakerProfile | null>(null);

  const [autoScroll, setAutoScroll] = useState(true);
  const [newContentSinceScroll, setNewContentSinceScroll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTranscriptLength = useRef(0);

  const textSizeLabels = { sm: 'Small', base: 'Medium', lg: 'Large', xl: 'X-Large' };
  const nextTextSizeLabel = { sm: 'Medium', base: 'Large', lg: 'X-Large', xl: 'Small' };

  const SMALL_VISUALIZER_HEIGHT = 120;
  const LARGE_VISUALIZER_HEIGHT = 280;
  const visualizerContainerRef = useRef<HTMLDivElement>(null);

  const handleVisualizerResizeToggle = () => {
    setVisualizerHeight(currentHeight => 
      currentHeight === LARGE_VISUALIZER_HEIGHT ? SMALL_VISUALIZER_HEIGHT : LARGE_VISUALIZER_HEIGHT
    );
  };

  const cycleTextSize = () => {
    const sizes: ('sm' | 'base' | 'lg' | 'xl')[] = ['sm', 'base', 'lg', 'xl'];
    const currentIndex = sizes.indexOf(transcriptTextSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setTranscriptTextSize(sizes[nextIndex]);
  };

  useEffect(() => {
    const newContentCount = transcriptEntries.length + (liveText ? 1 : 0);
    const hasNewContent = newContentCount > lastTranscriptLength.current;

    if (hasNewContent) {
      if (autoScroll) {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
        setNewContentSinceScroll(false);
      } else {
        setNewContentSinceScroll(true);
      }
    }
    lastTranscriptLength.current = newContentCount;
  }, [transcriptEntries, liveText, autoScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let scrollTimeout: number;
    const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop <= clientHeight + 50;
            
            if (!isNearBottom && autoScroll) {
                setAutoScroll(false);
            } else if (isNearBottom && !autoScroll) {
                setAutoScroll(true);
            }
        }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        clearTimeout(scrollTimeout);
        container.removeEventListener('scroll', handleScroll);
    };
  }, [autoScroll]);

  const handleAutoScrollClick = () => {
    setAutoScroll(true);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSpeakerTagClick = (speakerId: SpeakerId) => {
    const profile = speakerProfiles[speakerId];
    if (profile && profile.isEditable) {
        setEditingSpeaker(profile);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full cosmo-panel md:rounded-2xl p-2 md:p-4 gap-4">
        <header className="flex flex-col sm:flex-row items-center gap-2 pb-2 border-b border-[rgba(var(--color-primary-rgb),0.2)] z-10">
            {/* Left: Search Bar */}
            <div className="relative w-full sm:w-auto flex-shrink-0">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                type="text"
                placeholder="Search transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-52 cosmo-input rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none"
                />
            </div>
            
            {/* Middle: Audio Player / Recording Controls */}
            <div className="w-full sm:flex-1 flex justify-center px-2 min-w-0">
                {isListening || audioBlobUrl ? (
                    <AudioPlayer 
                        isRecording={isListening}
                        recordingDuration={recordingDuration}
                        onStop={onStop}
                        audioUrl={audioBlobUrl} 
                        onDelete={onDeleteAudio} 
                        isRecordingEnabled={isRecordingEnabled}
                    />
                ) : (
                    <RecordingControls 
                        onStart={onStart}
                        isRecordingEnabled={isRecordingEnabled}
                        onToggle={() => setIsRecordingEnabled(!isRecordingEnabled)}
                    />
                )}
            </div>

            {/* Right: Controls */}
            <div className="flex w-full sm:w-auto items-center justify-center sm:justify-end gap-2 flex-shrink-0">
                <Tooltip content={`Change to ${nextTextSizeLabel[transcriptTextSize]} text`}>
                    <button onClick={cycleTextSize} className="h-10 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cosmo-button">
                        <i className="fas fa-text-height"></i>
                        <span className="text-xs font-semibold w-12 text-center">{textSizeLabels[transcriptTextSize]}</span>
                    </button>
                </Tooltip>
                <Tooltip content={autoScroll ? "Auto-scroll On" : "Scroll to Bottom"}>
                    <button 
                    onClick={handleAutoScrollClick} 
                    className={`h-10 w-10 flex-shrink-0 cosmo-button rounded-lg transition-all flex items-center justify-center ${autoScroll ? 'text-[var(--color-primary)]' : `text-slate-400 ${newContentSinceScroll ? 'animate-cosmic-glow' : ''}`}`}
                    >
                    <i className={`fas ${autoScroll ? 'fa-anchor' : 'fa-arrow-down'}`}></i>
                    </button>
                </Tooltip>
                <Tooltip content="Chat with Transcript">
                    <button onClick={onOpenChat} className="h-10 w-10 flex-shrink-0 cosmo-button rounded-lg transition-colors flex items-center justify-center">
                    <i className="fas fa-comments text-lg"></i>
                    </button>
                </Tooltip>
            </div>
        </header>

        <div className="z-10 relative transition-all duration-300 ease-in-out" ref={visualizerContainerRef} style={{ height: `${visualizerHeight}px` }}>
            <Visualizer isListening={isListening} stream={stream} themeColors={themeColors} height={visualizerHeight} />
        </div>
        
        <Tooltip content="Double-click to toggle size">
            <div className="visualizer-resizer-handle" onDoubleClick={handleVisualizerResizeToggle} />
        </Tooltip>

        <div className="flex-1 min-h-0 bg-slate-900/50 rounded-xl border border-[rgba(var(--color-primary-rgb),0.2)] shadow-inner z-10">
          <TranscriptDisplay
            entries={transcriptEntries}
            isListening={isListening}
            liveText={liveText}
            liveTextState={liveTextState}
            activeSpeaker={activeSpeaker}
            speakerProfiles={speakerProfiles}
            showTimestamps={showTimestamps}
            diarizationEnabled={diarizationEnabled}
            onSpeakerTagClick={handleSpeakerTagClick}
            searchQuery={searchQuery}
            highlightedTopic={highlightedTopic}
            containerRef={containerRef}
            endRef={endRef}
            onTranslateEntry={onTranslateEntry}
            onReassignSpeaker={onReassignSpeaker}
            transcriptTextSize={transcriptTextSize}
          />
        </div>
      </div>
      <SpeakerEditorModal
        isOpen={!!editingSpeaker}
        speakerProfile={editingSpeaker}
        onSave={handleUpdateSpeakerLabel}
        onClose={() => setEditingSpeaker(null)}
      />
    </>
  );
};

export default MainContentPanel;