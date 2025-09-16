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
    
    // FIX: Get segments and the live active speaker from the diarization hook.
    const { segments, activeSpeaker, resetDiarization } = useDiarization(
        stream, 
        { ...diarizationSettings, enabled: diarizationSettings.enabled && !isCloudMode }, 
        startTimeRef.current
    );

    useEffect(() => {
        // Automatically create/update speaker profiles when new speakers appear in segments.
        const allSpeakerIdsInSegments = new Set(segments.map(s => s.speakerId));
        
        setSpeakerProfiles(prevProfiles => {
            const newProfiles = { ...prevProfiles };
            let hasChanged = false;
            allSpeakerIdsInSegments.forEach(id => {
                if (!newProfiles[id]) {
                    const profileIndex = parseInt(id.replace('S', ''), 10) - 1;
                    newProfiles[id] = {
                        id,
                        label: `Speaker ${id.replace('S', '')}`,
                        color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length],
                        isEditable: true,
                    };
                    hasChanged = true;
                }
            });
            return hasChanged ? newProfiles : prevProfiles;
        });
    }, [segments]);

    // Effect for creating new transcript entries when finalTranscript updates
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
            if (isCloudMode) {
                // Cloud mode logic remains the same as it provides speaker tags directly.
                const cloudSegments = newText.split(/(?=SPEAKER_\d{2}:)/g);
                const newEntries: TranscriptEntry[] = [];
                
                cloudSegments.filter(s => s.trim()).forEach((segment, index) => {
                    const match = segment.match(/SPEAKER_(\d{2}):\s*(.*)/s);
                    if (match) {
                        const speakerNum = match[1];
                        const text = match[2].trim();
                        const speakerId = `S${parseInt(speakerNum, 10)}` as SpeakerId;

                        setSpeakerProfiles(prev => {
                            if (prev[speakerId]) return prev;
                            const profileIndex = parseInt(speakerNum, 10) - 1;
                            const newProfile: SpeakerProfile = { id: speakerId, label: `Speaker ${parseInt(speakerNum, 10)}`, color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length], isEditable: true, };
                            return {...prev, [speakerId]: newProfile};
                        });
                        
                        const entryTimestamp = Date.now() + index;
                        newEntries.push({ id: `entry-${entryTimestamp}`, rawTimestamp: entryTimestamp, timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text: text, isFinal: true, speakerIds: [speakerId], });
                    } else {
                         const entryTimestamp = Date.now() + index;
                         newEntries.push({ id: `entry-${entryTimestamp}`, rawTimestamp: entryTimestamp, timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), text: segment.trim(), isFinal: true, speakerIds: [], });
                    }
                });
                setTranscriptEntries(prev => [...prev, ...newEntries]);
            } else { // Native mode: Create entry WITHOUT speakerId. It will be assigned later.
                const entryTimestamp = Date.now();
                const newEntry: TranscriptEntry = {
                    id: `entry-${entryTimestamp}`,
                    rawTimestamp: entryTimestamp,
                    timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    text: newText,
                    isFinal: true,
                    speakerIds: [], // Intentionally empty. Will be filled by the assignment effect.
                };
                
                if (liveTranslationEnabled) {
                    newEntry.isTranslating = true;
                    translateText(newEntry.text, translationLanguage)
                        .then(translated => setTranscriptEntries(prev => prev.map(e => e.id === newEntry.id ? { ...e, translatedText: translated, isTranslating: false } : e)))
                        .catch(err => {
                            console.error("Live translation failed:", err);
                            setTranscriptEntries(prev => prev.map(e => e.id === newEntry.id ? { ...e, translatedText: "[Translation Error]", isTranslating: false } : e));
                        });
                }
                setTranscriptEntries(prev => [...prev, newEntry]);
            }
        }
    }, [finalTranscript, prevFinalTranscript, isCloudMode, liveTranslationEnabled, translationLanguage, addToast]);

    // REVAMPED: This is now the SINGLE SOURCE OF TRUTH for speaker assignment in local mode.
    useEffect(() => {
        if (isCloudMode || segments.length === 0 || !startTimeRef.current) {
            return;
        }

        const startTime = startTimeRef.current;

        setTranscriptEntries(prevEntries => {
            let hasChanges = false;
            const updatedEntries = prevEntries.map(entry => {
                const entryTimestampMs = entry.rawTimestamp - startTime;
                
                const matchingSegment = segments.find(
                    seg => entryTimestampMs >= seg.startMs && entryTimestampMs <= seg.endMs
                );

                const currentSpeakerId = entry.speakerIds?.[0];
                const newSpeakerId = matchingSegment?.speakerId;

                if (newSpeakerId && currentSpeakerId !== newSpeakerId) {
                    hasChanges = true;
                    return { ...entry, speakerIds: [newSpeakerId] };
                }
                
                // If an entry had a speaker but no longer falls in a segment, untag it.
                if (!newSpeakerId && currentSpeakerId) {
                    hasChanges = true;
                    return { ...entry, speakerIds: [] };
                }

                return entry;
            });

            return hasChanges ? updatedEntries : prevEntries;
        });
    }, [segments, isCloudMode, transcriptEntries.length]); // Re-run when segments update or new entries are added.

    const clearTranscriptEntries = useCallback(() => {
        setTranscriptEntries([]);
        setSpeakerProfiles({});
        startTimeRef.current = null;
        resetDiarization();
    }, [resetDiarization]);

    const handleUpdateSpeakerLabel = useCallback((speakerId: SpeakerId, newLabel: string) => {
        setSpeakerProfiles(prev => ({ ...prev, [speakerId]: { ...prev[speakerId], label: newLabel } }));
    }, []);

    const handleUpdateEntryText = useCallback((entryId: string, newText: string) => {
        setTranscriptEntries(prev => {
            const newEntries = prev.map(entry => entry.id === entryId ? { ...entry, text: newText, translatedText: undefined, isTranslating: liveTranslationEnabled } : entry);
            if (liveTranslationEnabled) {
                const entryToTranslate = newEntries.find(e => e.id === entryId);
                if (entryToTranslate) {
                    translateText(entryToTranslate.text, translationLanguage)
                        .then(translated => setTranscriptEntries(current => current.map(e => e.id === entryId ? { ...e, translatedText: translated, isTranslating: false } : e)))
                        .catch(err => {
                            console.error("Live translation on edit failed:", err);
                            setTranscriptEntries(current => current.map(e => e.id === entryId ? { ...e, translatedText: "[Translation Error]", isTranslating: false } : e));
                        });
                }
            }
            return newEntries;
        });
    }, [liveTranslationEnabled, translationLanguage]);

    const handleReassignSpeakerForEntry = useCallback((entryId: string, newSpeakerId: SpeakerId) => {
        setTranscriptEntries(prev => prev.map(entry => entry.id === entryId ? { ...entry, speakerIds: [newSpeakerId] } : entry));
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
        speakerProfiles,
        clearTranscriptEntries,
        startTimeRef,
        segments, // Pass segments through for analytics
        handleUpdateSpeakerLabel,
        handleReassignSpeakerForEntry,
        handleTranslateEntry,
        handleUpdateEntryText,
        activeSpeaker,
    };
};

export default useTranscript;
