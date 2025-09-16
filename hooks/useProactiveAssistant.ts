import { useEffect, useRef, useCallback } from 'react';
import { type TranscriptEntry, type SpeechAnalytics } from '../types';
import { FILLER_WORDS, PROACTIVE_ASSISTANT } from '../constants';
import { getProactiveNudge, ProactiveNudgeType } from '../services/geminiService';

interface UseProactiveAssistantProps {
  isListening: boolean;
  transcriptEntries: TranscriptEntry[];
  speechAnalytics: Partial<SpeechAnalytics>;
  onNudge: (text: string) => void;
}

const useProactiveAssistant = ({
  isListening,
  transcriptEntries,
  speechAnalytics,
  onNudge,
}: UseProactiveAssistantProps): void => {
  const lastCheckTimeRef = useRef<number>(0);
  const lastSilenceTimeRef = useRef<number>(0);
  const isFetchingRef = useRef(false);

  const checkTriggers = useCallback(async () => {
    if (isFetchingRef.current || !isListening) return;

    const now = Date.now();
    if (now - lastCheckTimeRef.current < PROACTIVE_ASSISTANT.GLOBAL_COOLDOWN_MS) {
      return;
    }

    let nudgeType: ProactiveNudgeType | null = null;
    let context = '';

    const lastEntry = transcriptEntries.length > 0 ? transcriptEntries[transcriptEntries.length - 1] : null;

    // 1. Check for prolonged silence
    if (!lastEntry || (now - lastEntry.rawTimestamp > PROACTIVE_ASSISTANT.SILENCE_THRESHOLD_MS)) {
        if (!lastSilenceTimeRef.current) {
            lastSilenceTimeRef.current = now;
        }
        if (now - lastSilenceTimeRef.current > PROACTIVE_ASSISTANT.SILENCE_THRESHOLD_MS) {
            nudgeType = 'prolonged-silence';
            context = 'The user has been silent for a while.';
        }
    } else {
        lastSilenceTimeRef.current = 0;
    }

    // 2. Check for rushing speech (high WPM)
    if (!nudgeType && speechAnalytics.wpm && speechAnalytics.wpm > PROACTIVE_ASSISTANT.WPM_RUSHING_THRESHOLD) {
      nudgeType = 'rushing-speech';
      context = transcriptEntries.slice(-2).map(e => e.text).join(' ');
    }

    // 3. Check for high filler word ratio
    if (!nudgeType && transcriptEntries.length >= PROACTIVE_ASSISTANT.FILLER_WORD_LOOKBEHIND_ENTRIES) {
      const recentEntries = transcriptEntries.slice(-PROACTIVE_ASSISTANT.FILLER_WORD_LOOKBEHIND_ENTRIES);
      const recentText = recentEntries.map(e => e.text).join(' ');
      const words = recentText.toLowerCase().split(/\s+/).filter(Boolean);
      const fillers = words.filter(word => FILLER_WORDS.has(word));
      
      if (words.length > 10 && (fillers.length / words.length) > PROACTIVE_ASSISTANT.FILLER_WORD_RATIO_THRESHOLD) {
        nudgeType = 'filler-words';
        context = recentText;
      }
    }
    
    if (nudgeType) {
      isFetchingRef.current = true;
      lastCheckTimeRef.current = now;
      lastSilenceTimeRef.current = 0; // Reset silence timer after any nudge
      
      const nudgeText = await getProactiveNudge(nudgeType, context);
      if (nudgeText) {
        onNudge(nudgeText);
      }
      isFetchingRef.current = false;
    }

  }, [isListening, transcriptEntries, speechAnalytics.wpm, onNudge]);
  
  useEffect(() => {
    if (!isListening) {
      lastSilenceTimeRef.current = 0;
      return;
    }

    const checkInterval = setInterval(checkTriggers, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);

  }, [isListening, checkTriggers]);
};

export default useProactiveAssistant;