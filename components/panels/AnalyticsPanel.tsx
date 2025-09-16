import React, { useState, useMemo } from 'react';
import { type SummaryStyle, type ActionItem, type Snippet, type SpeakerProfile, type SpeakerId, type SpeechAnalytics, type TranscriptEntry, type StatCardKey, type GeneratedTitle } from '../../types';
import TalkTimeVisualizer from '../TalkTimeVisualizer';
import AnalyticsItemLoader from '../AnalyticsItemLoader';

interface AnalyticsPanelProps {
  isSummarizing: boolean;
  summary: string;
  summaryStyle: SummaryStyle | null;
  onSummarize: (style: SummaryStyle) => void;
  actionItems: ActionItem[];
  snippets: Snippet[];
  topics: string[];
  titles: GeneratedTitle[];
  isAnalyzing: boolean;
  isGeneratingTitles: boolean;
  onGenerateTitles: () => void;
  hasEnoughContent: boolean;
  speechAnalytics: Partial<SpeechAnalytics>;
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
  transcriptEntries: TranscriptEntry[];
  highlightedTopic: string | null;
  onSetHighlightedTopic: (topic: string | null) => void;
  statCardOrder: StatCardKey[];
  setStatCardOrder: (order: StatCardKey[]) => void;
  isTourActive?: boolean;
  currentTourStepId?: string;
}

type ActiveTab = 'summary' | 'actions' | 'snippets' | 'stats';

