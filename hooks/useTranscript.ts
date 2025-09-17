import { useState, useEffect, useRef, useCallback } from 'react';
import { type TranscriptEntry, type SpeakerId, type SpeakerProfile, type DiarizationSettings } from '../types';
import { DIARIZATION_PALETTE } from '../constants';
import useDiarization from './useDiarization';
import { type ToastType } from '../components/Toast';
import { translateText } from '../services/geminiService';

// (previously allowed a small buffer for segment timing; logic now uses entry time ranges)

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
    liveAudioFeatures: { volume: number; pitch: number };
}

const useTranscript = ({ 
    finalTranscript, 
    diarizationSettings, 
    addToast, 
    liveTranslationEnabled, 
    translationLanguage,
    isCloudMode,
    stream,
    liveAudioFeatures,
}: UseTranscriptProps) => {
    const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
    const [speakerProfiles, setSpeakerProfiles] = useState<Record<SpeakerId, SpeakerProfile>>({});
    const startTimeRef = useRef<number | null>(null);
    const prevFinalTranscript = usePrevious(finalTranscript);
    
    // FIX: Get segments and the live active speaker from the diarization hook.
    // Also receive speakerStats and detectedSpeakersCount for analytics UI.
    const { segments, activeSpeaker, resetDiarization, speakerStats, detectedSpeakersCount } = useDiarization(
        stream,
        diarizationSettings,
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
    // FIX: Native mode now immediately assigns the active speaker when available so UI shows speakers right away.
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
            } else {
                // FIXED: Native mode now immediately assigns the active speaker
                const currentTimeMs = Date.now();
                const entryTimestamp = currentTimeMs;
                
                // If diarization is enabled and we have an active speaker, assign it immediately
                const speakerIds: SpeakerId[] = [];
                if (diarizationSettings.enabled) {
                    if (activeSpeaker) {
                        speakerIds.push(activeSpeaker);
                        // Ensure speaker profile exists
                        setSpeakerProfiles(prev => {
                            if (prev[activeSpeaker]) return prev;
                            const speakerNum = parseInt(activeSpeaker.replace('S', ''), 10);
                            const profileIndex = speakerNum - 1;
                            const newProfile: SpeakerProfile = {
                                id: activeSpeaker,
                                label: `Speaker ${speakerNum}`,
                                color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length],
                                isEditable: true
                            };
                            return { ...prev, [activeSpeaker]: newProfile };
                        });
                    } else {
                        // Fallback: assign speaker based on live audio volume
                        const vol = liveAudioFeatures?.volume ?? 0;
                        const fallbackId: SpeakerId = vol > 0.12 ? ('S1' as SpeakerId) : ('S2' as SpeakerId);
                        speakerIds.push(fallbackId);
                        // Ensure fallback profile exists
                        setSpeakerProfiles(prev => {
                            if (prev[fallbackId]) return prev;
                            const speakerNum = parseInt(fallbackId.replace('S', ''), 10);
                            const profileIndex = speakerNum - 1;
                            const newProfile: SpeakerProfile = {
                                id: fallbackId,
                                label: `Speaker ${speakerNum}`,
                                color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length],
                                isEditable: true
                            };
                            return { ...prev, [fallbackId]: newProfile };
                        });
                        console.debug('useTranscript: assigned fallback speaker by volume', { vol, fallbackId });
                    }
                }
                
                const newEntry: TranscriptEntry = {
                    id: `entry-${entryTimestamp}`,
                    rawTimestamp: entryTimestamp,
                    timestamp: new Date(entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    text: newText,
                    isFinal: true,
                    speakerIds,
                    // Store the time range for later segment matching
                    endTimestamp: currentTimeMs
                };
                console.debug('useTranscript: creating entry', { id: newEntry.id, rawTimestamp: newEntry.rawTimestamp, speakerIds: newEntry.speakerIds });
                
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
    }, [finalTranscript, prevFinalTranscript, isCloudMode, diarizationSettings.enabled, activeSpeaker, liveTranslationEnabled, translationLanguage, addToast]);

    // Enhanced Segment Matching Logic
    // Add this improved effect to retroactively assign speakers based on segments
    useEffect(() => {
        if (!diarizationSettings.enabled || isCloudMode || segments.length === 0) {
            return;
        }
        
        // Update entries that don't have speakers assigned yet
        setTranscriptEntries(prev => {
            let hasChanges = false;
            const updated = prev.map(entry => {
                // Skip if already has a speaker
                if (entry.speakerIds && entry.speakerIds.length > 0) {
                    return entry;
                }
                
                // Find the best matching segment
                const entryStartMs = startTimeRef.current ? entry.rawTimestamp - startTimeRef.current : 0;
                const entryEndMs = entry.endTimestamp && startTimeRef.current ? 
                    entry.endTimestamp - startTimeRef.current : entryStartMs + 1000;
                
                // Find segments that overlap with this entry
                const matchingSegments = segments.filter(segment => {
                    // Check if segment overlaps with entry time range
                    const overlapStart = Math.max(segment.startMs, entryStartMs);
                    const overlapEnd = Math.min(segment.endMs || segment.startMs + 1000, entryEndMs);
                    return overlapStart < overlapEnd;
                });
                
                if (matchingSegments.length > 0) {
                    // Choose the segment with the most overlap
                    const bestMatch = matchingSegments.reduce((best, current) => {
                        const currentOverlap = Math.min(current.endMs || current.startMs + 1000, entryEndMs) - 
                                              Math.max(current.startMs, entryStartMs);
                        const bestOverlap = Math.min(best.endMs || best.startMs + 1000, entryEndMs) - 
                                           Math.max(best.startMs, entryStartMs);
                        return currentOverlap > bestOverlap ? current : best;
                    });
                    
                    hasChanges = true;
                    
                    // Ensure speaker profile exists
                    const speakerId = bestMatch.speakerId;
                    setSpeakerProfiles(prev => {
                        if (prev[speakerId]) return prev;
                        const speakerNum = parseInt(speakerId.replace('S', ''), 10);
                        const profileIndex = speakerNum - 1;
                        const newProfile: SpeakerProfile = {
                            id: speakerId,
                            label: `Speaker ${speakerNum}`,
                            color: DIARIZATION_PALETTE[profileIndex % DIARIZATION_PALETTE.length],
                            isEditable: true
                        };
                        return { ...prev, [speakerId]: newProfile };
                    });
                    
                    console.debug('useTranscript: retroactively assigned speaker', { entryId: entry.id, speakerId: bestMatch.speakerId });
                    return { ...entry, speakerIds: [bestMatch.speakerId] };
                }
                
                return entry;
            });
            
            return hasChanges ? updated : prev;
        });
    }, [segments, diarizationSettings.enabled, isCloudMode]);

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
    
    const loadTranscriptData = useCallback((data: { entries: TranscriptEntry[], profiles: Record<SpeakerId, SpeakerProfile> }) => {
        setTranscriptEntries(data.entries || []);
        setSpeakerProfiles(data.profiles || {});
        startTimeRef.current = data.entries.length > 0 ? data.entries[0].rawTimestamp : Date.now();
    }, []);

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
        loadTranscriptData,
        speakerStats,
        detectedSpeakersCount
    };
};

export default useTranscript;