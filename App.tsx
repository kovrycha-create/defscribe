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
import CursorTrail from './components/CursorTrail';
import Resizer from './components/Resizer';
import CollapsedPanelTab from './components/CollapsedPanelTab';

// --- Hooks ---
import useAppSettings from './hooks/useAppSettings';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useTranscript from './hooks/useTranscript';
import useAnalytics from './hooks/useAnalytics';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useTour } from './hooks/useTour';
import useProactiveAssistant from './hooks/useProactiveAssistant';

// --- Types & Constants ---
import { type SummaryStyle, type Emotion, type ProactiveMessage, type GeneratedTitle } from './types';
import { AVATAR_EMOTIONS } from './constants';
import * as SAMPLE_DATA from './sample-data';
import { getWwydResponse, type WwydMessage } from './services/geminiService';

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
};

// --- Resizable Panel Constants ---
const DEFAULT_LEFT_WIDTH = 350;
const DEFAULT_RIGHT_WIDTH = 440;
const MIN_PANEL_WIDTH = 280;
const COLLAPSED_WIDTH = 56;
const RESIZER_SENSITIVITY = 1;


const App: React.FC = () => {
  // --- Primary Hooks ---
  const appSettings = useAppSettings();
  const { panelLayout, setPanelLayout } = appSettings;
  const { leftPanelWidth, rightPanelWidth, isLeftPanelCollapsed, isRightPanelCollapsed } = panelLayout;
  
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
  const [wwydMessages, setWwydMessages] = useState<Array<{ text: string; id: number; type: WwydMessage['type'] }> | null>(null);
  const [isWwydLoading, setIsWwydLoading] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState<ProactiveMessage | null>(null);
  
  const mainContainerRef = useRef<HTMLElement>(null);

  // --- Resizable Panel Handlers ---
  const handleLeftDrag = useCallback((deltaX: number) => {
    if (panelLayout.isLeftPanelCollapsed || !mainContainerRef.current) return;

    setPanelLayout(currentLayout => {
        const newWidth = currentLayout.leftPanelWidth + (deltaX * RESIZER_SENSITIVITY);
        // Clamp the new width between the minimum and the default width (as max).
        const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, DEFAULT_LEFT_WIDTH));
        return { ...currentLayout, leftPanelWidth: clampedWidth };
    });
  }, [panelLayout.isLeftPanelCollapsed, setPanelLayout]);

  const handleRightDrag = useCallback((deltaX: number) => {
    if (panelLayout.isRightPanelCollapsed || !mainContainerRef.current) return;
    const mainWidth = mainContainerRef.current.offsetWidth;
    
    setPanelLayout(currentLayout => {
        const maxRightWidth = mainWidth - currentLayout.leftPanelWidth - MIN_PANEL_WIDTH - 16;
        const newWidth = currentLayout.rightPanelWidth - (deltaX * RESIZER_SENSITIVITY);
        const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(newWidth, maxRightWidth));
        return { ...currentLayout, rightPanelWidth: clampedWidth };
    });
  }, [panelLayout.isRightPanelCollapsed, setPanelLayout]);
  
  const handleResetLayout = useCallback(() => {
      setPanelLayout(currentLayout => ({
        ...currentLayout,
        isLeftPanelCollapsed: false,
        isRightPanelCollapsed: false,
        leftPanelWidth: DEFAULT_LEFT_WIDTH,
        rightPanelWidth: DEFAULT_RIGHT_WIDTH,
    }));
  }, [setPanelLayout]);

  const handleToggleCollapseLeft = useCallback(() => {
      setPanelLayout(currentLayout => ({ ...currentLayout, isLeftPanelCollapsed: !currentLayout.isLeftPanelCollapsed }));
  }, [setPanelLayout]);

  const handleToggleCollapseRight = useCallback(() => {
      setPanelLayout(currentLayout => ({ ...currentLayout, isRightPanelCollapsed: !currentLayout.isRightPanelCollapsed }));
  }, [setPanelLayout]);

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

  // --- Proactive Assistant ---
  const handleNudge = useCallback((text: string) => {
    setProactiveMessage({ text, id: Date.now() });
  }, []);

  useProactiveAssistant({
    isListening: speech.isListening,
    transcriptEntries: transcriptManager.transcriptEntries,
    speechAnalytics: analytics.speechAnalytics,
    onNudge: handleNudge,
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
  const displayedTitles = isTourActive ? SAMPLE_DATA.SAMPLE_TITLES : analytics.titles;
  const displayedAvatarEmotion = isTourActive ? 'listening' : analytics.avatarEmotion;
  const isDisplayedAnalyzing = isTourActive ? false : analytics.isAnalyzing;
  const isDisplayedSummarizing = isTourActive ? false : analytics.isSummarizing;
  const isDisplayedGeneratingTitles = isTourActive ? false : analytics.isGeneratingTitles;

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
  }, [speech.isListening, prevIsListening, fullTranscriptText, transcriptManager.speakerProfiles, analytics, isTourActive]);

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
  
  const handleWwyd = useCallback(async (e: React.MouseEvent) => {
    if (isWwydLoading || isTourActive) return;
    setIsWwydLoading(true);

    const isAltClick = e.altKey;
    const isCtrlClick = e.ctrlKey;

    const lastEntryTime = transcriptManager.transcriptEntries.length > 0
        ? transcriptManager.transcriptEntries[transcriptManager.transcriptEntries.length - 1].rawTimestamp
        : transcriptManager.startTimeRef.current;
    
    const pause_ms = speech.isListening && lastEntryTime ? Date.now() - lastEntryTime : 0;

    const sentimentMap: Partial<Record<Emotion, 'neutral'|'frustrated'|'sad'|'tense'|'upbeat'>> = {
      frustrated: 'frustrated', mad: 'frustrated',
      sad: 'sad', hurt: 'sad',
      intense: 'tense',
      happy: 'upbeat', loving: 'upbeat', goofy: 'upbeat',
    };

    const inputs = {
        pause_ms: pause_ms > 500 ? pause_ms : undefined,
        wpm: analytics.speechAnalytics.wpm || undefined,
        sentiment_hint: sentimentMap[analytics.avatarEmotion] || 'neutral',
        recentTranscript: transcriptManager.transcriptEntries.slice(-3).map(e => `${transcriptManager.speakerProfiles[e.speakerIds?.[0] || 'S1']?.label || 'Speaker'}: ${e.text}`).join('\n'),
    };

    try {
        const response = await getWwydResponse(inputs, isAltClick ? 'walltalk' : 'standard', isCtrlClick);
        if (response && response.length > 0) {
            const newMsgs = response.map(msg => ({ text: msg.text, id: Date.now() + Math.random(), type: msg.type }));
            setWwydMessages(newMsgs);
        }
    } catch (error) {
        console.error("WWYD feature error:", error);
        addToast("Ymzo is Silent", "Could not get guidance at this time.", "error");
    } finally {
        setIsWwydLoading(false);
    }
  }, [isWwydLoading, isTourActive, transcriptManager, speech.isListening, analytics.speechAnalytics.wpm, analytics.avatarEmotion, addToast]);
  
  const dismissWwydMessage = useCallback(() => {
    setWwydMessages(null);
  }, []);


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
        onWwyd={handleWwyd}
        isWwydLoading={isWwydLoading}
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
      onUpdateEntryText={transcriptManager.handleUpdateEntryText}
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
      wwydMessages={wwydMessages}
      onDismissWwyd={dismissWwydMessage}
      proactiveMessage={proactiveMessage}
      onDismissProactiveMessage={() => setProactiveMessage(null)}
      visualizerBackground={appSettings.visualizerBackground}
      setVisualizerBackground={appSettings.setVisualizerBackground}
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
      titles={displayedTitles}
      isAnalyzing={isDisplayedAnalyzing}
      isGeneratingTitles={isDisplayedGeneratingTitles}
      onGenerateTitles={() => analytics.handleGenerateTitles(fullTranscriptText)}
      hasEnoughContent={hasContent}
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
      <CursorTrail />
      <main ref={mainContainerRef} className={`h-screen w-screen bg-transparent text-slate-200 flex ${isMobileView ? 'flex-col' : 'flex-row p-3 gap-3'}`}>
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
            <div style={{ width: isLeftPanelCollapsed ? COLLAPSED_WIDTH : leftPanelWidth, transition: 'width 0.3s ease-out' }} className="h-full flex-shrink-0 overflow-hidden">
                {isLeftPanelCollapsed ? (
                    <CollapsedPanelTab title="Controls" icon="fa-sliders-h" onClick={handleToggleCollapseLeft} />
                ) : (
                    controlPanel
                )}
            </div>
            
            <Resizer 
                onDrag={handleLeftDrag} 
                onDoubleClick={handleResetLayout} 
                onCtrlClick={handleToggleCollapseLeft} 
                isPanelCollapsed={isLeftPanelCollapsed}
            />

            <div className="flex-1 h-full min-w-0" data-tour-id="transcript-panel">
                {mainContentPanel}
            </div>

            <Resizer 
                onDrag={handleRightDrag} 
                onDoubleClick={handleResetLayout} 
                onCtrlClick={handleToggleCollapseRight} 
                isPanelCollapsed={isRightPanelCollapsed}
            />

            <div style={{ width: isRightPanelCollapsed ? COLLAPSED_WIDTH : rightPanelWidth, transition: 'width 0.3s ease-out' }} className="h-full flex-shrink-0 overflow-hidden" data-tour-id="analytics-panel">
                 {isRightPanelCollapsed ? (
                    <CollapsedPanelTab title="Analytics" icon="fa-chart-pie" onClick={handleToggleCollapseRight} />
                ) : (
                    analyticsPanel
                )}
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