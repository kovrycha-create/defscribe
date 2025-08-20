import { useState, useEffect, useRef } from 'react';
import { type Emotion, type TranscriptEntry } from '../types';
import {
  HAPPY_WORDS, SAD_WORDS, ANGRY_WORDS, CONFUSED_WORDS,
  SURPRISED_WORDS, GOOFY_WORDS, INTENSE_WORDS
} from '../constants';

interface UseEmotionDetectionProps {
  isListening: boolean;
  isSummarizing: boolean;
  interimTranscript: string;
  transcriptEntries: TranscriptEntry[];
  wpm: number;
}

const analyzeTextForEmotion = (text: string): Emotion | null => {
  const lowerText = text.toLowerCase();
  const words = new Set(lowerText.split(/\s+/));

  if ([...words].some(word => ANGRY_WORDS.has(word))) return 'mad';
  if ([...words].some(word => SAD_WORDS.has(word))) return 'sad';
  if ([...words].some(word => HAPPY_WORDS.has(word))) return 'happy';
  if ([...words].some(word => CONFUSED_WORDS.has(word))) return 'confused';
  if ([...words].some(word => SURPRISED_WORDS.has(word))) return 'surprised';
  if ([...words].some(word => GOOFY_WORDS.has(word))) return 'goofy';
  if ([...words].some(word => INTENSE_WORDS.has(word))) return 'intense';

  return null;
};

export const useEmotionDetection = ({
  isListening,
  isSummarizing,
  interimTranscript,
  transcriptEntries,
  wpm,
}: UseEmotionDetectionProps): Emotion => {
  const [emotion, setEmotion] = useState<Emotion>('normal');
  const lastEmotionTimeRef = useRef<number>(Date.now());
  const silenceStartRef = useRef<number | null>(null);
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;

  useEffect(() => {
    let currentEmotion: Emotion = 'normal';
    const lastEntry = transcriptEntries[transcriptEntries.length - 1];
    const now = Date.now();

    if (isSummarizing) {
      currentEmotion = 'thinking';
    } else if (isListening) {
      if (interimTranscript.trim().length > 0) {
        silenceStartRef.current = null;
        currentEmotion = 'talking';
        const detectedEmotion = analyzeTextForEmotion(interimTranscript);
        if (detectedEmotion) {
          currentEmotion = detectedEmotion;
        } else if (wpm > 170) {
          currentEmotion = 'intense';
        }
      } else {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = now;
        }
        const silenceDuration = now - silenceStartRef.current;

        if (silenceDuration > 20000) {
          currentEmotion = 'sleepy';
        } else if (silenceDuration > 5000) {
          currentEmotion = 'calm';
        } else {
          currentEmotion = 'listening';
        }
      }
    } else {
      silenceStartRef.current = null;
      if (transcriptEntries.length > 0) {
        const timeSinceLastTalk = now - (lastEntry?.rawTimestamp || 0);
        if (timeSinceLastTalk > 30000) {
          currentEmotion = 'sleepy';
        } else if (timeSinceLastTalk > 10000) {
          currentEmotion = 'calm';
        } else {
          const lastUtteranceEmotion = lastEntry ? analyzeTextForEmotion(lastEntry.text) : null;
          currentEmotion = lastUtteranceEmotion || 'normal';
        }
      } else {
        currentEmotion = 'normal';
      }
    }
    
    const highPriority: Emotion[] = ['talking', 'thinking', 'surprised', 'mad', 'happy', 'sad'];
    if (currentEmotion !== emotionRef.current && (now - lastEmotionTimeRef.current > 2000 || highPriority.includes(currentEmotion))) {
        setEmotion(currentEmotion);
        lastEmotionTimeRef.current = now;
    }

  }, [isListening, isSummarizing, interimTranscript, transcriptEntries, wpm]);

  return emotion;
};