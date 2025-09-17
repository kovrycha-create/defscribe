import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { type Chat } from '@google/genai';

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
import HistoryModal from './components/HistoryModal';
import { useFocusTrap } from './hooks/useFocusTrap';

// --- Hooks ---
import useAppSettings from './hooks/useAppSettings';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useTranscript from './hooks/useTranscript';
import useAnalytics from './hooks/useAnalytics';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useTour } from './hooks/useTour';
import useProactiveAssistant from './hooks/useProactiveAssistant';
import { useSessionHistory } from './hooks/useSessionHistory';

// --- Types & Constants ---
// FIX: Added ReframingResult to the import to support the new reframing feature.
import { type SummaryStyle, type ProactiveMessage, type Session, type ChatMessage, type ReframingResult } from './types';
import { AVATAR_EMOTIONS } from './constants';
import { getWwydResponse, type WwydMessage, createYmzoChat } from './services/geminiService';

// --- Lore Data ---
import { strands, specialJokers } from './data/strands';
import { fluons } from './data/fluons';
import { trinkets } from './data/trinkets';
import { cards } from './data/cards';


// ===================================================================================
// INLINE COMPONENT: YmzoOracle
// Reason: To implement the new WWYD feature UI without adding new files,
// adhering to the project's structural constraints.
// ===================================================================================
const YmzoOracle: React.FC<{ 
    messages: Array<{ text: string; id: number; type: WwydMessage['type'] }>; 
    onDismiss: () => void;
    onOpenCodex: (tab: string, entryId: string) => void;
}> = ({ messages, onDismiss, onOpenCodex }) => {
    const [displayedMessages, setDisplayedMessages] = useState<Array<{ id: number; type: WwydMessage['type']; text: string }>>([]);

    useEffect(() => {
        const newMessages = messages.map(msg => ({ ...msg, text: '' }));
        setDisplayedMessages(newMessages);

        messages.forEach((msg, msgIndex) => {
            let i = 0;
            const typingInterval = setInterval(() => {
                if (i < msg.text.length) {
                    setDisplayedMessages(prev => prev.map((prevMsg, index) => 
                        index === msgIndex ? { ...prevMsg, text: prevMsg.text + msg.text.charAt(i) } : prevMsg
                    ));
                    i++;
                } else {
                    clearInterval(typingInterval);
                }
            }, 25); // Typing speed
        });
    }, [messages]);
    
    const allKeywords = useMemo(() => {
        const loreKeywords = new Set<string>();
        strands.forEach(s => loreKeywords.add(s.name.toLowerCase()));
        Object.values(fluons).flat().forEach(f => loreKeywords.add(f.name.toLowerCase()));
        trinkets.forEach(t => loreKeywords.add(t.name.toLowerCase()));
        return loreKeywords;
    }, []);

    const renderTextWithLinks = (text: string) => {
        const regex = new RegExp(`\\b(${Array.from(allKeywords).join('|')})\\b`, 'gi');
        return text.split(regex).map((part, index) => {
            if (index % 2 === 1) { // It's a keyword
                const lowerPart = part.toLowerCase();
                // This is a simplified lookup; a more robust system would map keywords to codex tabs/entries
                return (
                    <button 
                        key={index} 
                        className="font-bold text-[var(--color-accent)] hover:underline cursor-pointer"
                        onClick={() => onOpenCodex('strands', lowerPart)} // Simple deep link
                    >
                        {part}
                    </button>
                );
            }
            return part;
        });
    };

    return (
      <div 
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[150] w-full max-w-2xl p-4 animate-[char-slide-in_0.5s_ease-out]"
        onClick={onDismiss}
      >
        <div className="relative cosmo-panel rounded-xl shadow-2xl p-4 space-y-3">
          {displayedMessages.map((msg) => {
              const isTimeMessage = msg.type === 'time';
              return (
                <div key={msg.id} className={`p-3 rounded-lg shadow-inner ${isTimeMessage ? 'bg-amber-900/20' : 'bg-purple-900/20'}`}>
                    <p className={`text-sm pr-6 flex items-start ${isTimeMessage ? 'text-amber-200' : 'text-purple-200'}`}>
                        <span className="flex-shrink-0 flex items-center mr-3 pt-0.5">
                            {isTimeMessage ? <i className="fas fa-clock text-amber-400"></i> : <span className="font-bold text-purple-300">✦</span>}
                        </span>
                        <span className="flex-1">
                          <span className={`font-bold mr-2 ${isTimeMessage ? 'text-amber-300' : 'text-purple-300'}`}>Ymzo says:</span>
                          {renderTextWithLinks(msg.text)}
                        </span>
                    </p>
                </div>
              );
          })}
          <button 
            onClick={onDismiss} 
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-purple-300 hover:text-white hover:bg-purple-700/50 transition-colors z-10"
            aria-label="Dismiss message"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>
      </div>
    );
};


