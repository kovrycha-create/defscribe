
import { useState, useEffect, useRef, useCallback } from 'react';
import { type TranscriptEntry, type SpeakerId, type SpeakerProfile, type DiarizationSettings } from '../types';
import { DIARIZATION_PALETTE } from '../constants';
import useDiarization from './useDiarization';
import { type ToastType } from '../components/Toast';
import { translateText } from '../services/geminiService';

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
};

interface UseTranscriptProps {
    finalTranscript: string;
    diarizationSettings: DiarizationSettings;
    addToast: (title: string, message: string, type: ToastType) => void;
    liveTranslationEnabled: boolean;
    translationLanguage: string;
    isCloudMode: boolean;
    stream: MediaStream | null;
}

const useTranscript = ({ 
    finalTranscript, 
    diarizationSettings, 
    addToast, 
    liveTranslationEnabled, 
    translationLanguage,
    isCloudMode,
    stream,
}: UseTranscriptProps) => {
    const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
    const [speakerProfiles, setSpeakerProfiles] = useState<Record<SpeakerId, SpeakerProfile>>({});
    const startTimeRef = useRef<number | null>(null);
    const prevFinalTranscript = usePrevious(finalTranscript);
    
    const { activeSpeaker, segments, resetDiarization } = useDiarization(
        stream, 
        { ...diarizationSettings, enabled: diarizationSettings.enabled && !isCloudMode }, 
        startTimeRef.current
    );

    useEffect(() => {
        // Automatically create/update speaker profiles when new speakers are detected
        const allSpeakerIds = new Set(segments.map(s => s.speakerId));
        if (activeSpeaker) allSpeakerIds.add(activeSpeaker);

        setSpeakerProfiles(prevProfiles => {
            const newProfiles = { ...prevProfiles };
            let changed = false;
            allSpeakerIds.forEach(id => {
                if (!newProfiles[id]) {
                    const profileIndex = parseInt(id.replace('S', ''), 10) - 1;
                    newProfiles[id] = {
                        id,
                        label: `Speaker ${id.replace('S', '')}`,
                        color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length],
                        isEditable: true,
                    };
                    changed = true;
                }
            });
            return changed ? newProfiles : prevProfiles;
        });
    }, [segments, activeSpeaker]);

    useEffect(() => {
        if (!finalTranscript.trim()) {
            if (transcriptEntries.length > 0) startTimeRef.current = null;
            return;
        }

        if (!startTimeRef.current) {
            startTimeRef.current = Date.now() - 100;
        }

        const newText = finalTranscript.slice(prevFinalTranscript?.length || 0).trim();
        if (newText) {
            // Cloud mode: transcript comes in one block with speaker labels
            if (isCloudMode) {
                const cloudSegments = newText.split(/(?=SPEAKER_\d{2}:)/g);
                const newEntries: TranscriptEntry[] = [];
                
                cloudSegments.filter(s => s.trim()).forEach((segment, index) => {
                    const match = segment.match(/SPEAKER_(\d{2}):\s*(.*)/s);
                    if (match) {
                        const speakerNum = match[1];
                        const text = match[2].trim();
                        const speakerId = `S${parseInt(speakerNum, 10)}`;

                        setSpeakerProfiles(prev => {
                            if (prev[speakerId]) return prev;
                            const profileIndex = parseInt(speakerNum, 10) - 1;
                            const newProfile: SpeakerProfile = {
                                id: speakerId,
                                label: `Speaker ${parseInt(speakerNum, 10)}`,
                                color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length],
                                isEditable: true,
                            };
                            return {...prev, [speakerId]: newProfile};
                        });
                        
                        const entryTimestamp = Date.now() + index;
                        newEntries.push({
                            id: `entry-${entryTimestamp}`,
                            rawTimestamp: entryTimestamp,
                            timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            text: text,
                            isFinal: true,
                            speakerIds: [speakerId],
                        });
                    } else { // Handle text without a speaker tag if any
                         const entryTimestamp = Date.now() + index;
                         newEntries.push({
                            id: `entry-${entryTimestamp}`,
                            rawTimestamp: entryTimestamp,
                            timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            text: segment.trim(),
                            isFinal: true,
                            speakerIds: [],
                        });
                    }
                });
                setTranscriptEntries(prev => [...prev, ...newEntries]);

            } else { // Native mode: transcript comes in real-time chunks
                const entryTimestamp = Date.now();
                const entryStartMs = entryTimestamp - (startTimeRef.current || entryTimestamp);
                const overlappingSegment = [...segments].reverse().find(
                    seg => entryStartMs >= seg.startMs && entryStartMs <= seg.endMs
                );
                let speakerId = overlappingSegment ? overlappingSegment.speakerId : activeSpeaker;
                
                if (!speakerId && segments.length > 0) {
                    const lastSegment = segments[segments.length - 1];
                    if (entryStartMs - lastSegment.endMs < 2000) {
                        speakerId = lastSegment.speakerId;
                    }
                }

                const newEntry: TranscriptEntry = {
                    id: `entry-${entryTimestamp}`,
                    rawTimestamp: entryTimestamp,
                    timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    text: newText,
                    isFinal: true,
                    speakerIds: speakerId ? [speakerId] : [],
                };
                
                if (liveTranslationEnabled) {
                    newEntry.isTranslating = true;
                    translateText(newEntry.text, translationLanguage)
                        .then(translated => {
                            setTranscriptEntries(prev => prev.map(e => 
                                e.id === newEntry.id 
                                ? { ...e, translatedText: translated, isTranslating: false } 
                                : e
                            ));
                        })
                        .catch(err => {
                            console.error("Live translation failed:", err);
                            setTranscriptEntries(prev => prev.map(e => 
                                e.id === newEntry.id 
                                ? { ...e, translatedText: "[Translation Error]", isTranslating: false } 
                                : e
                            ));
                        });
                }
                setTranscriptEntries(prev => [...prev, newEntry]);
            }
        }
    }, [finalTranscript, prevFinalTranscript, activeSpeaker, segments, liveTranslationEnabled, translationLanguage, isCloudMode]);

    const clearTranscriptEntries = useCallback(() => {
        setTranscriptEntries([]);
        setSpeakerProfiles({});
        startTimeRef.current = null;
        resetDiarization();
    }, [resetDiarization]);

    const handleUpdateSpeakerLabel = useCallback((speakerId: SpeakerId, newLabel: string) => {
        setSpeakerProfiles(prev => {
            if (!prev[speakerId]) return prev;
            return {
                ...prev,
                [speakerId]: { ...prev[speakerId], label: newLabel }
            };
        });
    }, []);

    const handleReassignSpeakerForEntry = useCallback((entryId: string, newSpeakerId: SpeakerId) => {
        setTranscriptEntries(prev => prev.map(entry => 
            entry.id === entryId ? { ...entry, speakerIds: [newSpeakerId] } : entry
        ));
    }, []);

    const handleTranslateEntry = useCallback(async (entryId: string, language: string) => {
        const entry = transcriptEntries.find(e => e.id === entryId);
        if (!entry) return;

        addToast('Translating...', `Translating text to ${language}.`, 'processing');
        try {
            const translated = await translateText(entry.text, language);
            setTranscriptEntries(prev => prev.map(e => e.id === entryId ? { ...e, translatedText: translated } : e));
            addToast('Translation Complete', `Text successfully translated.`, 'success');
        } catch (error) {
            addToast('Translation Failed', `Could not translate text.`, 'error');
        }
    }, [transcriptEntries, addToast]);


    return {
        transcriptEntries,
        activeSpeaker,
        speakerProfiles,
        clearTranscriptEntries,
        startTimeRef,
        segments,
        handleUpdateSpeakerLabel,
        handleReassignSpeakerForEntry,
        handleTranslateEntry,
    };
};

export default useTranscript;