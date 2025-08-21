

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// --- Components ---
import ControlPanel from './components/panels/ControlPanel';
import MainContentPanel from './components/panels/MainContentPanel';
import AnalyticsPanel from './components/panels/AnalyticsPanel';
import BottomNav from './components/BottomNav';
import ImmersiveMode from './components/ImmersiveMode';
import WelcomeModal from './components/WelcomeModal';
import ExportModal from './components/ExportModal';
import TranscriptChat from './components/TranscriptChat';
import Toast, { type ToastMessage, type ToastType } from './components/Toast';
import CosmicBackground from './components/CosmicBackground';
import { ErrorBoundary } from './components/ErrorBoundary';
import TourGuide from './components/TourGuide';

// --- Hooks ---
import useAppSettings from './hooks/useAppSettings';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useTranscript from './hooks/useTranscript';
import useAnalytics from './hooks/useAnalytics';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useTour } from './hooks/useTour';

// --- Types & Constants ---
import { type SummaryStyle } from './types';
import { AVATAR_EMOTIONS } from './constants';
import * as SAMPLE_DATA from './sample-data';

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
};


const App: React.FC = () => {
  // --- Primary Hooks ---
  const appSettings = useAppSettings();
  
  // --- UI & State Management ---
  const isMobileQuery = useMediaQuery('(max-width: 1023px)');
  const isTrueMobile = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      return /Mobi|Android/i.test(navigator.userAgent);
    }
    return false;
  }, []);
  const isMobileView = appSettings.viewModeOverride ? appSettings.viewModeOverride === 'mobile' : isMobileQuery;

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeMobileTab, setActiveMobileTab] = useState<'controls' | 'transcript' | 'analytics'>('transcript');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(() => {
    try { return !localStorage.getItem('defscribe-hasWelcomed'); } catch { return true; }
  });
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);
  const [visualizerHeight, setVisualizerHeight] = useState(() => isTrueMobile ? 120 : 280);
  const [showVisualizerHint, setShowVisualizerHint] = useState(false);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(true);
  const [sessionKey, setSessionKey] = useState(1);

  // --- Tour Hook & State ---
  const [tourSummary, setTourSummary] = useState(SAMPLE_DATA.SAMPLE_SUMMARIES.detailed);
  const [tourSummaryStyle, setTourSummaryStyle] = useState<SummaryStyle>('detailed');

  const { isTourActive, currentStep, startTour, endTour, nextStep, prevStep, currentStepIndex, totalSteps } = useTour({
    onStepChange: (step) => {
      if (step.id === 'summary' && isMobileView) setActiveMobileTab('analytics');
      if (step.id === 'open-settings') setIsSettingsCollapsed(false);
      if (step.id === 'close-settings') setIsSettingsCollapsed(true);
    }
  });

  // --- Core Functionality Hooks ---
  const addToast = useCallback((title: string, message: string, type: ToastType) => {
    setToasts(currentToasts => [...currentToasts.slice(-4), { id: Date.now(), title, message, type }]);
  }, []);

  const speech = useSpeechRecognition({
    spokenLanguage: appSettings.spokenLanguage,
    addToast,
    isRecordingEnabled: appSettings.isRecordingEnabled,
  });

  const transcriptManager = useTranscript({
    finalTranscript: speech.finalTranscript,
    diarizationSettings: appSettings.diarizationSettings,
    addToast,
    liveTranslationEnabled: appSettings.liveTranslationEnabled,
    translationLanguage: appSettings.translationLanguage,
    isCloudMode: speech.isCloudMode,
    stream: speech.stream,
  });

  const analytics = useAnalytics({
    addToast,
    transcriptEntries: transcriptManager.transcriptEntries,
    startTime: transcriptManager.startTimeRef.current,
    segments: transcriptManager.segments,
    isListening: speech.isListening,
    interimTranscript: speech.transcript,
    recordingDuration: speech.recordingDuration,
    isCloudMode: speech.isCloudMode,
  });

  // --- Derived State & Refs for Tour/Real Data ---
  const displayedTranscriptEntries = isTourActive ? SAMPLE_DATA.SAMPLE_TRANSCRIPT_ENTRIES : transcriptManager.transcriptEntries;
  const displayedSpeakerProfiles = isTourActive ? SAMPLE_DATA.SAMPLE_SPEAKER_PROFILES : transcriptManager.speakerProfiles;
  const displayedSpeechAnalytics = isTourActive ? SAMPLE_DATA.SAMPLE_ANALYTICS : analytics.speechAnalytics;
  const displayedSummary = isTourActive ? tourSummary : analytics.summary;
  const displayedSummaryStyle = isTourActive ? tourSummaryStyle : analytics.summaryStyle;
  const displayedActionItems = isTourActive ? SAMPLE_DATA.SAMPLE_ACTION_ITEMS : analytics.actionItems;
  const displayedSnippets = isTourActive ? SAMPLE_DATA.SAMPLE_SNIPPETS : analytics.snippets;
  const displayedTopics = isTourActive ? SAMPLE_DATA.SAMPLE_TOPICS : analytics.topics;
  const displayedAvatarEmotion = isTourActive ? 'listening' : analytics.avatarEmotion;
  const isDisplayedAnalyzing = isTourActive ? false : analytics.isAnalyzing;
  const isDisplayedSummarizing = isTourActive ? false : analytics.isSummarizing;

  const fullTranscriptText = useMemo(() => {
    return displayedTranscriptEntries.map(entry => {
        const speakerLabel = entry.speakerIds?.[0] ? displayedSpeakerProfiles[entry.speakerIds[0]]?.label || entry.speakerIds[0] : 'Unknown Speaker';
        return `${speakerLabel}: ${entry.text}`;
    }).join('\n');
  }, [displayedTranscriptEntries, displayedSpeakerProfiles]);
  
  const hasContent = transcriptManager.transcriptEntries.length > 0 || speech.finalTranscript.length > 0;
  const sessionActive = isTourActive || speech.isListening || hasContent;

  const [liveTextState, setLiveTextState] = useState<'visible' | 'fading-out' | 'hidden'>('hidden');
  const interimTranscriptRef = useRef(speech.transcript);
  interimTranscriptRef.current = speech.transcript;

  const prevIsListening = usePrevious(speech.isListening);
  const prevIsWelcomeModalOpen = usePrevious(isWelcomeModalOpen);

  useEffect(() => {
    if (prevIsWelcomeModalOpen && !isWelcomeModalOpen && !isTourActive) {
      setShowVisualizerHint(true);
    }
  }, [isWelcomeModalOpen, prevIsWelcomeModalOpen, isTourActive]);
  
  useEffect(() => {
    if (prevIsListening && !speech.isListening && fullTranscriptText.trim() && !isTourActive) {
        analytics.generateAllAnalytics(fullTranscriptText, transcriptManager.speakerProfiles);
    }
  }, [speech.isListening, prevIsListening, fullTranscriptText, transcriptManager.speakerProfiles, analytics.generateAllAnalytics, isTourActive]);

  useEffect(() => {
    let fadeTimer: number;
    if (speech.isListening) {
      if (speech.transcript) {
        setLiveTextState('visible');
      } else if (liveTextState === 'visible') {
        setLiveTextState('fading-out');
        fadeTimer = window.setTimeout(() => {
          if (!interimTranscriptRef.current) setLiveTextState('hidden');
        }, 500);
      }
    } else {
      setLiveTextState('hidden');
    }
    return () => clearTimeout(fadeTimer);
  }, [speech.transcript, speech.isListening, liveTextState]);
  
  const handleWelcomeClose = () => {
    setIsWelcomeModalOpen(false);
    try { localStorage.setItem('defscribe-hasWelcomed', 'true'); } catch {}
  };

  const handleStartTour = () => {
    handleWelcomeClose();
    setTimeout(() => {
        if (isMobileView) setActiveMobileTab('controls');
        setTourSummaryStyle('detailed');
        setTourSummary(SAMPLE_DATA.SAMPLE_SUMMARIES.detailed);
        startTour();
    }, 300);
  };

  const handleStart = () => {
    if (isTourActive) return;
    speech.startListening();
  };

  const handleStop = () => {
    if (isTourActive) return;
    speech.stopListening();
  };

  const handleClear = () => {
    if (isTourActive) return;
    speech.clearTranscript();
    transcriptManager.clearTranscriptEntries();
    analytics.clearAnalytics();
    setHighlightedTopic(null); // Reset any highlighted topic
    // If chat is open, close it so mobile users see the cleared state immediately.
    setIsChatOpen(false);
    // On mobile view, switch to the transcript tab to show the cleared state.
    if (isMobileView) {
      setActiveMobileTab('transcript');
    }
    setSessionKey(prev => prev + 1);
  };

  const handleSummarize = (style: SummaryStyle) => {
    if (isTourActive) {
      setTourSummaryStyle(style);
      setTourSummary(SAMPLE_DATA.SAMPLE_SUMMARIES[style]);
      if (isMobileView) setActiveMobileTab('analytics');
      return;
    }
    analytics.handleSummarize(fullTranscriptText, style);
    if(isMobileView) setActiveMobileTab('analytics');
  };
  
  const handleOpenChat = () => setIsChatOpen(true);
  
  const dismissToast = (id: number) => {
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  };

  const handleToggleViewMode = useCallback(() => {
    if (isMobileView) {
      appSettings.setViewModeOverride('desktop');
    } else {
      appSettings.setViewModeOverride('mobile');
    }
  }, [isMobileView, appSettings.setViewModeOverride]);
  
  const shortcuts = useMemo(() => [
    { key: ' ', ctrl: false, shift: false, handler: () => speech.isListening ? handleStop() : handleStart(), description: 'Start / Stop Listening' },
    { key: 'i', ctrl: true, shift: false, handler: () => setIsImmersiveMode(p => !p), description: 'Toggle Immersive Mode' },
    { key: 'e', ctrl: true, shift: false, handler: () => setIsExportModalOpen(true), description: 'Open Export Menu' },
    { key: 'k', ctrl: true, shift: false, handler: handleOpenChat, description: 'Chat with Transcript' },
    { key: 'Backspace', ctrl: true, shift: true, handler: handleClear, description: 'Clear Session' },
    { key: 'm', ctrl: true, shift: false, handler: () => { if (speech.isListening) { appSettings.setIsRecordingEnabled(!appSettings.isRecordingEnabled); } }, description: 'Mute/Unmute Recording' },
    { key: 'v', ctrl: true, shift: false, handler: handleToggleViewMode, description: 'Toggle Mobile/Desktop View' },
  ], [speech.isListening, handleStart, handleStop, handleClear, handleOpenChat, appSettings.isRecordingEnabled, appSettings.setIsRecordingEnabled, handleToggleViewMode]);

  useKeyboardNavigation(shortcuts, !isChatOpen && !isExportModalOpen && !isImmersiveMode && !isWelcomeModalOpen && !isTourActive);

  if (isImmersiveMode) {
    return (
      <ImmersiveMode 
        isListening={speech.isListening}
        transcriptEntries={displayedTranscriptEntries}
        interimTranscript={speech.transcript}
        stream={speech.stream}
        themeColors={appSettings.themeColors}
        onExit={() => setIsImmersiveMode(false)}
        onToggleListen={() => speech.isListening ? handleStop() : handleStart()}
        avatarEmotion={displayedAvatarEmotion}
        avatarMap={AVATAR_EMOTIONS}
        isTrueMobile={isTrueMobile}
      />
    );
  }

  const controlPanel = (
    <ControlPanel
        isListening={speech.isListening}
        isAnalyzing={isDisplayedAnalyzing}
        isSummarizing={isDisplayedSummarizing}
        wpm={displayedSpeechAnalytics.wpm || 0}
        confidence={speech.confidence}
        finalTranscript={speech.finalTranscript}
        onStart={handleStart}
        onStop={handleStop}
        onClear={handleClear}
        onGoImmersive={() => setIsImmersiveMode(true)}
        isImmersiveButtonGlowing={!sessionActive}
        isStartButtonGlowing={!sessionActive}
        themeId={appSettings.themeId}
        setThemeId={appSettings.setThemeId}
        customThemeColors={appSettings.customThemeColors}
        setCustomThemeColors={appSettings.setCustomThemeColors}
        diarizationSettings={appSettings.diarizationSettings}
        setDiarizationSettings={appSettings.setDiarizationSettings}
        translationLanguage={appSettings.translationLanguage}
        setTranslationLanguage={appSettings.setTranslationLanguage}
        spokenLanguage={appSettings.spokenLanguage}
        setSpokenLanguage={appSettings.setSpokenLanguage}
        liveTranslationEnabled={appSettings.liveTranslationEnabled}
        setLiveTranslationEnabled={appSettings.setLiveTranslationEnabled}
        onExport={() => setIsExportModalOpen(true)}
        sessionActive={sessionActive}
        hasContent={hasContent}
        shortcuts={shortcuts}
        isMobileView={isMobileView}
        isTrueMobile={isTrueMobile}
        setViewModeOverride={appSettings.setViewModeOverride}
        isSettingsCollapsed={isSettingsCollapsed}
        setIsSettingsCollapsed={setIsSettingsCollapsed}
        isTourActive={isTourActive}
    />
  );
  
  const mainContentPanel = (
    <MainContentPanel
      isListening={isTourActive ? true : speech.isListening}
      stream={speech.stream}
      themeColors={appSettings.themeColors}
      transcriptEntries={displayedTranscriptEntries}
      liveText={isTourActive ? "This is where your live text appears as you speak..." : speech.transcript}
      liveTextState={isTourActive ? 'visible' : liveTextState}
      activeSpeaker={transcriptManager.activeSpeaker}
      speakerProfiles={displayedSpeakerProfiles}
      handleUpdateSpeakerLabel={transcriptManager.handleUpdateSpeakerLabel}
      showTimestamps={appSettings.showTimestamps}
      setShowTimestamps={appSettings.setShowTimestamps}
      diarizationEnabled={appSettings.diarizationSettings.enabled}
      onOpenChat={handleOpenChat}
      onTranslateEntry={(entryId) => transcriptManager.handleTranslateEntry(entryId, appSettings.translationLanguage)}
      onReassignSpeaker={transcriptManager.handleReassignSpeakerForEntry}
      transcriptTextSize={appSettings.transcriptTextSize}
      setTranscriptTextSize={appSettings.setTranscriptTextSize}
      visualizerHeight={visualizerHeight}
      setVisualizerHeight={setVisualizerHeight}
      highlightedTopic={highlightedTopic}
      audioBlobUrl={speech.audioBlobUrl}
      onDeleteAudio={speech.deleteAudio}
      recordingDuration={speech.recordingDuration}
      onStop={handleStop}
      onStart={handleStart}
      isRecordingEnabled={appSettings.isRecordingEnabled}
      setIsRecordingEnabled={appSettings.setIsRecordingEnabled}
      isTrueMobile={isTrueMobile}
      showVisualizerHint={showVisualizerHint}
    />
  );

  const analyticsPanel = (
    <AnalyticsPanel
      isSummarizing={isDisplayedSummarizing}
      summary={displayedSummary}
      summaryStyle={displayedSummaryStyle}
      onSummarize={handleSummarize}
      actionItems={displayedActionItems}
      snippets={displayedSnippets}
      topics={displayedTopics}
      isAnalyzing={isDisplayedAnalyzing}
      speechAnalytics={displayedSpeechAnalytics}
      speakerProfiles={displayedSpeakerProfiles}
      transcriptEntries={displayedTranscriptEntries}
      highlightedTopic={highlightedTopic}
      onSetHighlightedTopic={setHighlightedTopic}
      statCardOrder={appSettings.statCardOrder}
      setStatCardOrder={appSettings.setStatCardOrder}
      isTourActive={isTourActive}
      currentTourStepId={currentStep?.id}
    />
  );

  return (
    <ErrorBoundary>
      <CosmicBackground />
      <main className={`h-screen w-screen bg-[var(--color-bg-deep)] text-slate-200 flex ${isMobileView ? 'flex-col' : 'flex-col md:flex-row md:p-3 md:gap-3'}`}>
        {isMobileView ? (
          <>
            <div className="flex-1 min-h-0">
              {activeMobileTab === 'controls' && <div className="h-full">{controlPanel}</div>}
              {activeMobileTab === 'transcript' && <div className="h-full">{mainContentPanel}</div>}
              {activeMobileTab === 'analytics' && <div className="h-full">{analyticsPanel}</div>}
            </div>
            <BottomNav 
              activeTab={activeMobileTab} 
              onTabChange={setActiveMobileTab} 
              actionItemsCount={displayedActionItems.length}
              snippetsCount={displayedSnippets.length}
            />
          </>
        ) : (
          <>
            <div style={{ width: `${appSettings.leftPanelWidth}px` }} className="h-full flex-shrink-0">
                {controlPanel}
            </div>
            <div className="resizer" onMouseDown={() => appSettings.handleMouseDown('left')}></div>
            <div className="flex-1 h-full min-w-0" data-tour-id="transcript-panel">
                {mainContentPanel}
            </div>
            <div className="resizer" onMouseDown={() => appSettings.handleMouseDown('right')}></div>
            <div style={{ width: `${appSettings.rightPanelWidth}px` }} className="h-full flex-shrink-0" data-tour-id="analytics-panel">
                {analyticsPanel}
            </div>
          </>
        )}
      </main>
      
      <div className={`fixed z-[100] w-full max-w-sm space-y-2 ${isMobileView ? 'top-4 left-1/2 -translate-x-1/2' : 'top-4 right-4'}`}>
        {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />)}
      </div>

      {isWelcomeModalOpen && <WelcomeModal isOpen={isWelcomeModalOpen} onClose={handleWelcomeClose} onStartTour={handleStartTour} isTrueMobile={isTrueMobile} />}
      {isChatOpen && <TranscriptChat key={sessionKey} transcript={fullTranscriptText} onClose={() => setIsChatOpen(false)} translationLanguage={appSettings.translationLanguage} isMobile={isMobileView} />}
      {isTourActive && currentStep && (
        <TourGuide
          step={currentStep}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onNext={nextStep}
          onPrev={prevStep}
          onEnd={endTour}
        />
      )}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        transcriptEntries={displayedTranscriptEntries}
        speakerProfiles={displayedSpeakerProfiles}
        speechAnalytics={displayedSpeechAnalytics}
        diarizationSettings={appSettings.diarizationSettings}
        confidence={speech.confidence}
        summary={displayedSummary}
        actionItems={displayedActionItems}
        snippets={displayedSnippets}
        topics={displayedTopics}
      />
    </ErrorBoundary>
  );
};

export default App;