// ===================================================================================
// INLINE COMPONENT: CosmicCodexModal & CodexCard
// Reason: To implement the new Codex feature UI without adding new files.
// ===================================================================================
const CodexCard: React.FC<{ item: { id: string; name: string; symbol: string; description: string; image?: string; type?: string; } }> = ({ item }) => (
    <div data-entry-id={item.id.toLowerCase()} className="bg-slate-800/50 rounded-lg p-4 flex items-center gap-4 transition-colors hover:bg-slate-700/50">
        <div className="w-16 h-16 rounded-lg flex-shrink-0 bg-slate-900/50 flex items-center justify-center text-4xl" 
            style={{ backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {!item.image && <span>{item.symbol}</span>}
        </div>
        <div className="flex-1">
            <h4 className="font-bold text-white flex items-center justify-between">
                <span>{item.name}</span>
                {item.type && <span className="text-xs font-normal text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">{item.type}</span>}
            </h4>
            <p className="text-sm text-slate-300">{item.description}</p>
        </div>
    </div>
);

const CosmicCodexModal: React.FC<{ onClose: () => void; initialTab?: string; initialEntry?: string; }> = ({ onClose, initialTab = 'strands', initialEntry }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialEntry && modalRef.current) {
            // Give the content time to render before trying to scroll
            setTimeout(() => {
                const element = modalRef.current?.querySelector(`[data-entry-id="${initialEntry.toLowerCase()}"]`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [initialEntry, activeTab]);

    const filteredStrands = strands.concat(specialJokers).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const allFluons = Object.values(fluons).flat();
    const filteredFluons = allFluons.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.type.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredTrinkets = trinkets.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    // FIX: Add a type assertion to card to allow optional 'image' property.
    const allCards = Object.entries(cards).map(([id, card]) => ({ id, name: card.title, symbol: '🃏', description: card.primary, image: (card as { image?: string }).image, type: 'Major Arcana' }));
    const filteredCards = allCards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
            <div
                ref={modalRef}
                className="cosmo-panel rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] h-[700px]"
                onClick={e => e.stopPropagation()}
                role="dialog" aria-modal="true" aria-labelledby="codex-title"
            >
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[rgba(var(--color-primary-rgb),0.2)]">
                    <h2 id="codex-title" className="text-xl font-bold flex items-center gap-3"><i className="fas fa-book-journal-whills text-[var(--color-primary)]"></i> Cosmic Codex</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
                </header>
                
                <div className="p-4 flex-shrink-0">
                    <div className="flex border-b border-slate-700/50 mb-4">
                        <button onClick={() => setActiveTab('strands')} className={`flex-1 pb-2 text-sm font-semibold transition-colors ${activeTab === 'strands' ? 'text-white border-b-2 border-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-200'}`}>Strands</button>
                        <button onClick={() => setActiveTab('cards')} className={`flex-1 pb-2 text-sm font-semibold transition-colors ${activeTab === 'cards' ? 'text-white border-b-2 border-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-200'}`}>Cards</button>
                        <button onClick={() => setActiveTab('fluons')} className={`flex-1 pb-2 text-sm font-semibold transition-colors ${activeTab === 'fluons' ? 'text-white border-b-2 border-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-200'}`}>Fluons</button>
                        <button onClick={() => setActiveTab('trinkets')} className={`flex-1 pb-2 text-sm font-semibold transition-colors ${activeTab === 'trinkets' ? 'text-white border-b-2 border-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-200'}`}>Trinkets</button>
                    </div>
                    <div className="relative">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input type="text" placeholder="Search Codex..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full cosmo-input rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <div className="space-y-3">
                      {activeTab === 'strands' && filteredStrands.map(item => <CodexCard key={item.id} item={item} />)}
                      {activeTab === 'cards' && filteredCards.map(item => <CodexCard key={item.id} item={item} />)}
                      {activeTab === 'fluons' && filteredFluons.map(item => <CodexCard key={item.id} item={item} />)}
                      {activeTab === 'trinkets' && filteredTrinkets.map(item => <CodexCard key={item.id} item={item} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ===================================================================================
// INLINE COMPONENT: YmzoChatModal
// Reason: To implement the new Ymzo chat feature without adding new files.
// ===================================================================================
const YmzoChatModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    chatInstance: Chat | null;
}> = ({ isOpen, onClose, chatInstance }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 'ymzo-intro', role: 'model', text: "The threads are still. Ask." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    useFocusTrap(chatContainerRef, isOpen);

    useEffect(() => {
        if(isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isOpen, messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !chatInstance) return;

        const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const modelMessageId = `model-${Date.now()}`;
        setMessages(prev => [...prev, { id: modelMessageId, role: 'model', text: '', isLoading: true }]);

        try {
            const responseStream = await chatInstance.sendMessageStream({ message: input });

            let fullText = '';
            for await (const chunk of responseStream) {
                fullText += chunk.text;
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === modelMessageId ? { ...msg, text: fullText } : msg
                    )
                );
            }
          
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === modelMessageId ? { ...msg, isLoading: false } : msg
                )
            );

        } catch (error) {
            console.error("Ymzo Chat error:", error);
            const errorMessage = error instanceof Error ? error.message : "The currents are unclear at this moment.";
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === modelMessageId ? { ...msg, text: `Oracle Error: ${errorMessage}`, isLoading: false } : msg
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[90] animate-[fadeIn_0.3s_ease-out]" onClick={onClose}>
          <div
            ref={chatContainerRef}
            className="fixed bottom-0 left-0 h-[60vh] max-h-[600px] w-full max-w-2xl cosmo-panel border-t-2 border-[var(--color-secondary)] rounded-t-2xl shadow-2xl flex flex-col animate-[char-slide-in_0.5s_ease-out]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ymzo-chat-title"
          >
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[rgba(var(--color-secondary-rgb),0.2)]">
              <h2 id="ymzo-chat-title" className="text-lg font-bold flex items-center gap-2"><i className="fas fa-hat-wizard text-[var(--color-secondary)]"></i> Chat with Ymzo</h2>
              <button aria-label="Close chat" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-[var(--color-secondary)] flex items-center justify-center flex-shrink-0 hex-clip"><i className="fas fa-hat-wizard text-black"></i></div>}
                  <div className={`max-w-[80%] rounded-2xl p-3 leading-relaxed ${msg.role === 'user' ? 'bg-[var(--color-secondary)] text-white' : 'bg-slate-700'}`}>
                      <p>{msg.text}</p>
                      {msg.isLoading && <span className="inline-block w-2 h-2 bg-slate-300 rounded-full ml-2 animate-ping"></span>}
                  </div>
                  {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 hex-clip"><i className="fas fa-user text-white"></i></div>}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex-shrink-0 p-4 border-t border-[rgba(var(--color-secondary-rgb),0.2)]">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the Continuum..."
                  disabled={isLoading}
                  className="w-full cosmo-input rounded-lg py-3 pl-4 pr-12 text-sm focus:outline-none disabled:opacity-50"
                />
                <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[var(--color-secondary)] rounded-lg text-black flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Send message">
                  {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                </button>
              </div>
            </form>
          </div>
        </div>
    );
};


// ===================================================================================
// MAIN APP COMPONENT
// ===================================================================================
const App: React.FC = () => {
  // --- State Management ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeMobileTab, setActiveMobileTab] = useState<'controls' | 'transcript' | 'analytics'>('transcript');
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);
  
  // --- Modals & Popups ---
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('defscribe-hasWelcomed'));
  const [showExport, setShowExport] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [codexInitial, setCodexInitial] = useState<{tab?: string; entry?: string}>({});
  const [showYmzoChat, setShowYmzoChat] = useState(false);
  const [ymzoChatInstance, setYmzoChatInstance] = useState<Chat | null>(null);

  // --- Core Hooks ---
  const settings = useAppSettings();
  const addToast = useCallback((title: string, message: string, type: ToastType) => {
    setToasts(prev => [...prev, { id: Date.now(), title, message, type }]);
  }, []);

  const { isListening, transcript, finalTranscript, error, confidence, startListening, stopListening, clearTranscript, isCloudMode, stream, audioBlobUrl, deleteAudio, recordingDuration, transcribeFile, isTranscribingFile, liveAudioFeatures } = useSpeechRecognition({
    spokenLanguage: settings.spokenLanguage,
    addToast,
    isRecordingEnabled: settings.isRecordingEnabled,
  });

  const { transcriptEntries, speakerProfiles, clearTranscriptEntries, handleUpdateSpeakerLabel, handleUpdateEntryText, segments, activeSpeaker, handleReassignSpeakerForEntry, handleTranslateEntry, loadTranscriptData } = useTranscript({
    finalTranscript,
    diarizationSettings: settings.diarizationSettings,
    addToast,
    liveTranslationEnabled: settings.liveTranslationEnabled,
    translationLanguage: settings.translationLanguage,
    isCloudMode,
    stream,
    liveAudioFeatures,
  });
  
  const analytics = useAnalytics({
    addToast,
    transcriptEntries,
    startTime: transcriptEntries.length > 0 ? transcriptEntries[0].rawTimestamp : null,
    segments,
    isListening,
    interimTranscript: transcript,
    recordingDuration,
    isCloudMode,
  });

  const { sessions, saveSession, deleteSession, getSession } = useSessionHistory();

  // --- Easter Egg: Censor Language ---
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
    } else {
        addToast(
            settings.censorLanguage ? 'Censor Mode On' : 'Censor Mode Off',
            settings.censorLanguage ? 'Profanity will be censored.' : 'Profanity will not be censored.',
            'info'
        );
    }
  }, [settings.censorLanguage, addToast]);

  // --- Proactive & WWYD Features ---
  const [proactiveMessage, setProactiveMessage] = useState<ProactiveMessage | null>(null);
  const handleNudge = (text: string) => setProactiveMessage({ id: Date.now(), text });
  useProactiveAssistant({ isListening, transcriptEntries, speechAnalytics: analytics.speechAnalytics, onNudge: handleNudge });
  const [wwydMessages, setWwydMessages] = useState<Array<{ text: string; id: number; type: WwydMessage['type'] }>>([]);
  const [isWwydLoading, setIsWwydLoading] = useState(false);
  const handleWwyd = useCallback(async (e: React.MouseEvent) => {
      if (isWwydLoading) return;
      setIsWwydLoading(true);
      const recentTranscript = transcriptEntries.slice(-5).map(entry => entry.text).join('\n');
      const type = e.altKey ? 'walltalk' : 'standard';
      const forcePocketwatch = e.ctrlKey || e.metaKey;
      
      try {
        const responses = await getWwydResponse({ recentTranscript }, type, forcePocketwatch);
        setWwydMessages(responses.map(msg => ({ ...msg, id: Math.random() })));
      } catch(err) {
          addToast("Oracle Error", "Ymzo could not respond.", "error");
      } finally {
          setIsWwydLoading(false);
      }
  }, [isWwydLoading, transcriptEntries, addToast]);

  // --- Session Management ---
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionActive = isListening || transcriptEntries.length > 0;
  const hasContent = transcriptEntries.length > 0;

  const handleClear = useCallback(async () => {
    if (hasContent) {
        const newSession: Session = {
            id: currentSessionId || self.crypto.randomUUID(),
            title: analytics.titles[0]?.text || `Session from ${new Date().toLocaleString()}`,
            timestamp: Date.now(),
            transcriptEntries,
            speakerProfiles,
            speechAnalytics: analytics.speechAnalytics,
            summary: analytics.summary,
            actionItems: analytics.actionItems,
            snippets: analytics.snippets,
            topics: analytics.topics,
            titles: analytics.titles,
        };
        saveSession(newSession);
    }
    await clearTranscript();
    clearTranscriptEntries();
    analytics.clearAnalytics();
    deleteAudio();
    setCurrentSessionId(null);
  }, [hasContent, currentSessionId, analytics, transcriptEntries, speakerProfiles, saveSession, clearTranscript, clearTranscriptEntries, deleteAudio]);

  const handleLoadSession = (sessionId: string) => {
      const session = getSession(sessionId);
      if (session) {
          loadTranscriptData({ entries: session.transcriptEntries, profiles: session.speakerProfiles });
          analytics.loadAnalyticsData(session);
          setCurrentSessionId(session.id);
          addToast("Session Loaded", `Loaded "${session.title}".`, "success");
          setShowHistory(false);
      } else {
          addToast("Load Failed", "Could not find the selected session.", "error");
      }
  };
  
  const handleDeleteSession = (sessionId: string) => {
      deleteSession(sessionId);
      addToast("Session Deleted", "The session has been removed from history.", "info");
  };

  // --- UI & Layout ---
  const isTrueMobile = useMediaQuery('(max-width: 767px)');
  const isMobileView = settings.viewModeOverride ? settings.viewModeOverride === 'mobile' : isTrueMobile;
  const [visualizerHeight, setVisualizerHeight] = useState(isMobileView ? 120 : 280);
  const [isImmersive, setIsImmersive] = useState(false);
  
  // Panel resizing logic

  const handlePanelLayout = useCallback((key: 'leftPanelWidth' | 'rightPanelWidth', delta: number) => {
      settings.setPanelLayout(prev => ({ ...prev, [key]: Math.max(300, Math.min(prev[key] + delta, 600)) }));
  }, [settings.setPanelLayout]);

  const handlePanelCollapse = useCallback((key: 'isLeftPanelCollapsed' | 'isRightPanelCollapsed') => {
      settings.setPanelLayout(prev => ({ ...prev, [key]: !prev[key] }));
  }, [settings.setPanelLayout]);

  const handleResetPanelLayout = useCallback(() => {
    settings.setPanelLayout(prev => ({...prev, leftPanelWidth: 350, rightPanelWidth: 440}));
  }, [settings.setPanelLayout]);

  // --- Tour Management ---
  const handleTourStepChange = (step: any) => {
    if (step.id === 'open-settings') {
      settings.setPanelLayout(prev => ({...prev, isLeftPanelCollapsed: false}));
    } else if (step.id === 'close-settings') {
      settings.setPanelLayout(prev => ({...prev, isLeftPanelCollapsed: true}));
    } else if (step.id === 'analytics') {
      settings.setPanelLayout(prev => ({...prev, isRightPanelCollapsed: false}));
    }
  };
  
  const { isTourActive, currentStep, currentStepIndex, totalSteps, startTour, endTour, nextStep, prevStep } = useTour({ onStepChange: handleTourStepChange });
  
  const handleStartTour = () => {
    setShowWelcome(false);
    startTour();
  };

  useEffect(() => {
    if (showWelcome === false) {
      localStorage.setItem('defscribe-hasWelcomed', 'true');
    }
  }, [showWelcome]);

  // --- Keyboard Shortcuts ---
  const shortcuts = useMemo(() => [
    { key: ' ', handler: () => isListening ? stopListening() : startListening(), description: 'Start/Stop Listening' },
    { key: 'i', ctrl: true, handler: () => setIsImmersive(p => !p), description: 'Toggle Immersive Mode' },
    { key: 'e', ctrl: true, handler: () => setShowExport(p => !p), description: 'Open Export Menu' },
    { key: 'h', ctrl: true, handler: () => setShowHistory(p => !p), description: 'Open History' },
    { key: 'k', ctrl: true, handler: () => setShowCodex(p => !p), description: 'Open Cosmic Codex' },
    { key: 'm', ctrl: true, handler: handleClear, description: 'Clear Session (saves first)' },
  ], [isListening, startListening, stopListening, handleClear]);

  useKeyboardNavigation(shortcuts, !showExport && !showChat && !showWelcome && !isImmersive && !showHistory && !showCodex && !showYmzoChat);
  
  // Open Codex with specific entry
  const openCodex = (tab?: string, entryId?: string) => {
    setCodexInitial({ tab, entry: entryId });
    setShowCodex(true);
  };
  
  // FIX: Added state and a (mocked) handler for the reframing feature.
  const [reframingResults, setReframingResults] = useState<Record<string, ReframingResult>>({});
  const handleReframeEntry = useCallback(async (entryId: string) => {
    const entryText = transcriptEntries.find(e => e.id === entryId)?.text;
    if (!entryText) return;

    setReframingResults(prev => ({ ...prev, [entryId]: { id: entryId, isLoading: true, thoughtPattern: '', reframedText: '', codexLink: '' } }));
    addToast('Reframing Thought...', 'Ymzo is contemplating a new perspective.', 'processing');
    try {
        // NOTE: This is a mocked implementation as a reframing service is not available.
        await new Promise(res => setTimeout(res, 1500));
        const mockResult: Omit<ReframingResult, 'id' | 'isLoading'> = {
            thoughtPattern: 'Cognitive Distortion',
            reframedText: "Instead of focusing on the worst-case scenario, what's a more balanced and realistic perspective on this situation?",
            codexLink: 'cognitive-distortion-example' // hypothetical codex link
        };
        setReframingResults(prev => ({ ...prev, [entryId]: { ...prev[entryId], ...mockResult, isLoading: false } }));
        addToast('Perspective Found', 'A reframed thought is available.', 'success');
    } catch(err) {
        console.error('Reframing failed', err);
        addToast('Reframing Failed', 'Could not generate a new perspective.', 'error');
        setReframingResults(prev => {
            const { [entryId]: _, ...rest } = prev;
            return rest;
        });
    }
  }, [transcriptEntries, addToast]);


  // Open Ymzo Chat
  useEffect(() => {
      if (showYmzoChat && !ymzoChatInstance) {
          setYmzoChatInstance(createYmzoChat());
      }
  }, [showYmzoChat, ymzoChatInstance]);

  // --- Main Render ---
  return (
    <ErrorBoundary>
      <CosmicBackground />
      <CursorTrail />

      {isImmersive ? (
        <ImmersiveMode
          isListening={isListening}
          transcriptEntries={transcriptEntries}
          interimTranscript={transcript}
          stream={stream}
          themeColors={settings.themeColors}
          onExit={() => setIsImmersive(false)}
          onToggleListen={isListening ? stopListening : startListening}
          avatarEmotion={analytics.avatarEmotion}
          avatarMap={AVATAR_EMOTIONS}
          isTrueMobile={isTrueMobile}
          censorLanguage={settings.censorLanguage}
        />
      ) : (
        <main className={`flex ${isMobileView ? 'flex-col' : 'flex-row'} h-screen max-h-screen overflow-hidden`}>
          {isMobileView ? (
            <>
              <div className={`flex-1 min-h-0 ${activeMobileTab === 'controls' ? '' : 'hidden'}`}>
                <ControlPanel 
                    isListening={isListening} 
                    isAnalyzing={analytics.isAnalyzing}
                    isSummarizing={analytics.isSummarizing}
                    wpm={analytics.speechAnalytics.wpm || 0} 
                    confidence={confidence} 
                    finalTranscript={finalTranscript}
                    onStart={startListening} 
                    onStop={stopListening} 
                    onClear={handleClear} 
                    onGoImmersive={() => setIsImmersive(true)}
                    isImmersiveButtonGlowing={transcriptEntries.length > 5}
                    isStartButtonGlowing={!sessionActive}
                    onExport={() => setShowExport(true)}
                    onHistory={() => setShowHistory(true)}
                    onOpenCodex={() => openCodex()}
                    onOpenYmzoChat={() => setShowYmzoChat(true)}
                    sessionActive={sessionActive}
                    hasContent={hasContent}
                    shortcuts={shortcuts}
                    isMobileView={isMobileView}
                    isTrueMobile={isTrueMobile}
                    isSettingsCollapsed={settings.panelLayout.isLeftPanelCollapsed}
                    setIsSettingsCollapsed={() => handlePanelCollapse('isLeftPanelCollapsed')}
                    isTourActive={isTourActive}
                    onWwyd={handleWwyd}
                    isWwydLoading={isWwydLoading}
          speakerProfiles={speakerProfiles}
          {...settings}
                />
              </div>
              <div className={`flex-1 min-h-0 ${activeMobileTab === 'transcript' ? '' : 'hidden'}`} data-tour-id="transcript-panel">
                <MainContentPanel
                    isListening={isListening} 
                    stream={stream} 
                    themeColors={settings.themeColors} 
                    transcriptEntries={transcriptEntries}
                    liveText={transcript}
                    liveTextState={transcript ? 'visible' : 'hidden'}
                    activeSpeaker={activeSpeaker}
                    speakerProfiles={speakerProfiles}
                    handleUpdateSpeakerLabel={handleUpdateSpeakerLabel}
                    onUpdateEntryText={handleUpdateEntryText}
                    showTimestamps={settings.showTimestamps}
                    setShowTimestamps={settings.setShowTimestamps}
                    diarizationEnabled={settings.diarizationSettings.enabled}
                    onOpenChat={() => setShowChat(true)}
                    onTranslateEntry={(id) => handleTranslateEntry(id, settings.translationLanguage)}
                    onReassignSpeaker={handleReassignSpeakerForEntry}
                    transcriptTextSize={settings.transcriptTextSize}
                    setTranscriptTextSize={settings.setTranscriptTextSize}
                    visualizerHeight={visualizerHeight}
                    setVisualizerHeight={setVisualizerHeight}
                    highlightedTopic={highlightedTopic}
                    audioBlobUrl={audioBlobUrl}
                    onDeleteAudio={deleteAudio}
                    recordingDuration={recordingDuration}
                    onStop={stopListening}
                    onStart={startListening}
                    isRecordingEnabled={settings.isRecordingEnabled}
                    setIsRecordingEnabled={settings.setIsRecordingEnabled}
                    isTrueMobile={isTrueMobile}
                    showVisualizerHint={!localStorage.getItem('defscribe-visualizerHintSeen')}
                    proactiveMessage={proactiveMessage}
                    onDismissProactiveMessage={() => setProactiveMessage(null)}
                    visualizerBackground={settings.visualizerBackground}
                    setVisualizerBackground={settings.setVisualizerBackground}
                    transcribeFile={transcribeFile}
                    isTranscribingFile={isTranscribingFile}
                    reframingResults={reframingResults}
                    handleReframeEntry={handleReframeEntry}
                    onOpenCodex={openCodex}
                    censorLanguage={settings.censorLanguage}
                />
              </div>
              <div className={`flex-1 min-h-0 ${activeMobileTab === 'analytics' ? '' : 'hidden'}`} data-tour-id="analytics-panel">
                <AnalyticsPanel 
                    isSummarizing={analytics.isSummarizing}
                    summary={analytics.summary}
                    summaryStyle={analytics.summaryStyle}
                    onSummarize={(style: SummaryStyle) => analytics.handleSummarize(transcriptEntries.map(e => e.text).join('\n'), style)}
                    actionItems={analytics.actionItems}
                    snippets={analytics.snippets}
                    topics={analytics.topics}
                    titles={analytics.titles}
                    isAnalyzing={analytics.isAnalyzing}
                    isGeneratingTitles={analytics.isGeneratingTitles}
                    onGenerateTitles={() => analytics.handleGenerateTitles(transcriptEntries.map(e => e.text).join('\n'))}
                    hasEnoughContent={transcriptEntries.length > 3}
                    speechAnalytics={analytics.speechAnalytics}
                    segments={segments}
                    speakerProfiles={speakerProfiles}
                    transcriptEntries={transcriptEntries}
                    highlightedTopic={highlightedTopic}
                    onSetHighlightedTopic={setHighlightedTopic}
                    statCardOrder={settings.statCardOrder}
                    setStatCardOrder={settings.setStatCardOrder}
                    isTourActive={isTourActive}
                    currentTourStepId={currentStep?.id}
                    onGenerateCosmicReading={() => analytics.handleGenerateCosmicReading(transcriptEntries.map(e => e.text).join('\n'))}
                    isReading={analytics.isReading}
                    cosmicReading={analytics.cosmicReading}
                    onOpenCodex={openCodex}
                    auraData={analytics.auraData}
                    liveAudioFeatures={liveAudioFeatures}
                    auraPalette={settings.auraPalette}
                    setAuraPalette={settings.setAuraPalette}
                    auraPulsationSpeed={settings.auraPulsationSpeed}
                    setAuraPulsationSpeed={settings.setAuraPulsationSpeed}
                    auraParticleDensity={settings.auraParticleDensity}
                    setAuraParticleDensity={settings.setAuraParticleDensity}
                    auraCustomColors={settings.auraCustomColors}
                    setAuraCustomColors={settings.setAuraCustomColors}
                />
              </div>
              <BottomNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} actionItemsCount={analytics.actionItems.length} snippetsCount={analytics.snippets.length} />
            </>
          ) : (
            <>
              {settings.panelLayout.isLeftPanelCollapsed ? (
                 <CollapsedPanelTab title="Controls" icon="fa-sliders-h" onClick={() => handlePanelCollapse('isLeftPanelCollapsed')} />
              ) : (
                <div style={{ width: `${settings.panelLayout.leftPanelWidth}px` }} className="flex-shrink-0 h-full">
                  <ControlPanel
                    isListening={isListening} 
                    isAnalyzing={analytics.isAnalyzing}
                    isSummarizing={analytics.isSummarizing}
                    wpm={analytics.speechAnalytics.wpm || 0} 
                    confidence={confidence} 
                    finalTranscript={finalTranscript}
                    onStart={startListening} 
                    onStop={stopListening} 
                    onClear={handleClear} 
                    onGoImmersive={() => setIsImmersive(true)}
                    isImmersiveButtonGlowing={transcriptEntries.length > 5}
                    isStartButtonGlowing={!sessionActive}
                    onExport={() => setShowExport(true)}
                    onHistory={() => setShowHistory(true)}
                    onOpenCodex={() => openCodex()}
                    onOpenYmzoChat={() => setShowYmzoChat(true)}
                    sessionActive={sessionActive}
                    hasContent={hasContent}
                    shortcuts={shortcuts}
                    isMobileView={isMobileView}
                    isTrueMobile={isTrueMobile}
                    isSettingsCollapsed={settings.panelLayout.isLeftPanelCollapsed}
                    setIsSettingsCollapsed={() => handlePanelCollapse('isLeftPanelCollapsed')}
                    isTourActive={isTourActive}
                    onWwyd={handleWwyd}
                    isWwydLoading={isWwydLoading}
                    speakerProfiles={speakerProfiles}
                    {...settings}
                  />
                </div>
              )}
              <Resizer 
                  onDrag={(dx) => handlePanelLayout('leftPanelWidth', dx)} 
                  onDoubleClick={handleResetPanelLayout}
                  onCtrlClick={() => handlePanelCollapse('isLeftPanelCollapsed')}
                  isPanelCollapsed={settings.panelLayout.isLeftPanelCollapsed}
              />
              <div className="flex-1 min-w-0 h-full" data-tour-id="transcript-panel">
                <MainContentPanel
                    isListening={isListening} 
                    stream={stream} 
                    themeColors={settings.themeColors} 
                    transcriptEntries={transcriptEntries}
                    liveText={transcript}
                    liveTextState={transcript ? 'visible' : 'hidden'}
                    activeSpeaker={activeSpeaker}
                    speakerProfiles={speakerProfiles}
                    handleUpdateSpeakerLabel={handleUpdateSpeakerLabel}
                    onUpdateEntryText={handleUpdateEntryText}
                    showTimestamps={settings.showTimestamps}
                    setShowTimestamps={settings.setShowTimestamps}
                    diarizationEnabled={settings.diarizationSettings.enabled}
                    onOpenChat={() => setShowChat(true)}
                    onTranslateEntry={(id) => handleTranslateEntry(id, settings.translationLanguage)}
                    onReassignSpeaker={handleReassignSpeakerForEntry}
                    transcriptTextSize={settings.transcriptTextSize}
                    setTranscriptTextSize={settings.setTranscriptTextSize}
                    visualizerHeight={visualizerHeight}
                    setVisualizerHeight={setVisualizerHeight}
                    highlightedTopic={highlightedTopic}
                    audioBlobUrl={audioBlobUrl}
                    onDeleteAudio={deleteAudio}
                    recordingDuration={recordingDuration}
                    onStop={stopListening}
                    onStart={startListening}
                    isRecordingEnabled={settings.isRecordingEnabled}
                    setIsRecordingEnabled={settings.setIsRecordingEnabled}
                    isTrueMobile={isTrueMobile}
                    showVisualizerHint={!localStorage.getItem('defscribe-visualizerHintSeen')}
                    proactiveMessage={proactiveMessage}
                    onDismissProactiveMessage={() => setProactiveMessage(null)}
                    visualizerBackground={settings.visualizerBackground}
                    setVisualizerBackground={settings.setVisualizerBackground}
                    transcribeFile={transcribeFile}
                    isTranscribingFile={isTranscribingFile}
                    reframingResults={reframingResults}
                    handleReframeEntry={handleReframeEntry}
                    onOpenCodex={openCodex}
                    censorLanguage={settings.censorLanguage}
                />
              </div>
              <Resizer 
                  onDrag={(dx) => handlePanelLayout('rightPanelWidth', -dx)} 
                  onDoubleClick={handleResetPanelLayout}
                  onCtrlClick={() => handlePanelCollapse('isRightPanelCollapsed')}
                  isPanelCollapsed={settings.panelLayout.isRightPanelCollapsed}
              />
              {settings.panelLayout.isRightPanelCollapsed ? (
                <CollapsedPanelTab title="Analytics" icon="fa-chart-pie" onClick={() => handlePanelCollapse('isRightPanelCollapsed')} />
              ) : (
                <div style={{ width: `${settings.panelLayout.rightPanelWidth}px` }} className="flex-shrink-0 h-full" data-tour-id="analytics-panel">
                  <AnalyticsPanel
                      isSummarizing={analytics.isSummarizing}
                      summary={analytics.summary}
                      summaryStyle={analytics.summaryStyle}
                      onSummarize={(style: SummaryStyle) => analytics.handleSummarize(transcriptEntries.map(e => e.text).join('\n'), style)}
                      actionItems={analytics.actionItems}
                      snippets={analytics.snippets}
                      topics={analytics.topics}
                      titles={analytics.titles}
                      isAnalyzing={analytics.isAnalyzing}
                      isGeneratingTitles={analytics.isGeneratingTitles}
                      onGenerateTitles={() => analytics.handleGenerateTitles(transcriptEntries.map(e => e.text).join('\n'))}
                      hasEnoughContent={transcriptEntries.length > 3}
                      speechAnalytics={analytics.speechAnalytics}
                      segments={segments}
                      speakerProfiles={speakerProfiles}
                      transcriptEntries={transcriptEntries}
                      highlightedTopic={highlightedTopic}
                      onSetHighlightedTopic={setHighlightedTopic}
                      statCardOrder={settings.statCardOrder}
                      setStatCardOrder={settings.setStatCardOrder}
                      isTourActive={isTourActive}
                      currentTourStepId={currentStep?.id}
                      onGenerateCosmicReading={() => analytics.handleGenerateCosmicReading(transcriptEntries.map(e => e.text).join('\n'))}
                      isReading={analytics.isReading}
                      cosmicReading={analytics.cosmicReading}
                      onOpenCodex={openCodex}
                      auraData={analytics.auraData}
                      liveAudioFeatures={liveAudioFeatures}
                      auraPalette={settings.auraPalette}
                      setAuraPalette={settings.setAuraPalette}
                      auraPulsationSpeed={settings.auraPulsationSpeed}
                      setAuraPulsationSpeed={settings.setAuraPulsationSpeed}
                      auraParticleDensity={settings.auraParticleDensity}
                      setAuraParticleDensity={settings.setAuraParticleDensity}
                      auraCustomColors={settings.auraCustomColors}
                      setAuraCustomColors={settings.setAuraCustomColors}
                  />
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* --- Modals and Overlays --- */}
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} onStartTour={handleStartTour} isTrueMobile={isTrueMobile}/>
      <ExportModal
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          transcriptEntries={transcriptEntries}
          speakerProfiles={speakerProfiles}
          speechAnalytics={analytics.speechAnalytics}
          diarizationSettings={settings.diarizationSettings}
          confidence={confidence}
          summary={analytics.summary}
          actionItems={analytics.actionItems}
          snippets={analytics.snippets}
          // FIX: Pass the full TopicSegment array to the ExportModal component, as it expects this type.
          topics={analytics.topics}
      />
      {showChat && <TranscriptChat transcript={transcriptEntries.map(e => e.text).join('\n')} onClose={() => setShowChat(false)} translationLanguage={settings.translationLanguage} isMobile={isMobileView}/>}
      <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} sessions={sessions} onLoad={handleLoadSession} onDelete={handleDeleteSession} />
      {showCodex && <CosmicCodexModal onClose={() => setShowCodex(false)} initialTab={codexInitial.tab} initialEntry={codexInitial.entry} />}
      <YmzoChatModal isOpen={showYmzoChat} onClose={() => setShowYmzoChat(false)} chatInstance={ymzoChatInstance} />

      {wwydMessages.length > 0 && <YmzoOracle messages={wwydMessages} onDismiss={() => setWwydMessages([])} onOpenCodex={openCodex} />}

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

      <div className="fixed top-4 right-4 z-[200] flex flex-col items-end gap-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
        ))}
      </div>
    {/* Diarization debug overlay removed per UX cleanup request */}
      
      {error && <div className="fixed bottom-0 left-0 bg-red-800 text-white p-2 text-sm z-[300]">{`Error: ${error}`}</div>}
    </ErrorBoundary>
  );
};

export default App;