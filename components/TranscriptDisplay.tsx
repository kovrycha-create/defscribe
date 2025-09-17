import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type TranscriptEntry, type SpeakerProfile, type SpeakerId, type ReframingResult } from '../types';
import Tooltip from './Tooltip';
import { CENSOR_WORDS } from '../constants';

const censorProfanity = (text: string, shouldCensor: boolean): string => {
    if (!text) return text;
    if (!shouldCensor) {
        // debug: censorship disabled, return original
        try { console.debug('[TranscriptDisplay] censorProfanity: censorship disabled, returning original text:', text); } catch (e) {}
        return text;
    }
    const regex = new RegExp(`\\b(${Array.from(CENSOR_WORDS).join('|')})\\b`, 'gi');
    const result = text.replace(regex, (match) => '*'.repeat(match.length));
    try { console.debug('[TranscriptDisplay] censorProfanity: original -> censored', { original: text, censored: result }); } catch (e) {}
    return result;
};

const SpeakerTag: React.FC<{ profile: SpeakerProfile; onClick: (speakerId: SpeakerId) => void }> = ({ profile, onClick }) => {
    const speakerNum = profile.id.replace('S', '');
    return (
        <Tooltip content={`Edit ${profile.label}`}>
            <button 
                onClick={() => onClick(profile.id)}
                className="w-6 h-6 text-[11px] font-semibold flex items-center justify-center flex-shrink-0 text-white transition-colors rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: profile.color, boxShadow: '0 1px 4px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' } as React.CSSProperties}
                aria-label={`Speaker ${speakerNum}, ${profile.label}. Click to edit.`}
            >
                {speakerNum}
            </button>
        </Tooltip>
    );
};

interface ActionsMenuProps {
    entry: TranscriptEntry;
    speakerProfiles: Record<SpeakerId, SpeakerProfile>;
    onTranslate: (entryId: string) => void;
    onReassign: (entryId: string, newSpeakerId: SpeakerId) => void;
    onReframe: (entryId: string) => void;
    onClose: () => void;
}

interface ActionsMenuProps {
    entry: TranscriptEntry;
    speakerProfiles: Record<SpeakerId, SpeakerProfile>;
    onTranslate: (entryId: string) => void;
    onReassign: (entryId: string, newSpeakerId: SpeakerId) => void;
    onReframe: (entryId: string) => void;
    onClose: () => void;
    // displayText is the resolved text as shown in the UI (may be censored or original)
    displayText: string;
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({ entry, speakerProfiles, onTranslate, onReassign, onReframe, onClose, displayText }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleAction = (action: () => void) => {
        action();
        onClose();
    };
    
    const handleCopy = () => {
        navigator.clipboard.writeText(displayText).then(() => {
            setCopied(true);
            setTimeout(() => {
                onClose();
            }, 1000);
        });
    };

    return (
        <div 
            ref={menuRef}
            className="absolute right-2 top-8 z-40 w-48 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl animate-[fadeIn_0.1s_ease-out]"
        >
            <ul className="text-sm text-slate-200 divide-y divide-slate-700/50">
                <li>
                    <button onClick={() => handleAction(() => onReframe(entry.id))} className="w-full text-left px-3 py-2 hover:bg-slate-700/50 flex items-center gap-3 transition-colors rounded-t-lg">
                        <i className="fas fa-brain w-4 text-center text-[var(--color-primary)]"></i> 
                        <span>Reframe</span>
                    </button>
                </li>
                <li>
                    <button onClick={() => handleAction(() => onTranslate(entry.id))} className="w-full text-left px-3 py-2 hover:bg-slate-700/50 flex items-center gap-3 transition-colors">
                        <i className="fas fa-language w-4 text-center text-[var(--color-primary)]"></i> 
                        <span>Translate</span>
                    </button>
                </li>
                <li>
                    <button onClick={handleCopy} className="w-full text-left px-3 py-2 hover:bg-slate-700/50 flex items-center gap-3 transition-colors">
                        <i className={`fas ${copied ? 'fa-check text-green-400' : 'fa-copy'} w-4 text-center text-[var(--color-primary)]`}></i> 
                        <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                    </button>
                </li>
                
                <li className="p-2">
                    <p className="text-xs text-slate-400 font-semibold mb-1 px-1">Reassign to:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Object.values(speakerProfiles).map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => handleAction(() => onReassign(entry.id, p.id))} 
                                className="w-full text-left px-2 py-1.5 hover:bg-slate-700/50 rounded-md flex items-center gap-2 whitespace-nowrap transition-colors"
                            >
                                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{backgroundColor: p.color}} />
                                <span className="flex-1 truncate">{p.label}</span>
                            </button>
                        ))}
                    </div>
                </li>
            </ul>
        </div>
    );
};

