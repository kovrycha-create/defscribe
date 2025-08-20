

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useAppSettings from './hooks/useAppSettings';
import useTranscript from './hooks/useTranscript';
import useAnalytics from './hooks/useAnalytics';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useMediaQuery } from './hooks/useMediaQuery';

import ControlPanel from './components/panels/ControlPanel';
import MainContentPanel from './components/panels/MainContentPanel';
import AnalyticsPanel from './components/panels/AnalyticsPanel';
import WelcomeModal from './components/WelcomeModal';

import Toast, { type ToastMessage, type ToastType } from './components/Toast';
import ImmersiveMode from './components/ImmersiveMode';
import TranscriptChat from './components/TranscriptChat';
import ExportModal from './components/ExportModal';
import { AVATAR_EMOTIONS } from './constants';
import CosmicBackground from './components/CosmicBackground';
import BottomNav from './components/BottomNav';
import ViewSwitcher from './components/ViewSwitcher';

const MAX_TOASTS = 5;
const LARGE_VISUALIZER_HEIGHT = 280;
const SMALL_VISUALIZER_HEIGHT = 120;

const getInitialVisualizerHeight = () => {
  // Default to smaller visualizer on mobile
  return window.innerWidth < 768 ? SMALL_VISUALIZER_HEIGHT : LARGE_VISUALIZER_HEIGHT;
};

type MobileTab = 'controls' | 'transcript' | 'analytics';


interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'bg-red-600 text-white hover:bg-red-700',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
    >
      <div
        ref={modalRef}
        className="cosmo-panel rounded-xl shadow-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mx-auto mb-4 text-2xl">
                <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h2 id="confirmation-title" className="text-xl font-bold mb-2">{title}</h2>
            <p className="text-slate-300 mb-6">{message}</p>
        </div>
        <div className="flex justify-center gap-4">
          <button onClick={onClose} className="px-6 py-2 rounded-lg cosmo-button font-semibold">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [isStartButtonGlowing, setIsStartButtonGlowing] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [visualizerHeight, setVisualizerHeight] = useState(getInitialVisualizerHeight);
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);
  
  const {
    themeId, themeColors, setThemeId,
    customThemeColors, setCustomThemeColors,
    diarizationSettings, setDiarizationSettings,
    showTimestamps, setShowTimestamps,
    translationLanguage, setTranslationLanguage,
    spokenLanguage, setSpokenLanguage,
    liveTranslationEnabled, setLiveTranslationEnabled,
    isRecordingEnabled, setIsRecordingEnabled,
    leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout,
    transcriptTextSize, setTranscriptTextSize,
    statCardOrder, setStatCardOrder,
    viewModeOverride, setViewModeOverride,
  } = useAppSettings();

  const isSystemMobile = useMediaQuery('(max-width: 767px)');
  const isMobileView = viewModeOverride === 'mobile' || (isSystemMobile && viewModeOverride !== 'desktop');

  useEffect(() => {
    // Adjust visualizer height when view mode changes
    setVisualizerHeight(isMobileView ? SMALL_VISUALIZER_HEIGHT : LARGE_VISUALIZER_HEIGHT);
  }, [isMobileView]);
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((title: string, message: string, type: ToastType) => {
    setToasts((prev) => {
      const newToast = { id: Date.now(), title, message, type };
      const updated = [...prev, newToast];
      return updated.slice(-MAX_TOASTS);
    });
  }, []);
  
  const handleCloseWelcomeModal = () => {
    setIsWelcomeModalOpen(false);
    // After a short delay (for modal fade-out), start glowing the button
    setTimeout(() => {
        setIsStartButtonGlowing(true);
        // Turn off the glow state after the animation finishes (5s)
        setTimeout(() => {
            setIsStartButtonGlowing(false);
        }, 5000); // Animation is 2.5s and runs twice
    }, 500); // Delay after modal closes
  };

  useEffect(() => {
    const hasVisited = localStorage.getItem('defscribe-has-visited');
    if (!hasVisited) {
      setIsWelcomeModalOpen(true);
      localStorage.setItem('defscribe-has-visited', 'true');
    }
  }, []);
  
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const { isListening, transcript, finalTranscript, error, startListening, stopListening, clearTranscript, confidence, isCloudMode, stream, audioBlobUrl, deleteAudio, recordingDuration } = useSpeechRecognition({
    spokenLanguage,
    addToast,
    isRecordingEnabled,
  });
  
  useEffect(() => { if (error) { addToast('System Info', error, 'info'); } }, [error, addToast]);

  const {
    transcriptEntries,
    activeSpeaker,
    speakerProfiles,
    clearTranscriptEntries,
    startTimeRef,
    segments,
    handleUpdateSpeakerLabel,
    handleReassignSpeakerForEntry,
    handleTranslateEntry,
  } = useTranscript({
      finalTranscript,
      diarizationSettings,
      addToast,
      liveTranslationEnabled,
      translationLanguage,
      isCloudMode,
      stream,
  });

  const {
    summary, summaryStyle,
    actionItems, snippets, topics,
    isAnalyzing, isSummarizing,
    avatarEmotion,
    speechAnalytics,
    generateAllAnalytics,
    handleSummarize,
    clearAnalytics,
  } = useAnalytics({
      addToast,
      transcriptEntries,
      startTime: startTimeRef.current,
      segments,
      isListening,
      interimTranscript: transcript,
  });

  const [isImmersive, setIsImmersive] = useState(false);
  const [isImmersiveButtonGlowing, setIsImmersiveButtonGlowing] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('transcript');
  const fullTranscriptText = transcriptEntries.map(e => (speakerProfiles[e.speakerIds?.[0] || '']?.label || e.speakerIds?.[0] || 'Speaker') + ': ' + e.text).join('\n');

  useEffect(() => {
    const initialGlowTimeout = setTimeout(() => setIsImmersiveButtonGlowing(false), 6000);
    return () => clearTimeout(initialGlowTimeout);
  }, []);

  const handleStart = () => {
    startListening();
    setSessionActive(true);
  };

  const handleStop = async () => {
    stopListening();
    addToast('Listening Stopped', 'Recording has been paused.', 'info');
    if (fullTranscriptText.trim().length > 10) {
      generateAllAnalytics(fullTranscriptText, speakerProfiles);
    }
  };

  const clearSessionAction = useCallback(() => {
    stopListening();
    clearTranscript();
    clearTranscriptEntries();
    clearAnalytics();
    setSessionActive(false);
    setHighlightedTopic(null);
  }, [stopListening, clearTranscript, clearTranscriptEntries, clearAnalytics]);

  const handleConfirmClear = () => {
      clearSessionAction();
      addToast('Cleared', 'The session has been cleared.', 'info');
      setIsClearConfirmOpen(false);
  };

  const handleClear = useCallback(() => {
    const fullTranscriptText = transcriptEntries.map(e => e.text).join('');
    if (fullTranscriptText.trim().length === 0 && !audioBlobUrl) {
      clearSessionAction();
      return;
    }
    setIsClearConfirmOpen(true);
  }, [transcriptEntries, clearSessionAction, audioBlobUrl]);

  const handleResetLayout = () => {
    resetLayout();
    setVisualizerHeight(getInitialVisualizerHeight());
  };


  const shortcutsForTooltip = [
    { key: ' ', description: 'Toggle recording' },
    { key: 'm', ctrl: true, description: 'Toggle Audio Recording' },
    { key: 'i', ctrl: true, description: 'Toggle immersive mode' },
    { key: 'c', ctrl: true, shift: true, description: 'Clear session' },
    { key: '/', ctrl: true, description: 'Toggle chat' },
    { key: 'f', description: 'Toggle fullscreen (Immersive)'},
    { key: 'm', description: 'Toggle menu (Immersive)'},
    { key: 'Escape', description: 'Close modals / Exit immersive' }
  ];

  useKeyboardNavigation([
    { key: ' ', handler: () => isListening ? handleStop() : handleStart(), description: 'Toggle recording' },
    { key: 'm', ctrl: true, handler: () => setIsRecordingEnabled(!isRecordingEnabled), description: 'Toggle audio recording' },
    { key: 'i', ctrl: true, handler: () => setIsImmersive(!isImmersive), description: 'Toggle immersive mode' },
    { key: 'c', ctrl: true, shift: true, handler: handleClear, description: 'Clear session' },
    { key: '/', ctrl: true, handler: () => setIsChatOpen(!isChatOpen), description: 'Toggle chat' },
  ], !isImmersive);
  
  if (isImmersive) {
    return (
      <ErrorBoundary>
        <ImmersiveMode
          isListening={isListening}
          transcriptEntries={transcriptEntries}
          interimTranscript={transcript}
          stream={stream}
          themeColors={themeColors}
          onExit={() => setIsImmersive(false)}
          onToggleListen={isListening ? handleStop : handleStart}
          avatarEmotion={avatarEmotion}
          avatarMap={AVATAR_EMOTIONS}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <CosmicBackground />
      <WelcomeModal isOpen={isWelcomeModalOpen} onClose={handleCloseWelcomeModal} />
      <ConfirmationModal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={handleConfirmClear}
        title="Confirm Clear Session"
        message="Are you sure you want to permanently clear the entire session? This action cannot be undone."
        confirmText="Clear Session"
      />

      <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-3">
        {!isSystemMobile && (
          <ViewSwitcher
            viewModeOverride={viewModeOverride}
            setViewModeOverride={setViewModeOverride}
          />
        )}
      </div>

      <div className={`fixed ${activeMobileTab === 'controls' ? 'bottom-20' : 'top-20'} right-4 z-[100] w-full max-w-sm space-y-2`}>
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />)}
      </div>
      
      {isChatOpen && <TranscriptChat transcript={fullTranscriptText} onClose={() => setIsChatOpen(false)} translationLanguage={translationLanguage} />}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        transcriptEntries={transcriptEntries}
        speakerProfiles={speakerProfiles}
        speechAnalytics={speechAnalytics}
        diarizationSettings={diarizationSettings}
        confidence={confidence}
        summary={summary}
        actionItems={actionItems}
        snippets={snippets}
        topics={topics}
      />
      
      <div className="h-screen text-slate-200 flex flex-col">
        <main
          className={`flex-1 min-h-0 z-20 ${isMobileView ? 'flex flex-col' : 'grid p-4 gap-4'}`}
          style={!isMobileView ? { gridTemplateColumns: `minmax(0, ${leftPanelWidth}px) 5px minmax(0, 1fr) 5px minmax(0, ${rightPanelWidth}px)`, gridTemplateRows: 'minmax(0, 1fr)' } : {}}
        >
          <div className={`${isMobileView ? (activeMobileTab === 'controls' ? 'block' : 'hidden') : 'block'} h-full`}>
            <ControlPanel
              isListening={isListening}
              isAnalyzing={isAnalyzing}
              isSummarizing={isSummarizing}
              wpm={speechAnalytics.wpm || 0}
              confidence={confidence}
              finalTranscript={fullTranscriptText}
              onStart={handleStart}
              onStop={handleStop}
              onClear={handleClear}
              onGoImmersive={() => setIsImmersive(true)}
              isImmersiveButtonGlowing={isImmersiveButtonGlowing}
              isStartButtonGlowing={isStartButtonGlowing}
              themeId={themeId}
              setThemeId={setThemeId}
              customThemeColors={customThemeColors}
              setCustomThemeColors={setCustomThemeColors}
              diarizationSettings={diarizationSettings}
              setDiarizationSettings={setDiarizationSettings}
              translationLanguage={translationLanguage}
              setTranslationLanguage={setTranslationLanguage}
              spokenLanguage={spokenLanguage}
              setSpokenLanguage={setSpokenLanguage}
              liveTranslationEnabled={liveTranslationEnabled}
              setLiveTranslationEnabled={setLiveTranslationEnabled}
              onResetLayout={handleResetLayout}
              onExport={() => setIsExportModalOpen(true)}
              sessionActive={sessionActive}
              shortcuts={shortcutsForTooltip}
            />
          </div>
          <div
            className={`w-[5px] h-full cursor-col-resize bg-slate-700/50 hover:bg-[var(--color-primary)] transition-colors duration-200 ${isMobileView ? 'hidden' : 'block'}`}
            onMouseDown={() => handleMouseDown('left')}
          />
          <div className={`${isMobileView ? (activeMobileTab === 'transcript' ? 'block' : 'hidden') : 'block'} h-full min-w-0`}>
            <MainContentPanel
              isListening={isListening}
              stream={stream}
              themeColors={themeColors}
              transcriptEntries={transcriptEntries}
              liveText={transcript}
              liveTextState={'visible'}
              activeSpeaker={activeSpeaker}
              speakerProfiles={speakerProfiles}
              handleUpdateSpeakerLabel={handleUpdateSpeakerLabel}
              showTimestamps={showTimestamps}
              setShowTimestamps={setShowTimestamps}
              diarizationEnabled={diarizationSettings.enabled}
              onOpenChat={() => setIsChatOpen(true)}
              onTranslateEntry={(entryId) => handleTranslateEntry(entryId, translationLanguage)}
              onReassignSpeaker={handleReassignSpeakerForEntry}
              transcriptTextSize={transcriptTextSize}
              setTranscriptTextSize={setTranscriptTextSize}
              visualizerHeight={visualizerHeight}
              setVisualizerHeight={setVisualizerHeight}
              highlightedTopic={highlightedTopic}
              audioBlobUrl={audioBlobUrl}
              onDeleteAudio={deleteAudio}
              recordingDuration={recordingDuration}
              onStop={handleStop}
              onStart={handleStart}
              isRecordingEnabled={isRecordingEnabled}
              setIsRecordingEnabled={setIsRecordingEnabled}
            />
          </div>
          <div
            className={`w-[5px] h-full cursor-col-resize bg-slate-700/50 hover:bg-[var(--color-primary)] transition-colors duration-200 ${isMobileView ? 'hidden' : 'block'}`}
            onMouseDown={() => handleMouseDown('right')}
          />
          <div className={`${isMobileView ? (activeMobileTab === 'analytics' ? 'block' : 'hidden') : 'block'} h-full`}>
            <AnalyticsPanel
                isSummarizing={isSummarizing}
                summary={summary}
                summaryStyle={summaryStyle}
                onSummarize={(style) => handleSummarize(fullTranscriptText, style)}
                actionItems={actionItems}
                snippets={snippets}
                topics={topics}
                isAnalyzing={isAnalyzing}
                speechAnalytics={speechAnalytics}
                speakerProfiles={speakerProfiles}
                transcriptEntries={transcriptEntries}
                highlightedTopic={highlightedTopic}
                onSetHighlightedTopic={setHighlightedTopic}
                statCardOrder={statCardOrder}
                setStatCardOrder={setStatCardOrder}
            />
          </div>
        </main>
        {isMobileView && <BottomNav
            activeTab={activeMobileTab}
            onTabChange={setActiveMobileTab}
            actionItemsCount={actionItems.length}
            snippetsCount={snippets.length}
        />}
      </div>
    </ErrorBoundary>
  );
};

export default App;