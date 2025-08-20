

import { useState, useRef, useEffect, useCallback } from 'react';
import { type ToastType } from '../components/Toast';
import { transcribeAudio } from '../services/geminiService';

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
};

// Type definitions for the Web Speech API to make it available to TypeScript
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResult[];
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}

interface SpeechRecognitionHookProps {
  spokenLanguage: string;
  addToast: (title: string, message: string, type: ToastType) => void;
  isRecordingEnabled: boolean;
}

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  finalTranscript: string;
  error: string | null;
  confidence: number;
  isCloudMode: boolean;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  stream: MediaStream | null;
  audioBlobUrl: string | null;
  deleteAudio: () => void;
  recordingDuration: number;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error('File could not be read as a string.'));
      }
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const useSpeechRecognition = ({ spokenLanguage, addToast, isRecordingEnabled }: SpeechRecognitionHookProps): SpeechRecognitionHook => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [averageConfidence, setAverageConfidence] = useState(0);
  const [isCloudMode, setIsCloudMode] = useState(false);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const confidenceScoresRef = useRef<number[]>([]);
  const listeningIntentRef = useRef(false);
  const languageChangedWhileListening = useRef(false);
  const prevSpokenLanguage = usePrevious(spokenLanguage);
  
  const startListeningCallbackRef = useRef<() => void>(() => {});

  const deleteAudio = useCallback(() => {
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
    }
    setAudioBlobUrl(null);
    audioChunksRef.current = [];
  }, [audioBlobUrl]);
  
    const stopListening = () => {
    listeningIntentRef.current = false;
    
    if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    
    if (!isCloudMode && recognitionRef.current) {
      languageChangedWhileListening.current = false;
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const startListening = useCallback(async () => {
    if (isListening) {
      // This is an auto-restart, not a user-initiated start.
      // The guard prevents re-running setup, but we need to ensure recognition continues.
      if (!isCloudMode && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Error on recognition restart:", e);
          // If restart fails, stop everything to avoid a broken state.
          stopListening();
        }
      }
      return;
    }

    deleteAudio();

    try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = mediaStream;
        setStream(mediaStream);

        setTranscript('');
        setError(null);

        // Start speech recognition before MediaRecorder to avoid resource conflicts on mobile.
        if (!isCloudMode && recognitionRef.current) {
            recognitionRef.current.lang = spokenLanguage;
            recognitionRef.current.start();
        }

        setIsListening(true);
        listeningIntentRef.current = true;

        if (isRecordingEnabled) {
            const options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} is not supported, falling back to default.`);
                // @ts-ignore
                options.mimeType = '';
            }

            const mediaRecorder = new MediaRecorder(mediaStream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                if (audioBlob.size > 0) {
                  const url = URL.createObjectURL(audioBlob);
                  setAudioBlobUrl(url);
                }

                if (isCloudMode) {
                    if (audioBlob.size === 0) {
                        addToast('Empty Recording', 'No audio was recorded to transcribe.', 'warning');
                        return;
                    }
                    addToast('Processing Audio', 'Sending audio for cloud transcription...', 'processing');
                    const base64Audio = await blobToBase64(audioBlob);
                    const result = await transcribeAudio(base64Audio, mimeType);

                    if (result.startsWith('Error:')) {
                        addToast('Transcription Failed', result, 'error');
                    } else {
                        addToast('Transcription Complete', 'Received transcript from cloud.', 'success');
                        setFinalTranscript(prev => prev + result + ' ');
                    }
                }
            };

            mediaRecorder.start(1000);
            setRecordingDuration(0);
            const recordingStartTime = Date.now();
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = window.setInterval(() => {
                setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
            }, 1000);
            addToast('Listening Started', 'DefScribe is now recording your speech.', 'info');
        } else {
            addToast('Listening Started', 'Transcription active. Audio is not being recorded.', 'info');
        }
    } catch (err) {
        console.error("Failed to start listening:", err);
        setError("Microphone access was denied or no microphone was found.");
        addToast("Microphone Error", "Could not access microphone for recording.", "error");
        setIsListening(false);
        listeningIntentRef.current = false;
    }
  }, [isListening, deleteAudio, addToast, isCloudMode, spokenLanguage, isRecordingEnabled, stopListening]);
  
  useEffect(() => {
    startListeningCallbackRef.current = startListening;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      setError("Speech recognition is not available in this environment.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsCloudMode(true);
      setError("Using cloud transcription. Results will appear after stopping.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;
          if (typeof confidence === 'number' && isFinite(confidence)) {
            confidenceScoresRef.current.push(confidence);
          }
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(interimTranscript);
      if (finalChunk) {
        if (confidenceScoresRef.current.length > 0) {
          const avg = confidenceScoresRef.current.reduce((a, b) => a + b, 0) / confidenceScoresRef.current.length;
          setAverageConfidence(avg);
        }
        setFinalTranscript(prev => prev + finalChunk + ' ');
      }
    };

    recognition.onend = () => {
      if (languageChangedWhileListening.current) {
        languageChangedWhileListening.current = false;
        setTimeout(() => {
          if (listeningIntentRef.current) startListeningCallbackRef.current();
        }, 100);
      } else if (listeningIntentRef.current && !isCloudMode) {
        startListeningCallbackRef.current();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'audio-capture') return;
        setError(event.error);
        listeningIntentRef.current = false;
        setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        (recognitionRef.current as any).onresult = undefined;
        recognitionRef.current.onend = null;
        (recognitionRef.current as any).onerror = undefined;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [isCloudMode]);

  useEffect(() => {
    if (isCloudMode || !recognitionRef.current) return;
    recognitionRef.current.lang = spokenLanguage;
    if (isListening && spokenLanguage !== prevSpokenLanguage && prevSpokenLanguage !== undefined) {
        languageChangedWhileListening.current = true;
        recognitionRef.current?.stop();
    }
  }, [isListening, spokenLanguage, prevSpokenLanguage, isCloudMode]);

  const clearTranscript = useCallback(() => {
      setTranscript('');
      setFinalTranscript('');
      confidenceScoresRef.current = [];
      setAverageConfidence(0);
      deleteAudio();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingDuration(0);
  }, [deleteAudio]);

  return { isListening, transcript, finalTranscript, error, startListening, stopListening, clearTranscript, confidence: averageConfidence, isCloudMode, stream, audioBlobUrl, deleteAudio, recordingDuration };
};

export default useSpeechRecognition;