const SummaryButton: React.FC<{ style: SummaryStyle; current: SummaryStyle | null; onClick: () => void; children: React.ReactNode; }> = ({ style, current, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex-1 cosmo-button ${style === current ? 'bg-[var(--color-primary)] text-black border-transparent' : ''}`}
  >
    {children}
  </button>
);

const StatCard: React.FC<{ icon: string; label: string; value: string | number; unit?: string; }> = ({ icon, label, value, unit }) => (
    <div className="stat-card-full p-3 flex items-center gap-2 rounded-lg">
        <div className="text-slate-500">
            <i className="fas fa-grip-vertical"></i>
        </div>
        <div className="w-10 h-10 bg-slate-900/50 rounded-full flex items-center justify-center text-[var(--color-accent)] text-xl flex-shrink-0 border-2 border-[rgba(var(--color-accent-rgb),0.2)]">
            <i className={`fas ${icon}`}></i>
        </div>
        <div className="flex-1 text-right">
            <div className="text-sm text-slate-300">{label}</div>
            <div className="text-2xl font-bold text-white">
                {value}
                {unit && <span className="text-base font-normal text-slate-300 ml-1">{unit}</span>}
            </div>
        </div>
    </div>
);

const TabButton: React.FC<{
  name: string;
  tab: ActiveTab;
  activeTab: ActiveTab;
  onClick: (tab: ActiveTab) => void;
  count?: number;
}> = ({ name, tab, activeTab, onClick, count }) => {
  const isActive = activeTab === tab;
  return (
    <button
      onClick={() => onClick(tab)}
      className={`relative flex-1 text-center font-semibold px-2 py-4 text-sm md:px-3 md:py-2 transition-all duration-300 rounded-t-lg border border-b-0
        ${
          isActive
            ? "bg-[rgba(var(--color-primary-rgb),0.3)] text-white border-[rgba(var(--color-primary-rgb),0.5)]" // Brighter, visible border
            : "bg-[rgba(var(--color-primary-rgb),0.1)] text-slate-400 border-transparent hover:bg-[rgba(var(--color-primary-rgb),0.2)] hover:border-[rgba(var(--color-primary-rgb),0.4)] hover:border-b-transparent" // Darker, transparent border until hover
        }`}
    >
      {name}
      {count != null && count > 0 && (
        <span className="absolute top-1 right-2 text-xs bg-[var(--color-secondary)] text-white rounded-full h-5 w-5 flex items-center justify-center font-bold">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
};
TabButton.displayName = 'TabButton';


const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ 
  isSummarizing, summary, summaryStyle, onSummarize, actionItems, 
  snippets, topics, titles, isAnalyzing, isGeneratingTitles, onGenerateTitles, hasEnoughContent,
  speechAnalytics, speakerProfiles, transcriptEntries,
  highlightedTopic, onSetHighlightedTopic, statCardOrder, setStatCardOrder,
  isTourActive, currentTourStepId
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<ActiveTab>('stats');
  const [copiedTitleId, setCopiedTitleId] = useState<string | null>(null);

  // If the tour is active and on the summary step, force the summary tab to be open.
  // Otherwise, use the user-controlled tab state.
  const activeTab = isTourActive && currentTourStepId === 'summary' ? 'summary' : localActiveTab;

  const handleTabClick = (tab: ActiveTab) => {
    setLocalActiveTab(tab);
  };

  const hasEnoughContentForAnalytics = useMemo(() => {
    const totalWords = transcriptEntries.map(e => e.text).join(' ').split(/\s+/).filter(Boolean).length;
    return totalWords > 20;
  }, [transcriptEntries]);

  const hasAnyAnalytics = speechAnalytics.wpm !== undefined || actionItems.length > 0 || snippets.length > 0;
  
  const [draggedItem, setDraggedItem] = useState<StatCardKey | null>(null);
  const [dragOverItem, setDragOverItem] = useState<StatCardKey | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, statKey: StatCardKey) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItem(statKey);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, statKey: StatCardKey) => {
        e.preventDefault();
        if (statKey !== dragOverItem) {
            setDragOverItem(statKey);
        }
    };
    
    const handleDragLeave = () => {
        setDragOverItem(null);
    };

    const handleDrop = () => {
        if (!draggedItem || !dragOverItem || draggedItem === dragOverItem) return;

        const draggedIndex = statCardOrder.indexOf(draggedItem);
        const dropIndex = statCardOrder.indexOf(dragOverItem);
        
        const newOrder = [...statCardOrder];
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dropIndex, 0, removed);

        setStatCardOrder(newOrder);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverItem(null);
    };
    
    const handleCopyTitle = (title: GeneratedTitle) => {
        navigator.clipboard.writeText(title.text);
        setCopiedTitleId(title.id);
        setTimeout(() => setCopiedTitleId(null), 2000);
    }
    
    const allStats: Record<StatCardKey, { icon: string; label: string; value: string | number; unit?: string; }> = {
        wpm: { icon: "fa-tachometer-alt", label: "Avg. Speed", value: speechAnalytics.wpm?.toFixed(0) || 0, unit: "WPM" },
        duration: { icon: "fa-stopwatch", label: "Duration", value: speechAnalytics.duration ? new Date(speechAnalytics.duration * 1000).toISOString().substr(14, 5) : '00:00', unit: "MM:SS" },
        speakingRateLabel: { icon: "fa-rocket", label: "Speaking Rate", value: speechAnalytics.speakingRateLabel || 'Medium' },
        words: { icon: "fa-file-word", label: "Total Words", value: speechAnalytics.words || 0 },
        avgSentenceLength: { icon: "fa-paragraph", label: "Avg. Sentence", value: speechAnalytics.avgSentenceLength?.toFixed(1) || 0, unit: "words" },
        vocabularyRichness: { icon: "fa-book-open", label: "Vocabulary", value: speechAnalytics.vocabularyRichness?.toFixed(1) || 0, unit: "% rich" },
        questionCount: { icon: "fa-question-circle", label: "Questions Asked", value: speechAnalytics.questionCount || 0 },
        fillers: { icon: "fa-comment-dots", label: "Filler Words", value: speechAnalytics.fillers || 0 },
        pauses: { icon: "fa-pause-circle", label: "Pauses", value: speechAnalytics.pauses || 0 },
    };

  return (
    <div className="flex flex-col h-full cosmo-panel md:rounded-2xl p-2 md:p-4 gap-4 overflow-hidden">
      <header className="flex items-end justify-center z-10 -mx-2 md:-mx-4">
        <nav className="flex w-full px-2 md:px-4 border-b border-[rgba(var(--color-primary-rgb),0.5)]">
            <TabButton name="Stats" tab="stats" activeTab={activeTab} onClick={handleTabClick} />
            <TabButton name="Summary" tab="summary" activeTab={activeTab} onClick={handleTabClick} />
            <TabButton name="Actions" tab="actions" activeTab={activeTab} onClick={handleTabClick} count={actionItems.length} />
            <TabButton name="Snippets" tab="snippets" activeTab={activeTab} onClick={handleTabClick} count={snippets.length} />
        </nav>
      </header>
      
      {!hasAnyAnalytics && !isAnalyzing ? (
          <EmptyState text={hasEnoughContentForAnalytics ? "No analytics available." : "Not enough content to generate analytics."} />
      ) : isAnalyzing && activeTab !== 'stats' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 z-10">
            <i className="fas fa-brain text-4xl mb-3 spinner-animation"></i>
            <p>Analyzing transcript...</p>
        </div>
      ) : (
        <>
            {activeTab === 'summary' && (
            <div className="flex-1 flex flex-col min-h-0 z-10">
                <div className="flex-1 flex flex-col min-h-0">
                    <TalkTimeVisualizer talkTimeData={speechAnalytics.talkTime || {}} speakerProfiles={speakerProfiles} />
                    <div className="flex gap-2 mb-3" data-tour-id="summary-buttons">
                        <SummaryButton style="basic" current={summaryStyle} onClick={() => onSummarize('basic')}>Basic</SummaryButton>
                        <SummaryButton style="detailed" current={summaryStyle} onClick={() => onSummarize('detailed')}>Detailed</SummaryButton>
                        <SummaryButton style="full" current={summaryStyle} onClick={() => onSummarize('full')}>Full</SummaryButton>
                    </div>
                    {isSummarizing ? (
                        <AnalyticsItemLoader />
                    ) : (
                        <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-4 prose prose-sm prose-invert max-w-none prose-p:text-slate-300">
                            <p style={{ whiteSpace: 'pre-wrap' }}>{summary}</p>
                        </div>
                    )}
                    {(topics || []).length > 0 && (
                        <div className="pt-3 mt-3 border-t border-[rgba(var(--color-primary-rgb),0.2)]">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Topics</h3>
                            <div className="flex flex-wrap gap-2">
                                {topics.map(topic => (
                                    <button 
                                        key={topic} 
                                        onClick={() => onSetHighlightedTopic(topic === highlightedTopic ? null : topic)}
                                        className={`px-2 py-1 text-xs rounded-full transition-colors duration-200 
                                            ${highlightedTopic === topic 
                                                ? 'bg-[var(--color-accent)] text-black font-bold shadow-[0_0_8px_rgba(var(--color-accent-rgb),0.7)]' 
                                                : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/40'
                                            }`}
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="pt-3 mt-auto">
                    <button onClick={onGenerateTitles} disabled={isGeneratingTitles || !hasEnoughContent} className="cosmo-button w-full h-10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isGeneratingTitles ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                        <span>{isGeneratingTitles ? 'Generating...' : 'Suggest Titles'}</span>
                    </button>
                    {titles.length > 0 && (
                        <div className="mt-3 space-y-2 animate-[fadeIn_0.3s_ease-out]">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase">Suggestions:</h4>
                        {titles.map(title => (
                            <button key={title.id} onClick={() => handleCopyTitle(title)} className="w-full text-left text-sm p-2 rounded-md bg-slate-800/50 hover:bg-slate-700/50 transition-colors flex justify-between items-center group">
                            <span className="flex-1 pr-2">{title.text}</span>
                            {copiedTitleId === title.id ? (
                                <span className="text-green-400 text-xs font-bold">Copied!</span>
                            ) : (
                                <i className="fas fa-copy text-slate-500 group-hover:text-slate-300 transition-colors"></i>
                            )}
                            </button>
                        ))}
                        </div>
                    )}
                </div>
            </div>
            )}
            
            {activeTab === 'stats' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 z-10">
                    {!speechAnalytics.wpm ? <EmptyState text="No stats available." /> : (
                        <div className="flex flex-col gap-3">
                            {statCardOrder.map(key => {
                                const stat = allStats[key];
                                if (!stat) return null;

                                const isBeingDragged = draggedItem === key;
                                const isDragTarget = dragOverItem === key;

                                return (
                                    <div
                                        key={key}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, key)}
                                        onDragOver={(e) => handleDragOver(e, key)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onDragEnd={handleDragEnd}
                                        className={`transition-all duration-200 cursor-move rounded-lg ${isBeingDragged ? 'opacity-30 scale-95' : 'opacity-100'}`}
                                    >
                                        {isDragTarget && <div className="h-2 bg-[var(--color-primary)]/50 rounded-full my-1 animate-pulse" />}
                                        <StatCard
                                            icon={stat.icon}
                                            label={stat.label}
                                            value={stat.value}
                                            unit={stat.unit}
                                        />
                                    </div>
                                );
                           })}
                        </div>
                    )}
                </div>
            )}


            {activeTab === 'actions' && (
                <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {isAnalyzing ? <AnalyticsItemLoader /> : actionItems.length === 0 ? <EmptyState text="No action items found." /> : (
                      actionItems.map(item => <ListItem key={item.id} icon={item.type === 'action' ? 'fa-bolt' : 'fa-gavel'} content={item.content} />)
                    )}
                </div>
            )}

            {activeTab === 'snippets' && (
                <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {isAnalyzing ? <AnalyticsItemLoader /> : snippets.length === 0 ? <EmptyState text="No key snippets found." /> : (
                      snippets.map(item => <ListItem key={item.id} icon={item.type === 'quote' ? 'fa-quote-left' : item.type === 'question' ? 'fa-question-circle' : 'fa-lightbulb'} content={item.content} />)
                    )}
                </div>
            )}
        </>
      )}
    </div>
  );
};

const EmptyState: React.FC<{text: string}> = ({ text }) => (
    <div className="flex flex-col items-center justify-center text-slate-400 h-full p-6 text-center">
        <svg className="w-16 h-16 mb-4 text-slate-500" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M49.22 23.36C48.56 15.34 41.36 9 32.99 9C25.96 9 20.2 13.58 18.23 20.03C17.92 19.96 17.6 19.92 17.27 19.92C14.02 19.92 11.33 22.61 11.33 25.86C11.33 29.11 14.02 31.8 17.27 31.8H48.41C52.73 31.8 56.26 28.27 56.26 23.95C56.26 19.86 53.18 16.51 49.34 16.14" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'rgba(var(--color-primary-rgb), 0.4)' }}/>
            <path d="M22 38L32 48L42 38" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'rgba(var(--color-primary-rgb), 0.6)' }}/>
            <path d="M32 48V26" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'rgba(var(--color-primary-rgb), 0.6)' }}/>
        </svg>
        <p>{text}</p>
    </div>
);

const ListItem: React.FC<{icon: string, content: string}> = ({icon, content}) => (
    <div className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg">
        <i className={`fas ${icon} text-[var(--color-accent)] pt-1 w-5 text-center`}></i>
        <p className="flex-1 text-sm text-slate-300">{content}</p>
    </div>
)

export default AnalyticsPanel;