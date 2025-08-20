import { useState, useCallback, useEffect } from 'react';
import { 
    generateSummary, 
    generateTopics, 
    generateActionItems, 
    generateSnippets 
} from '../services/geminiService';
import { 
    type SummaryStyle, 
    type ActionItem, 
    type Snippet, 
    type SpeakerProfile,
    type SpeakerId,
    type TranscriptEntry,
    type DiarizationSegment,
    type SpeechAnalytics,
} from '../types';
import { type ToastType } from '../components/Toast';
import { FILLER_WORDS } from '../constants';
import { useEmotionDetection } from './useEmotionDetection';

interface UseAnalyticsProps {
    addToast: (title: string, message: string, type: ToastType) => void;
    transcriptEntries: TranscriptEntry[];
    startTime: number | null;
    segments: DiarizationSegment[];
    userApiKey: string | null;
    isListening: boolean;
    interimTranscript: string;
}

const useAnalytics = ({ 
    addToast, 
    transcriptEntries, 
    startTime, 
    segments, 
    userApiKey, 
    isListening, 
    interimTranscript 
}: UseAnalyticsProps) => {
    const [summary, setSummary] = useState<string>('Your transcript summary will appear here.');
    const [summaryStyle, setSummaryStyle] = useState<SummaryStyle | null>(null);
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [topics, setTopics] = useState<string[]>([]);
    const [speechAnalytics, setSpeechAnalytics] = useState<Partial<SpeechAnalytics>>({});

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    
    const avatarEmotion = useEmotionDetection({
        isListening,
        isSummarizing: isSummarizing || isAnalyzing,
        interimTranscript,
        transcriptEntries,
        wpm: speechAnalytics.wpm || 0,
    });


    useEffect(() => {
        if (transcriptEntries.length === 0 || !startTime) {
            setSpeechAnalytics({});
            return;
        }

        const fullText = transcriptEntries.map(e => e.text).join(' ');
        const words = fullText.split(/\s+/).filter(Boolean);
        
        const duration = (Date.now() - startTime) / 1000;
        const wpm = duration > 10 ? (words.length / (duration / 60)) : 0;

        let speakingRateLabel: 'Slow' | 'Medium' | 'Fast' = 'Medium';
        if (wpm < 140) speakingRateLabel = 'Slow';
        if (wpm > 160) speakingRateLabel = 'Fast';
        
        const fillers = words.filter(word => FILLER_WORDS.has(word.toLowerCase())).length;

        let pauses = 0;
        for (let i = 1; i < transcriptEntries.length; i++) {
            if (transcriptEntries[i].rawTimestamp - transcriptEntries[i - 1].rawTimestamp > 1000) {
                pauses++;
            }
        }
        
        const sentences = fullText.match(/[.!?]+/g) || [];
        const questionCount = (fullText.match(/\?/g) || []).length;
        const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
        
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        const vocabularyRichness = words.length > 0 ? (uniqueWords.size / words.length) * 100 : 0;

        // Calculate Talk Time
        const talkTimeBySpeaker: Record<SpeakerId, number> = {};
        const lastSegment = segments.length > 0 ? segments[segments.length - 1] : null;
        const totalDuration = lastSegment ? lastSegment.endMs : 0;
        const talkTime: Record<SpeakerId, { percentage: number; seconds: number }> = {};
        
        if (totalDuration > 0) {
            segments.forEach(seg => {
                const segDuration = seg.endMs - seg.startMs;
                if (segDuration > 0) {
                    talkTimeBySpeaker[seg.speakerId] = (talkTimeBySpeaker[seg.speakerId] || 0) + segDuration;
                }
            });
            Object.entries(talkTimeBySpeaker).forEach(([speakerId, duration]) => {
                talkTime[speakerId] = {
                    percentage: (duration / totalDuration) * 100,
                    seconds: duration / 1000,
                };
            });
        }

        setSpeechAnalytics(prev => ({
            ...prev,
            wpm,
            fillers,
            duration,
            words: words.length,
            sentences: sentences.length,
            pauses,
            speakingRateLabel,
            talkTime,
            questionCount,
            avgSentenceLength,
            vocabularyRichness,
        }));

    }, [transcriptEntries, startTime, segments]);

    const handleSummarize = useCallback(async (transcript: string, style: SummaryStyle) => {
        if (transcript.trim().length < 10) {
            addToast('Not enough content', 'Please speak more before summarizing.', 'warning');
            return;
        }
        setIsSummarizing(true);
        setSummaryStyle(style);
        addToast('Summarizing...', 'Generating your summary with Gemini AI.', 'processing');
        
        try {
            const { summary: result, emotion } = await generateSummary(transcript, style, userApiKey);
            setSummary(result);
            addToast('Summary Ready', 'Your transcript summary is complete.', 'success');
            setSpeechAnalytics(prev => ({ ...prev, emotionalTone: emotion, emotionHistory: [...(prev.emotionHistory || []), emotion] }));
        } catch (e) {
            addToast('Summarization Failed', 'Could not generate summary.', 'error');
        } finally {
            setIsSummarizing(false);
        }
    }, [addToast, userApiKey]);
    
    const generateAllAnalytics = useCallback(async (transcript: string, speakerProfiles: Record<SpeakerId, SpeakerProfile>) => {
        if (transcript.trim().length < 20) return;
        
        setIsAnalyzing(true);
        addToast('Analyzing Transcript', 'Extracting topics, action items, and snippets.', 'processing');
        
        const mapSpeakerLabelToId = (label?: string): SpeakerId | undefined => {
            if (!label) return undefined;
            const profile = Object.values(speakerProfiles).find(p => p.label === label);
            return profile?.id;
        };

        try {
            const [topicsResult, actionItemsResult, snippetsResult] = await Promise.all([
                generateTopics(transcript, userApiKey),
                generateActionItems(transcript, userApiKey),
                generateSnippets(transcript, userApiKey)
            ]);

            setTopics(topicsResult);
            setSpeechAnalytics(prev => ({...prev, topics: topicsResult}));
            setActionItems(actionItemsResult.map(item => ({...item, id: self.crypto.randomUUID(), speakerId: mapSpeakerLabelToId(item.speakerLabel) })));
            setSnippets(snippetsResult.map(item => ({ ...item, id: self.crypto.randomUUID(), speakerId: mapSpeakerLabelToId(item.speakerLabel) })));
            
            addToast('Analysis Complete', 'Key insights have been extracted.', 'success');

        } catch (e) {
            addToast('Analysis Failed', 'Could not extract all insights.', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    }, [addToast, userApiKey]);

    const clearAnalytics = useCallback(() => {
        setSummary('Your transcript summary will appear here.');
        setSummaryStyle(null);
        setActionItems([]);
        setSnippets([]);
        setTopics([]);
        setSpeechAnalytics({});
    }, []);

    return {
        summary,
        summaryStyle,
        actionItems,
        snippets,
        topics,
        isAnalyzing,
        isSummarizing,
        avatarEmotion,
        speechAnalytics,
        handleSummarize,
        generateAllAnalytics,
        clearAnalytics,
    };
};

export default useAnalytics;