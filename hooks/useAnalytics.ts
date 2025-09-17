import { useState, useCallback, useEffect, useRef } from 'react';
import { 
    generateSummary, 
    generateTopics, 
    generateActionItems, 
    generateSnippets,
    generateTitles,
    generateCosmicReading,
    generateAuraData,
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
    type GeneratedTitle,
    type TopicSegment,
    type CosmicReading,
    type AuraData,
} from '../types';
import { type ToastType } from '../components/Toast';
import { FILLER_WORDS } from '../constants';
import { useEmotionDetection } from './useEmotionDetection';

interface UseAnalyticsProps {
    addToast: (title: string, message: string, type: ToastType) => void;
    transcriptEntries: TranscriptEntry[];
    startTime: number | null;
    segments: DiarizationSegment[];
    isListening: boolean;
    interimTranscript: string;
    recordingDuration: number;
    isCloudMode: boolean;
}

const useAnalytics = ({ 
    addToast, 
    transcriptEntries, 
    startTime, 
    segments, 
    isListening, 
    interimTranscript,
    recordingDuration,
    isCloudMode,
}: UseAnalyticsProps) => {
    const [summary, setSummary] = useState<string>('Your transcript summary will appear here.');
    const [summaryStyle, setSummaryStyle] = useState<SummaryStyle | null>(null);
    const [actionItems, setActionItems] = useState<ActionItem[]>([]);
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [topics, setTopics] = useState<TopicSegment[]>([]);
    const [titles, setTitles] = useState<GeneratedTitle[]>([]);
    const [speechAnalytics, setSpeechAnalytics] = useState<Partial<SpeechAnalytics>>({});
    const [cosmicReading, setCosmicReading] = useState<CosmicReading | null>(null);
    const [isReading, setIsReading] = useState(false);
    const [auraData, setAuraData] = useState<AuraData | null>(null);
    const [isAnalyzingAura, setIsAnalyzingAura] = useState(false);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
    
    const avatarEmotion = useEmotionDetection({
        isListening,
        isSummarizing: isSummarizing || isAnalyzing,
        interimTranscript,
        transcriptEntries,
        wpm: speechAnalytics.wpm || 0,
    });
    
    const auraAnalysisTimer = useRef<number | null>(null);

    const handleAuraAnalysis = useCallback(async () => {
        if (!isListening || isAnalyzingAura) return;
        const recentTranscript = transcriptEntries.slice(-3).map(e => e.text).join(' ') + ' ' + interimTranscript;
        if (recentTranscript.trim().length < 20) return;

        setIsAnalyzingAura(true);
        try {
            const result = await generateAuraData(recentTranscript);
            setAuraData(result);
        } catch (error) {
            console.warn("Aura analysis failed:", error);
        } finally {
            setIsAnalyzingAura(false);
        }
    }, [isListening, isAnalyzingAura, transcriptEntries, interimTranscript]);
    
    useEffect(() => {
        if (isListening) {
            if (auraAnalysisTimer.current) clearInterval(auraAnalysisTimer.current);
            auraAnalysisTimer.current = window.setInterval(handleAuraAnalysis, 7000); // Analyze every 7 seconds
        } else {
            if (auraAnalysisTimer.current) clearInterval(auraAnalysisTimer.current);
            setAuraData(null); // Clear aura data when not listening
        }
        return () => {
            if (auraAnalysisTimer.current) clearInterval(auraAnalysisTimer.current);
        };
    }, [isListening, handleAuraAnalysis]);


    useEffect(() => {
        if (transcriptEntries.length === 0) {
            setSpeechAnalytics({});
            return;
        }

        const fullText = transcriptEntries.map(e => e.text).join(' ');
        const words = fullText.split(/\s+/).filter(Boolean);
        
        const duration = isCloudMode ? recordingDuration : (startTime ? (Date.now() - startTime) / 1000 : 0);
        const wpm = duration > 1 ? (words.length / (duration / 60)) : 0;

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

    }, [transcriptEntries, startTime, segments, isCloudMode, recordingDuration]);

    const handleSummarize = useCallback(async (transcript: string, style: SummaryStyle) => {
        if (transcript.trim().length < 10) {
            addToast('Not enough content', 'Please speak more before summarizing.', 'warning');
            return;
        }
        setIsSummarizing(true);
        setSummaryStyle(style);
        addToast('Summarizing...', 'Generating your summary with Gemini AI.', 'processing');
        
        try {
            const { summary: result, emotion } = await generateSummary(transcript, style);
            setSummary(result);
            addToast('Summary Ready', 'Your transcript summary is complete.', 'success');
            setSpeechAnalytics(prev => ({ ...prev, emotionalTone: emotion, emotionHistory: [...(prev.emotionHistory || []), emotion] }));
        } catch (e) {
            addToast('Summarization Failed', 'Could not generate summary.', 'error');
        } finally {
            setIsSummarizing(false);
        }
    }, [addToast]);
    
    const handleGenerateTitles = useCallback(async (transcript: string) => {
        if (transcript.trim().length < 50) {
            addToast('Not enough content', 'Please speak more before generating titles.', 'warning');
            return;
        }
        setIsGeneratingTitles(true);
        addToast('Generating Titles...', 'Asking Gemini for creative titles.', 'processing');
        try {
            const titlesResult = await generateTitles(transcript);
            if (titlesResult.length > 0) {
                setTitles(titlesResult.map(t => ({ id: self.crypto.randomUUID(), text: t })));
                addToast('Titles Generated', 'Suggestions are ready in the Analytics panel.', 'success');
            } else {
                addToast('No Titles Found', 'Could not generate titles for this transcript.', 'warning');
            }
        } catch (e) {
            addToast('Title Generation Failed', 'An error occurred while generating titles.', 'error');
        } finally {
            setIsGeneratingTitles(false);
        }
    }, [addToast]);

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
                generateTopics(transcript),
                generateActionItems(transcript),
                generateSnippets(transcript)
            ]);
            
            const topicsWithIds: TopicSegment[] = topicsResult.map(topic => ({...topic, id: self.crypto.randomUUID()}));
            setTopics(topicsWithIds);
            setSpeechAnalytics(prev => ({...prev, topics: topicsWithIds}));
            setActionItems(actionItemsResult.map(item => ({...item, id: self.crypto.randomUUID(), speakerId: mapSpeakerLabelToId(item.speakerLabel) })));
            setSnippets(snippetsResult.map(item => ({ ...item, id: self.crypto.randomUUID(), speakerId: mapSpeakerLabelToId(item.speakerLabel) })));
            
            addToast('Analysis Complete', 'Key insights have been extracted.', 'success');

        } catch (e) {
            addToast('Analysis Failed', 'Could not extract all insights.', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    }, [addToast]);

    const handleGenerateCosmicReading = useCallback(async (transcript: string) => {
        if (transcript.trim().length < 100) {
            addToast('Not enough content', 'A meaningful reading requires more transcript.', 'warning');
            return;
        }
        setIsReading(true);
        addToast('Consulting the Oracle...', 'Generating a Cosmic Reading from your transcript.', 'processing');
        try {
            const reading = await generateCosmicReading(transcript);
            setCosmicReading(reading);
            addToast('Reading Complete', 'Your Cosmic Reading is ready.', 'success');
        } catch (e) {
            const message = e instanceof Error ? e.message : "The cosmic currents are unclear.";
            addToast('Oracle Error', message, 'error');
        } finally {
            setIsReading(false);
        }
    }, [addToast]);


    const clearAnalytics = useCallback(() => {
        setSummary('Your transcript summary will appear here.');
        setSummaryStyle(null);
        setActionItems([]);
        setSnippets([]);
        setTopics([]);
        setTitles([]);
        setSpeechAnalytics({});
        setCosmicReading(null);
        setAuraData(null);
    }, []);

    const loadAnalyticsData = useCallback((data: any) => {
        setSummary(data.summary || 'Your transcript summary will appear here.');
        setActionItems(data.actionItems || []);
        setSnippets(data.snippets || []);
        setTopics(data.topics || []);
        setTitles(data.titles || []);
        setSpeechAnalytics(data.speechAnalytics || {});
        setCosmicReading(null);
        setAuraData(null);
    }, []);


    return {
        summary,
        summaryStyle,
        actionItems,
        snippets,
        topics,
        titles,
        setTitles,
        isAnalyzing,
        isSummarizing,
        isGeneratingTitles,
        avatarEmotion,
        speechAnalytics,
        handleSummarize,
        generateAllAnalytics,
        clearAnalytics,
        handleGenerateTitles,
        loadAnalyticsData,
        handleGenerateCosmicReading,
        isReading,
        cosmicReading,
        auraData,
    };
};

export default useAnalytics;