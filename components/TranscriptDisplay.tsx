import React, { useState, useEffect, useRef } from 'react';
import { type TranscriptEntry, type SpeakerProfile, type SpeakerId } from '../types';
import Tooltip from './Tooltip';

const SpeakerTag: React.FC<{ profile: SpeakerProfile; onClick: (speakerId: SpeakerId) => void }> = ({ profile, onClick }) => {
  const speakerNum = profile.id.replace('S', '');
  return (
    <Tooltip content={`Edit ${profile.label}`}>
      <button 
        onClick={() => onClick(profile.id)}
        className="w-8 h-8 text-xs font-bold flex items-center justify-center flex-shrink-0 text-white shadow-md transition-all duration-300 hover:scale-110 hover:animate-[pulse-glow_1.5s_ease-in-out_infinite] hex-clip"
        style={{ '--color': profile.color, backgroundColor: profile.color } as React.CSSProperties}
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
    onClose: () => void;
}

const ActionsMenu: React.FC<ActionsMenuProps> = ({ entry, speakerProfiles, onTranslate, onReassign, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);

    // Close menu when clicking outside
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

    const handleTranslate = () => {
        onTranslate(entry.id);
        onClose();
    };
    
    const handleCopy = () => {
        navigator.clipboard.writeText(entry.text).then(() => {
            setCopied(true);
            setTimeout(() => {
                onClose();
            }, 1000);
        });
    };

    const handleReassign = (newSpeakerId: SpeakerId) => {
        onReassign(entry.id, newSpeakerId);
        onClose();
    };

    return (
        <div 
            ref={menuRef}
            className="absolute right-2 top-8 z-40 w-48 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl animate-[fadeIn_0.1s_ease-out]"
        >
            <ul className="text-sm text-slate-200 divide-y divide-slate-700/50">
                <li>
                    <button onClick={handleTranslate} className="w-full text-left px-3 py-2 hover:bg-slate-700/50 flex items-center gap-3 transition-colors rounded-t-lg">
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
                                onClick={() => handleReassign(p.id)} 
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
  transcriptTextSize: 'sm' | 'base' | 'lg' | 'xl';
  isTrueMobile: boolean;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  entries, isListening, liveText, liveTextState, activeSpeaker, speakerProfiles,
  showTimestamps, diarizationEnabled, onSpeakerTagClick, searchQuery, highlightedTopic,
  containerRef, endRef, onTranslateEntry, onReassignSpeaker, transcriptTextSize, isTrueMobile
}) => {

  const [activeMenuEntryId, setActiveMenuEntryId] = useState<string | null>(null);
  const textSizeClasses = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-2xl' };

  const renderHighlightedText = React.useCallback((text: string): React.ReactNode => {
    if (!searchQuery.trim() && !highlightedTopic) {
      return text;
    }

    let nodes: (string | React.ReactElement)[] = [text];

    // 1. Topic Highlighting
    if (highlightedTopic) {
      const topicWords = highlightedTopic.split(/\s+/).filter(w => w.length > 2);
      if (topicWords.length > 0) {
        const topicRegex = new RegExp(`\\b(${topicWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
        nodes = nodes.flatMap((node, index) => {
          if (typeof node === 'string') {
            return node.split(topicRegex).map((part, partIndex) => {
              if (partIndex % 2 === 1) {
                return <span key={`${index}-${partIndex}-topic`} className="topic-highlight">{part}</span>;
              }
              return part;
            });
          }
          return node;
        });
      }
    }

    // 2. Search Query Highlighting
    if (searchQuery.trim()) {
      const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const searchRegex = new RegExp(`(${escapedQuery})`, 'gi');
      nodes = nodes.flatMap((node, index) => {
        if (typeof node === 'string') {
          return node.split(searchRegex).map((part, partIndex) => {
            if (partIndex % 2 === 1) {
              return <mark key={`${index}-${partIndex}-search`}>{part}</mark>;
            }
            return part;
          });
        }
        if (React.isValidElement<{ children?: React.ReactNode }>(node) && typeof node.props.children === 'string') {
          const children = node.props.children.split(searchRegex).map((part, partIndex) => {
            if (partIndex % 2 === 1) {
              return <mark key={`${index}-${partIndex}-search-nested`}>{part}</mark>;
            }
            return part;
          });
          return React.cloneElement(node, { ...node.props, key: node.key || index }, children);
        }
        return node;
      });
    }

    return <>{nodes}</>;
  }, [searchQuery, highlightedTopic]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto pr-2">
      {entries.map((entry) => (
        <div 
            key={entry.id} 
            className={`relative flex flex-col sm:flex-row items-start gap-x-3 gap-y-1 p-2 rounded-lg hover:bg-slate-800/50 transition-colors fade-in-entry pb-4 group ${activeMenuEntryId === entry.id ? 'z-30' : ''}`}
        >
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
                        <p className={`text-slate-300 leading-relaxed ${textSizeClasses[transcriptTextSize]}`}>{renderHighlightedText(entry.text)}</p>
                        {entry.isTranslating && <p className="text-sm text-slate-500 italic mt-1 pl-2">Translating...</p>}
                        {entry.translatedText && <p className="text-sm text-slate-400 italic mt-1 pl-2 border-l-2 border-slate-600">{entry.translatedText}</p>}
                    </div>
                </div>
            </div>
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <Tooltip content="Actions">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setActiveMenuEntryId(prev => prev === entry.id ? null : entry.id); 
                      }} 
                      className="w-6 h-6 rounded-md hover:bg-slate-700/80 flex items-center justify-center actions-menu-trigger"
                    >
                        <i className="fas fa-ellipsis-v text-xs"></i>
                    </button>
                </Tooltip>
            </div>

            {activeMenuEntryId === entry.id && (
                <ActionsMenu
                    entry={entry}
                    speakerProfiles={speakerProfiles}
                    onTranslate={onTranslateEntry}
                    onReassign={onReassignSpeaker}
                    onClose={() => setActiveMenuEntryId(null)}
                />
            )}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/80 to-transparent transition-all duration-500 group-hover:w-[95%] shadow-[0_0_8px_var(--color-primary)]"></div>
        </div>
      ))}
      
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
                      {diarizationEnabled && activeSpeaker && speakerProfiles[activeSpeaker] && (
                          <div className="flex items-center justify-center gap-1 pt-0">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white hex-clip" style={{ backgroundColor: speakerProfiles[activeSpeaker].color, opacity: 0.9 }}>
                                {activeSpeaker.replace('S','')}
                              </div>
                          </div>
                      )}
                      <div className="flex-1">
                          <p className={`italic leading-relaxed text-slate-300 ${textSizeClasses[transcriptTextSize]}`}>
                              {renderHighlightedText(liveText)}
                              {liveTextState === 'visible' && <span className="inline-block w-0.5 h-4 bg-white/70 ml-1 animate-[cursor-blink_1s_step-end_infinite]"></span>}
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