interface TranscriptEntryComponentProps {
    entry: TranscriptEntry;
    speakerProfiles: Record<SpeakerId, SpeakerProfile>;
    showTimestamps: boolean;
    diarizationEnabled: boolean;
    onSpeakerTagClick: (speakerId: SpeakerId) => void;
    renderHighlightedText: (text: string) => React.ReactNode;
    onTranslateEntry: (entryId: string) => void;
    onReassignSpeaker: (entryId: string, newSpeakerId: SpeakerId) => void;
    onUpdateEntryText: (entryId: string, newText: string) => void;
    transcriptTextSize: 'sm' | 'base' | 'lg' | 'xl';
    reframingResult?: ReframingResult;
    onReframeEntry: (entryId: string) => void;
    onOpenCodex: (tab: string, entryId: string) => void;
    censorLanguage: boolean;
    // The text as displayed in the UI (may be censored or original)
    displayText?: string;
    // optional local save hook to inform parent about saved text (so preserved originals can be updated)
    onLocalSave?: (entryId: string, newText: string) => void;
}

const TranscriptEntryComponent: React.FC<TranscriptEntryComponentProps> = ({
    entry, speakerProfiles, showTimestamps, diarizationEnabled, onSpeakerTagClick,
    renderHighlightedText, onTranslateEntry, onReassignSpeaker, onUpdateEntryText, transcriptTextSize,
    reframingResult, onReframeEntry, onOpenCodex, censorLanguage, displayText, onLocalSave
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(entry.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [activeMenuEntryId, setActiveMenuEntryId] = useState<string | null>(null);

    const textSizeClasses = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-2xl' };

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.focus();
            textarea.style.height = 'auto'; // Reset height
            textarea.style.height = `${textarea.scrollHeight}px`; // Set to content height
            textarea.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editText.trim() && editText.trim() !== entry.text) {
            onUpdateEntryText(entry.id, editText.trim());
            if (typeof onLocalSave === 'function') onLocalSave(entry.id, editText.trim());
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(entry.text);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };
    
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditText(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    const textToRender = displayText ?? censorProfanity(entry.text, censorLanguage);

    return (
        <div className={`relative flex flex-col sm:flex-row items-start gap-x-3 gap-y-1 p-2 rounded-lg hover:bg-slate-800/50 transition-colors fade-in-entry pb-4 group ${activeMenuEntryId === entry.id ? 'z-30' : ''}`}>
            {showTimestamps && (
                <div className="w-full sm:w-24 flex-shrink-0 pt-1">
                    <span className="font-roboto-mono text-xs text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 px-2 py-1 rounded-md">{entry.timestamp}</span>
                </div>
            )}
            <div className={`flex-1 pt-1 ${!showTimestamps ? 'pl-2' : 'sm:pl-0'}`}>
                <div className="flex items-start gap-2">
                    {diarizationEnabled && entry.speakerIds && entry.speakerIds.length > 0 && (
                        <div className="flex items-center justify-center gap-1 pt-0">
                            {entry.speakerIds.map(id => speakerProfiles[id] ? <SpeakerTag key={id} profile={speakerProfiles[id]} onClick={onSpeakerTagClick} /> : null)}
                        </div>
                    )}
                    <div className="flex-1">
                        {isEditing ? (
                            <textarea
                                ref={textareaRef}
                                value={editText}
                                onChange={handleTextChange}
                                onBlur={handleSave}
                                onKeyDown={handleKeyDown}
                                className={`w-full bg-slate-700/50 text-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none overflow-hidden ${textSizeClasses[transcriptTextSize]}`}
                                rows={1}
                            />
                        ) : (
                            <>
                                <p onClick={() => setIsEditing(true)} className={`text-slate-300 leading-relaxed cursor-pointer ${textSizeClasses[transcriptTextSize]}`}>{renderHighlightedText(textToRender)}</p>
                                {entry.isTranslating && <p className="text-sm text-slate-500 italic mt-1 pl-2">Translating...</p>}
                                {entry.translatedText && <p className="text-sm text-slate-400 italic mt-1 pl-2 border-l-2 border-slate-600">{entry.translatedText}</p>}
                            </>
                        )}
                         {reframingResult && (
                            <div className="reframing-panel">
                                {reframingResult.isLoading ? (
                                    <div className="reframing-loader">
                                        <i className="fas fa-spinner fa-spin text-sm text-[var(--color-secondary)]"></i>
                                        <span>Ymzo is contemplating...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-semibold text-slate-400">Thought Pattern: </span>
                                            <button onClick={() => onOpenCodex('patterns', reframingResult.codexLink)} className="reframing-pattern-link">
                                                {reframingResult.thoughtPattern}
                                            </button>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-400">Reframed Perspective:</p>
                                            <p className="text-purple-200 italic">"{reframingResult.reframedText}"</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <Tooltip content="Actions">
                    <button onClick={(e) => { e.stopPropagation(); setActiveMenuEntryId(prev => prev === entry.id ? null : entry.id); }} className="w-6 h-6 rounded-md hover:bg-slate-700/80 flex items-center justify-center actions-menu-trigger">
                        <i className="fas fa-ellipsis-v text-xs"></i>
                    </button>
                </Tooltip>
            </div>
            {activeMenuEntryId === entry.id && (
                <ActionsMenu entry={entry} speakerProfiles={speakerProfiles} onTranslate={onTranslateEntry} onReassign={onReassignSpeaker} onReframe={onReframeEntry} onClose={() => setActiveMenuEntryId(null)} displayText={textToRender} />
            )}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/80 to-transparent transition-all duration-500 group-hover:w-[95%] shadow-[0_0_8px_var(--color-primary)]"></div>
        </div>
    );
};

interface TranscriptDisplayProps {
  entries: TranscriptEntry[];
  isListening: boolean;
  liveText: string;
  liveTextState: 'visible' | 'fading-out' | 'hidden';
  activeSpeaker: SpeakerId | null;
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
  showTimestamps: boolean;
  diarizationEnabled: boolean;
  onSpeakerTagClick: (speakerId: SpeakerId) => void;
  searchQuery: string;
  highlightedTopic: string | null;
  containerRef: React.RefObject<HTMLDivElement>;
  endRef: React.RefObject<HTMLDivElement>;
  onTranslateEntry: (entryId: string) => void;
  onReassignSpeaker: (entryId: string, newSpeakerId: SpeakerId) => void;
  onUpdateEntryText: (entryId: string, newText: string) => void;
  transcriptTextSize: 'sm' | 'base' | 'lg' | 'xl';
  isTrueMobile: boolean;
  reframingResults: Record<string, ReframingResult>;
  onReframeEntry: (entryId: string) => void;
  onOpenCodex: (tab: string, entryId: string) => void;
  censorLanguage: boolean;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  entries, isListening, liveText, liveTextState, activeSpeaker, speakerProfiles,
  showTimestamps, diarizationEnabled, onSpeakerTagClick, searchQuery, highlightedTopic,
  containerRef, endRef, onTranslateEntry, onReassignSpeaker, onUpdateEntryText,
  transcriptTextSize, isTrueMobile, reframingResults, onReframeEntry, onOpenCodex,
  censorLanguage
}) => {
  const textSizeClasses = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-2xl' };

    // Displayed live speaker smoothing: keep the last non-null active speaker so UI doesn't flicker
    const [displayedLiveSpeaker, setDisplayedLiveSpeaker] = useState<SpeakerId | null>(activeSpeaker);
    const lastSeenRef = useRef<SpeakerId | null>(activeSpeaker);

            // Preserve original (uncensored) texts locally so toggling censorship restores originals.
            // This is intentionally kept local to avoid changing upstream data shapes here.
            const preservedOriginalsRef = useRef<Record<string, string>>({});

            // Helper to persist preserved originals to localStorage and keep ref in sync.
            const savePreservedOriginal = (entryId: string, text: string) => {
                preservedOriginalsRef.current[entryId] = text;
                try {
                    // Persist the whole map as the one-off migration source
                    window.localStorage.setItem('defscribe_original_texts', JSON.stringify(preservedOriginalsRef.current));
                } catch (err) {
                    console.debug('[TranscriptDisplay] failed to persist preserved original', err);
                }
            };

        // Helper to detect whether censorship would actually change a text
        const textWouldChangeByCensoring = (text: string) => {
            return censorProfanity(text, true) !== text;
        };

        // On mount: one-off migration to restore original texts from recent sessions (if any)
        useEffect(() => {
            try {
                const raw = window.localStorage.getItem('defscribe_original_texts');
                        if (raw) {
                            const parsed = JSON.parse(raw) as Record<string, string>;
                            preservedOriginalsRef.current = { ...preservedOriginalsRef.current, ...parsed };
                            // remove after restoring (one-off)
                            window.localStorage.removeItem('defscribe_original_texts');
                            console.debug('[TranscriptDisplay] Restored preserved originals from localStorage, then cleared migration key.');
                        }

                        // Also adopt any originalText fields that might exist on entries (newer sessions)
                        entries.forEach(e => {
                            const maybeOriginal = (e as any).originalText;
                            if (typeof maybeOriginal === 'string' && maybeOriginal.length > 0) {
                                savePreservedOriginal(e.id, maybeOriginal);
                            }
                        });
            } catch (err) {
                console.debug('[TranscriptDisplay] migration restore failed', err);
            }
            // run only once on mount
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // When censorship is enabled, capture originals for entries that would be changed.
        useEffect(() => {
            if (!censorLanguage) return;
                    entries.forEach(e => {
                        if (!preservedOriginalsRef.current[e.id] && textWouldChangeByCensoring(e.text)) {
                            savePreservedOriginal(e.id, e.text);
                        }
                    });
        }, [censorLanguage, entries]);

        // Helper to resolve what text to render for an entry given censorship toggle and preserved originals.
        const resolvedTextForEntry = (entry: TranscriptEntry) => {
            // prefer preserved original if present and censorship disabled
            const preserved = preservedOriginalsRef.current[entry.id];
            if (!censorLanguage && preserved) {
                return preserved;
            }
            // if censorship enabled and we have preserved original, censor that (so we never lose the original)
            if (censorLanguage && preserved) {
                return censorProfanity(preserved, true);
            }
            // fallback: use entry.text (may already be censored or original)
            return censorProfanity(entry.text, censorLanguage);
        };

    useEffect(() => {
        if (activeSpeaker) {
            lastSeenRef.current = activeSpeaker;
            setDisplayedLiveSpeaker(activeSpeaker);
        }
        // if activeSpeaker becomes null, intentionally keep showing lastSeenRef.current to avoid flicker
    }, [activeSpeaker]);

  const renderHighlightedText = useCallback((text: string): React.ReactNode => {
    if (!searchQuery.trim() && !highlightedTopic) {
      return text;
    }

    let nodes: (string | React.ReactElement)[] = [text];

    if (highlightedTopic) {
      const topicWords = highlightedTopic.split(/\s+/).filter(w => w.length > 2);
      if (topicWords.length > 0) {
        const topicRegex = new RegExp(`\\b(${topicWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
        nodes = nodes.flatMap((node, index) => typeof node === 'string' ? node.split(topicRegex).map((part, partIndex) => partIndex % 2 === 1 ? <span key={`${index}-${partIndex}-topic`} className="topic-highlight">{part}</span> : part) : node);
      }
    }

    if (searchQuery.trim()) {
      const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const searchRegex = new RegExp(`(${escapedQuery})`, 'gi');
      nodes = nodes.flatMap((node, index) => {
        if (typeof node === 'string') {
          return node.split(searchRegex).map((part, partIndex) => partIndex % 2 === 1 ? <mark key={`${index}-${partIndex}-search`}>{part}</mark> : part);
        }
        if (React.isValidElement<{ children?: React.ReactNode }>(node) && typeof node.props.children === 'string') {
          const children = node.props.children.split(searchRegex).map((part, partIndex) => partIndex % 2 === 1 ? <mark key={`${index}-${partIndex}-search-nested`}>{part}</mark> : part);
          return React.cloneElement(node, { ...node.props, key: node.key || index }, children);
        }
        return node;
      });
    }

    return <>{nodes}</>;
  }, [searchQuery, highlightedTopic]);

    // For live text, if we previously preserved an original for a "live" placeholder id use it;
    // otherwise apply the same censorship rules as entries (no persistent storage used for ephemeral live text).
    const liveTextToRender = censorProfanity(liveText, censorLanguage);

    return (
        <div ref={containerRef} className="h-full overflow-y-auto pr-2 pb-4">
            {entries.map((entry) => {
                const displayText = resolvedTextForEntry(entry);
                return (
                                <TranscriptEntryComponent
                        key={entry.id}
                        entry={entry}
                        speakerProfiles={speakerProfiles}
                        showTimestamps={showTimestamps}
                        diarizationEnabled={diarizationEnabled}
                        onSpeakerTagClick={onSpeakerTagClick}
                        renderHighlightedText={renderHighlightedText}
                        onTranslateEntry={onTranslateEntry}
                        onReassignSpeaker={onReassignSpeaker}
                        // wrap update so preserved originals stay in sync when the user edits text
                                                onUpdateEntryText={(entryId, newText) => {
                                                    // update preserved original to the newText when the user edits, keep persisted copy in sync
                                                    savePreservedOriginal(entryId, newText);
                                                    onUpdateEntryText(entryId, newText);
                                                }}
                                                onLocalSave={(entryId, newText) => {
                                                    savePreservedOriginal(entryId, newText);
                                                }}
                        transcriptTextSize={transcriptTextSize}
                        reframingResult={reframingResults[entry.id]}
                        onReframeEntry={onReframeEntry}
                        onOpenCodex={onOpenCodex}
                        censorLanguage={censorLanguage}
                        // pass computed displayText for copy and menu actions
                        {...{ displayText }}
                    />
                );
            })}
      
      {entries.length === 0 && !isListening && (
        <div className="relative overflow-hidden p-2 text-center">
          <p className={`animate-marquee text-slate-400 italic ${textSizeClasses[transcriptTextSize]}`}>
            Welcome to DefScribe. Press <span className="text-green-400 font-semibold">Start Listening</span> to begin.
          </p>
          {isTrueMobile && (
            <div className="text-slate-400 mt-4 px-2">
                <p className="text-xl font-bold text-amber-300">Mobile devices do not support live transcription.</p>
                <p className="text-sm mt-1">Your transcript will appear here after you press "Stop Listening".</p>
            </div>
          )}
        </div>
      )}
      
      {isListening && liveTextState !== 'hidden' && (
          <div 
            className={`group relative flex items-start gap-3 p-2 rounded-lg text-slate-400 transition-all duration-500 ease-out 
              ${liveTextState === 'fading-out' ? 'opacity-0' : 'opacity-100'}
              ${activeSpeaker ? 'border-l-4' : ''}`}
            style={{ borderLeftColor: activeSpeaker && speakerProfiles[activeSpeaker] ? speakerProfiles[activeSpeaker].color : 'transparent' }}
            aria-live="polite"
            aria-atomic="true"
          >
              {showTimestamps && (
                  <div className="w-24 flex-shrink-0 pt-1">
                      <span className="font-roboto-mono text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md">Now...</span>
                  </div>
              )}
              <div className={`flex-1 pt-1 ${!showTimestamps ? 'pl-2' : ''}`}>
                  <div className="flex items-start gap-2">
                                            {diarizationEnabled && (displayedLiveSpeaker || activeSpeaker) && speakerProfiles[(displayedLiveSpeaker || activeSpeaker) as SpeakerId] && (
                                                    <div className="flex items-center justify-center gap-1 pt-0 transition-all duration-300">
                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white hex-clip" style={{ backgroundColor: speakerProfiles[(displayedLiveSpeaker || activeSpeaker) as SpeakerId].color, opacity: 0.95, transition: 'background-color 200ms ease' }}>
                                                                {(displayedLiveSpeaker || activeSpeaker)!.replace('S','')}
                                                            </div>
                                                    </div>
                                            )}
                      <div className="flex-1">
                          <p className={`italic text-slate-300 ${textSizeClasses[transcriptTextSize]}`} style={{ lineHeight: 1.5 }}>
                              {renderHighlightedText(liveTextToRender)}
                              {liveTextState === 'visible' && <span className="inline-block w-0.5 bg-white/70 ml-1 align-text-top animate-[cursor-blink_1s_step-end_infinite]" style={{ height: '1em' }} />}
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}
      <div ref={endRef} />
    </div>
  );
};

export default TranscriptDisplay;
