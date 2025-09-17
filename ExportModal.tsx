// FIX: Imported `useMemo` from React to resolve the 'Cannot find name' error.
import React, { useState, useCallback, useMemo } from 'react';
import { type TranscriptEntry, type SpeakerProfile, type SpeakerId, type SpeechAnalytics, type DiarizationSettings, type ActionItem, type Snippet, type TopicSegment } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptEntries: TranscriptEntry[];
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
  speechAnalytics: Partial<SpeechAnalytics>;
  diarizationSettings: DiarizationSettings;
  confidence: number;
  summary: string;
  actionItems: ActionItem[];
  snippets: Snippet[];
  topics: TopicSegment[];
}

const Toggle: React.FC<{label: string, enabled: boolean, setEnabled: (e: boolean) => void}> = ({ label, enabled, setEnabled }) => (
    <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <button onClick={() => setEnabled(!enabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}/>
        </button>
    </div>
);

const ExportModal: React.FC<ExportModalProps> = ({ 
    isOpen, onClose, transcriptEntries, speakerProfiles, speechAnalytics, diarizationSettings, confidence,
    summary, actionItems, snippets, topics 
}) => {
    const modalRef = React.useRef<HTMLDivElement>(null);
    useFocusTrap(modalRef, isOpen);
    
    const [includeStats, setIncludeStats] = useState(true);
    const [includeSpeakers, setIncludeSpeakers] = useState(diarizationSettings.enabled);
    const [includeSummary, setIncludeSummary] = useState(true);
    const [includeActionItems, setIncludeActionItems] = useState(true);
    const [includeSnippets, setIncludeSnippets] = useState(true);
    const [includeTopics, setIncludeTopics] = useState(true);
    
    const [copyButtonText, setCopyButtonText] = useState('Copy as Plain Text');
    const [copyMarkdownButtonText, setCopyMarkdownButtonText] = useState('Copy as Markdown');
    
    const topicTexts = useMemo(() => topics.map(t => t.text), [topics]);

    const generateFormattedTranscript = useCallback((forPdf: boolean = false): string => {
        let output = '';
        const nl = forPdf ? '\n\n' : '\n';

        if (includeStats && speechAnalytics && Object.keys(speechAnalytics).length > 0) {
            const stats = speechAnalytics;
            output += '--- TRANSCRIPT STATISTICS ---' + nl;
            output += `Duration: ${stats.duration ? new Date(stats.duration * 1000).toISOString().substr(14, 5) : 'N/A'} MM:SS` + nl;
            output += `Average Speed: ${stats.wpm?.toFixed(0) ?? 'N/A'} WPM (${stats.speakingRateLabel ?? 'N/A'})` + nl;
            output += `Clarity (Confidence): ${confidence > 0 ? (confidence * 100).toFixed(0) : 'N/A'}%` + nl;
            output += `Total Words: ${stats.words ?? 'N/A'}` + nl;
            output += `Avg. Sentence Length: ${stats.avgSentenceLength?.toFixed(1) ?? 'N/A'} words` + nl;
            output += `Vocabulary Richness: ${stats.vocabularyRichness?.toFixed(1) ?? 'N/A'}%` + nl;
            output += `Questions Asked: ${stats.questionCount ?? 'N/A'}` + nl;
            output += `Filler Words: ${stats.fillers ?? 'N/A'}` + nl;
            output += `Pauses: ${stats.pauses ?? 'N/A'}` + nl;
            output += '---------------------------' + nl + nl;
        }

        if (includeSummary && summary && !summary.includes("Your transcript summary will appear here.")) {
            output += '--- AI SUMMARY ---' + nl + summary + nl + nl;
        }

        if (includeTopics && topicTexts.length > 0) {
            output += '--- KEY TOPICS ---' + nl + topicTexts.join(', ') + nl + nl;
        }
        
        if (includeActionItems && actionItems.length > 0) {
            output += '--- ACTION ITEMS & DECISIONS ---' + nl;
            actionItems.forEach(item => {
                const speakerLabel = item.speakerId ? ` (${speakerProfiles[item.speakerId]?.label || item.speakerId})` : '';
                output += `- [${item.type === 'action' ? 'Action' : 'Decision'}] ${item.content}${speakerLabel}` + nl;
            });
            output += nl;
        }

        if (includeSnippets && snippets.length > 0) {
            output += '--- KEY SNIPPETS ---' + nl;
            snippets.forEach(item => {
                const speakerLabel = item.speakerId ? ` (${speakerProfiles[item.speakerId]?.label || item.speakerId})` : '';
                const type = item.type.charAt(0).toUpperCase() + item.type.slice(1);
                output += `- [${type}] ${item.content}${speakerLabel}` + nl;
            });
            output += nl;
        }

        output += '--- FULL TRANSCRIPT ---' + nl;
        const entriesText = transcriptEntries.map(entry => {
            let line = `[${entry.timestamp}] `;
            if (includeSpeakers) {
                const speakerLabel = entry.speakerIds?.[0] ? speakerProfiles[entry.speakerIds[0]]?.label || entry.speakerIds[0] : 'Unknown';
                line += `${speakerLabel}: `;
            }
            line += entry.text;
            return line;
        }).join(nl);
        
        output += entriesText;
        return output;
    }, [includeStats, includeSpeakers, includeSummary, includeActionItems, includeSnippets, includeTopics, speechAnalytics, transcriptEntries, speakerProfiles, confidence, summary, actionItems, snippets, topicTexts]);

    const generateFormattedMarkdown = useCallback((): string => {
        let output = '# DefScribe Transcript\n\n';

        if (includeStats && speechAnalytics && Object.keys(speechAnalytics).length > 0) {
            const stats = speechAnalytics;
            output += '## Transcript Statistics\n';
            output += `- **Duration:** ${stats.duration ? new Date(stats.duration * 1000).toISOString().substr(14, 5) : 'N/A'} MM:SS\n`;
            output += `- **Average Speed:** ${stats.wpm?.toFixed(0) ?? 'N/A'} WPM (${stats.speakingRateLabel ?? 'N/A'})\n`;
            output += `- **Clarity (Confidence):** ${confidence > 0 ? (confidence * 100).toFixed(0) : 'N/A'}%\n`;
            output += `- **Total Words:** ${stats.words ?? 'N/A'}\n`;
            output += `- **Avg. Sentence Length:** ${stats.avgSentenceLength?.toFixed(1) ?? 'N/A'} words\n`;
            output += `- **Vocabulary Richness:** ${stats.vocabularyRichness?.toFixed(1) ?? 'N/A'}%\n`;
            output += `- **Questions Asked:** ${stats.questionCount ?? 'N/A'}\n`;
            output += `- **Filler Words:** ${stats.fillers ?? 'N/A'}\n`;
            output += `- **Pauses:** ${stats.pauses ?? 'N/A'}\n\n`;
        }

        if (includeSummary && summary && !summary.includes("Your transcript summary will appear here.")) {
            output += '## AI Summary\n';
            output += `> ${summary.replace(/\n/g, '\n> ')}\n\n`;
        }
        
        if (includeTopics && topicTexts.length > 0) {
            output += '## Key Topics\n' + topicTexts.map(t => `\`${t}\``).join(' ') + '\n\n';
        }

        if (includeActionItems && actionItems.length > 0) {
            output += '## Action Items & Decisions\n';
            actionItems.forEach(item => {
                const speakerLabel = item.speakerId ? ` (*${speakerProfiles[item.speakerId]?.label || item.speakerId}*)` : '';
                output += `- ${item.type === 'action' ? '**(Action)**' : '**(Decision)**'} ${item.content}${speakerLabel}\n`;
            });
            output += '\n';
        }

        if (includeSnippets && snippets.length > 0) {
            output += '## Key Snippets\n';
            snippets.forEach(item => {
                const speakerLabel = item.speakerId ? ` (*${speakerProfiles[item.speakerId]?.label || item.speakerId}*)` : '';
                const typeLabel = `**(${item.type.charAt(0).toUpperCase() + item.type.slice(1)})**`;
                output += `- ${typeLabel} ${item.content}${speakerLabel}\n`;
            });
            output += '\n';
        }

        output += '## Full Transcript\n';
        const entriesText = transcriptEntries.map(entry => {
            let line = '';
            if (includeSpeakers) {
                const speakerLabel = entry.speakerIds?.[0] ? speakerProfiles[entry.speakerIds[0]]?.label || entry.speakerIds[0] : 'Unknown';
                line += `**${speakerLabel}:** `;
            }
            line += entry.text;
            return line;
        }).join('\n\n');
        
        output += entriesText;
        return output;
    }, [includeStats, includeSpeakers, includeSummary, includeActionItems, includeSnippets, includeTopics, speechAnalytics, transcriptEntries, speakerProfiles, confidence, summary, actionItems, snippets, topicTexts]);

    const handleDownloadTxt = () => {
        const content = generateFormattedTranscript();
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DefScribe-Transcript-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
    };
    
    const handleExportPdf = async () => {
        // @ts-ignore
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        const content = generateFormattedTranscript(false); // Use standard newlines for PDF
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(16);
        doc.text("DefScribe Transcript", 10, 15);
        
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Exported on: ${new Date().toLocaleString()}`, 10, 22);

        doc.setLineWidth(0.5);
        doc.line(10, 25, 200, 25);
        
        doc.setFontSize(11);
        doc.setTextColor(0);

        const lines = doc.splitTextToSize(content, 180);
        doc.text(lines, 10, 35);
        
        doc.save(`DefScribe-Transcript-${new Date().toISOString().slice(0, 10)}.pdf`);
        onClose();
    };

    const handleCopy = (type: 'text' | 'markdown') => {
        const content = type === 'text' ? generateFormattedTranscript() : generateFormattedMarkdown();
        const setButtonText = type === 'text' ? setCopyButtonText : setCopyMarkdownButtonText;
        const defaultText = type === 'text' ? 'Copy as Plain Text' : 'Copy as Markdown';

        navigator.clipboard.writeText(content).then(() => {
            setButtonText('Copied!');
            setTimeout(() => {
                setButtonText(defaultText);
                onClose();
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            setButtonText('Error!');
            setTimeout(() => setButtonText(defaultText), 2000);
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
            <div
                ref={modalRef}
                className="cosmo-panel rounded-xl shadow-2xl p-6 w-full max-w-md"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="export-title"
            >
                <h2 id="export-title" className="text-xl font-bold mb-4 text-center">Export & Share</h2>
                
                <div className="space-y-4 mb-6">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-2 border-b border-slate-700/50 pb-1">Content Options</h3>
                        <div className="space-y-3 pt-2">
                           <Toggle label="Include Statistics" enabled={includeStats} setEnabled={setIncludeStats} />
                           <Toggle label="Include Speaker Labels" enabled={includeSpeakers} setEnabled={setIncludeSpeakers} />
                           <Toggle label="Include AI Summary" enabled={includeSummary} setEnabled={setIncludeSummary} />
                           <Toggle label="Include Action Items" enabled={includeActionItems} setEnabled={setIncludeActionItems} />
                           <Toggle label="Include Snippets" enabled={includeSnippets} setEnabled={setIncludeSnippets} />
                           <Toggle label="Include Topics" enabled={includeTopics} setEnabled={setIncludeTopics} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-2 border-b border-slate-700/50 pb-1">Download</h3>
                        <div className="space-y-3 pt-2">
                            <button onClick={handleExportPdf} className="cosmo-button h-12 w-full flex items-center justify-center gap-2 text-sm font-semibold">
                                <i className="fas fa-file-pdf"></i> Download .pdf
                            </button>
                            <button onClick={handleDownloadTxt} className="cosmo-button h-12 w-full flex items-center justify-center gap-2 text-sm font-semibold">
                                <i className="fas fa-file-alt"></i> Download .txt
                            </button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-2 border-b border-slate-700/50 pb-1">Copy to Clipboard</h3>
                        <div className="space-y-3 pt-2">
                            <button onClick={() => handleCopy('text')} className="cosmo-button h-12 w-full flex items-center justify-center gap-2 text-sm font-semibold">
                                <i className={`fas ${copyButtonText === 'Copied!' ? 'fa-check' : 'fa-clipboard'}`}></i> 
                                <span>{copyButtonText}</span>
                            </button>
                            <button onClick={() => handleCopy('markdown')} className="cosmo-button h-12 w-full flex items-center justify-center gap-2 text-sm font-semibold">
                                <i className={`fas ${copyMarkdownButtonText === 'Copied!' ? 'fa-check' : 'fa-file-code'}`}></i>
                                <span>{copyMarkdownButtonText}</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 text-center">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;