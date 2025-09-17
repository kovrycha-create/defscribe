import { useState, useRef, useEffect, useCallback } from 'react';
import { type ToastType } from '../components/Toast';
import { transcribeAudio } from '../services/geminiService';
import { AudioContextManager } from '../utils/AudioContextManager';
import { type LiveAudioFeatures } from '../types';

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
  setAudioBlobUrl: React.Dispatch<React.SetStateAction<string | null>>;
  deleteAudio: () => void;
  recordingDuration: number;
  transcribeFile: (file: File) => Promise<void>;
  isTranscribingFile: boolean;
  liveAudioFeatures: LiveAudioFeatures;
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

  const [isCloudMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    // Force cloud mode on mobile devices for better compatibility.
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return isMobile || !SpeechRecognition;
  });
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribingFile, setIsTranscribingFile] = useState(false);
  const [liveAudioFeatures, setLiveAudioFeatures] = useState<LiveAudioFeatures>({ volume: 0, pitch: 0 });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const audioAnalysisRef = useRef<{
      analyser: AnalyserNode | null;
      source: MediaStreamAudioSourceNode | null;
      animationFrameId: number | null;
  }>({ analyser: null, source: null, animationFrameId: null });
  
  const confidenceScoresRef = useRef<number[]>([]);
  const listeningIntentRef = useRef(false);
  const languageChangedWhileListening = useRef(false);
  const prevSpokenLanguage = usePrevious(spokenLanguage);
  const prevIsRecordingEnabled = usePrevious(isRecordingEnabled);
  
  const startListeningCallbackRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (isCloudMode) {
      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
      if (isMobile) {
        addToast("Mobile Mode Active", "Using cloud transcription for the best experience on your device.", "info");
      } else {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) addToast("Compatibility Mode", "Using cloud transcription. Results appear after stopping.", "warning");
      }
    }
  }, [isCloudMode, addToast]);

  const deleteAudio = useCallback(() => {
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
    }
    setAudioBlobUrl(null);
  }, [audioBlobUrl]);
  
  const stopListening = useCallback(() => {
    listeningIntentRef.current = false;
    
    if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop audio analysis
    if (audioAnalysisRef.current.animationFrameId) {
        cancelAnimationFrame(audioAnalysisRef.current.animationFrameId);
    }
    audioAnalysisRef.current.source?.disconnect();
    AudioContextManager.release('live-features');
    audioAnalysisRef.current = { analyser: null, source: null, animationFrameId: null };
    setLiveAudioFeatures({ volume: 0, pitch: 0 });
    
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
  }, [isCloudMode]);
  
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

  const transcribeFile = useCallback(async (file: File) => {
    if (isTranscribingFile || isListening) return;

    clearTranscript();
    setIsTranscribingFile(true);
    addToast('Processing Audio', 'Uploading and transcribing your file...', 'processing');

    try {
        const base64Audio = await blobToBase64(file);
        const result = await transcribeAudio(base64Audio, file.type);

        if (result.startsWith('Error:')) {
            addToast('Transcription Failed', result, 'error');
            setError(result);
        } else {
            addToast('Transcription Complete', 'Received transcript from cloud.', 'success');
            setFinalTranscript(result + ' ');
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred.';
        addToast('Transcription Failed', message, 'error');
        setError(message);
    } finally {
        setIsTranscribingFile(false);
    }
  }, [addToast, clearTranscript, isListening, isTranscribingFile]);


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
        
        // Setup live audio analysis
        const audioContext = AudioContextManager.acquire('live-features');
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        audioAnalysisRef.current = { analyser, source, animationFrameId: null };

        const analyze = () => {
            const { analyser } = audioAnalysisRef.current;
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);

                // Volume (RMS)
                const rms = Math.sqrt(dataArray.reduce((acc, val) => acc + (val * val), 0) / dataArray.length);
                const volume = rms / 128; // Normalize to approx 0-1 range

                // Pitch (simple max bin)
                let maxVal = -1;
                let maxIndex = -1;
                for (let i = 0; i < dataArray.length; i++) {
                    if (dataArray[i] > maxVal) {
                        maxVal = dataArray[i];
                        maxIndex = i;
                    }
                }
                const pitch = maxIndex * (audioContext.sampleRate / analyser.fftSize);

                setLiveAudioFeatures({ volume, pitch });
            }
            audioAnalysisRef.current.animationFrameId = requestAnimationFrame(analyze);
        };
        analyze();


        const needsMediaRecorder = isRecordingEnabled || isCloudMode;

        if (needsMediaRecorder) {
            const options = { mimeType: 'audio/webm' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} is not supported, falling back to default.`);
                // @ts-ignore
                options.mimeType = '';
            }

            const mediaRecorder = new MediaRecorder(mediaStream, options);
            mediaRecorderRef.current = mediaRecorder;
            const localAudioChunks: Blob[] = [];

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) localAudioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(localAudioChunks, { type: mimeType });

                if (isRecordingEnabled && audioBlob.size > 0) {
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
            
            if (isRecordingEnabled) {
              addToast('Listening Started', 'DefScribe is now recording your speech.', 'info');
            } else { // This means isCloudMode is true and isRecordingEnabled is false
              addToast('Listening Started', 'Using cloud transcription.', 'info');
            }
        } else { // This case is !isCloudMode and !isRecordingEnabled
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
    if (isCloudMode) {
      if (typeof window === 'undefined') {
        setError("Speech recognition is not available in this environment.");
      }
      return;
    }
    
    // This logic now only runs for desktop browsers with API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
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
      // Cleanup on unmount or when isCloudMode changes
      stopListening();
      if (recognitionRef.current) {
        (recognitionRef.current as any).onresult = undefined;
        recognitionRef.current.onend = null;
        (recognitionRef.current as any).onerror = undefined;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [isCloudMode, stopListening]);

  useEffect(() => {
    if (isListening && mediaRecorderRef.current && prevIsRecordingEnabled !== isRecordingEnabled) {
        if (isRecordingEnabled) {
            if (mediaRecorderRef.current.state === 'paused') {
                mediaRecorderRef.current.resume();
                addToast('Recording Resumed', 'Audio is now being recorded.', 'info');
            }
        } else {
            if (mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.pause();
                addToast('Recording Paused', 'Audio is not being recorded.', 'info');
            }
        }
    }
  }, [isRecordingEnabled, prevIsRecordingEnabled, isListening, addToast]);

  useEffect(() => {
    if (isCloudMode || !recognitionRef.current) return;
    recognitionRef.current.lang = spokenLanguage;
    if (isListening && spokenLanguage !== prevSpokenLanguage && prevSpokenLanguage !== undefined) {
        languageChangedWhileListening.current = true;
        recognitionRef.current?.stop();
    }
  }, [isListening, spokenLanguage, prevSpokenLanguage, isCloudMode]);

  return { isListening, transcript, finalTranscript, error, startListening, stopListening, clearTranscript, confidence: averageConfidence, isCloudMode, stream, audioBlobUrl, setAudioBlobUrl, deleteAudio, recordingDuration, transcribeFile, isTranscribingFile, liveAudioFeatures };
};

export default useSpeechRecognition;
