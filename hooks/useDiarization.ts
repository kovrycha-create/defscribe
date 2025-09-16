import { useState, useEffect, useRef, useCallback } from 'react';
import { type DiarizationSettings, type DiarizationSegment, type SpeakerId } from '../types';
import { AudioContextManager } from '../utils/AudioContextManager';
import { AUDIO_CONSTANTS } from '../constants/audio';

// Revamped interfaces for the new diarization model
interface AudioFeatures {
  energy: number;
  spectralFingerprint: number[]; // Vector of normalized energies in each SPECTRAL_BAND
  timestamp: number;
}

interface SpeakerModel {
  id: SpeakerId;
  featureCentroid: number[]; // The Exponential Moving Average (EMA) of spectral fingerprints for this speaker
}

// --- Vector Math Helpers ---
const dotProduct = (vecA: number[], vecB: number[]) => vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
const magnitude = (vec: number[]) => Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(vecA, vecB) / (magA * magB);
};

const useDiarization = (
  stream: MediaStream | null,
  settings: DiarizationSettings,
  startTime: number | null
) => {
  const [segments, setSegments] = useState<DiarizationSegment[]>([]);
  // FIX: Use useState for activeSpeaker to make it reactive for UI updates.
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerId | null>(null);

  // Refs for audio processing
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const sampleRateRef = useRef<number>(0);
  
  // Refs for diarization state
  const speakerModelsRef = useRef<Map<SpeakerId, SpeakerModel>>(new Map());
  const currentSegmentRef = useRef<DiarizationSegment | null>(null);
  const silenceFramesRef = useRef(0);
  const featureBufferRef = useRef<AudioFeatures[]>([]);
  
  const { 
      SPECTRAL_BANDS, FFT_SIZE, SPEAKER_SIMILARITY_THRESHOLD, SILENCE_THRESHOLD, 
      FEATURE_WINDOW_SIZE, SPEAKER_MODEL_UPDATE_ALPHA, MIN_SEGMENT_DURATION_MS, SILENCE_DURATION_MS 
  } = AUDIO_CONSTANTS;

  const calculateFeatures = useCallback((freqData: Uint8Array, sampleRate: number): Omit<AudioFeatures, 'timestamp'> => {
      // Overall energy (RMS of magnitudes)
      const energy = Math.sqrt(freqData.reduce((sum, val) => sum + val * val, 0) / freqData.length) / 255;
      
      const spectralFingerprint = new Array(SPECTRAL_BANDS.length).fill(0);
      let totalMagnitude = 0;
      const freqBinWidth = sampleRate / FFT_SIZE;

      for (let i = 0; i < freqData.length; i++) {
        const freq = i * freqBinWidth;
        const magnitude = freqData[i];
        if (magnitude === 0) continue;
        totalMagnitude += magnitude;

        for (let j = 0; j < SPECTRAL_BANDS.length; j++) {
            if (freq >= SPECTRAL_BANDS[j].range[0] && freq < SPECTRAL_BANDS[j].range[1]) {
                spectralFingerprint[j] += magnitude;
                break;
            }
        }
      }

      // Normalize the fingerprint vector to make it independent of volume
      if (totalMagnitude > 0) {
        for (let i = 0; i < spectralFingerprint.length; i++) {
            spectralFingerprint[i] /= totalMagnitude;
        }
      }

      return { energy, spectralFingerprint };
  }, [SPECTRAL_BANDS, FFT_SIZE]);

  const detectSpeaker = useCallback((fingerprint: number[]): SpeakerId => {
      const models = speakerModelsRef.current;
      if (models.size === 0 && settings.expectedSpeakers > 0) {
          const newId = 'S1' as SpeakerId;
          models.set(newId, { id: newId, featureCentroid: fingerprint });
          return newId;
      }

      let bestMatch: SpeakerId | null = null;
      let bestSimilarity = -1;

      models.forEach((model, id) => {
          const similarity = cosineSimilarity(fingerprint, model.featureCentroid);
          if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestMatch = id;
          }
      });

      if (bestMatch && bestSimilarity >= SPEAKER_SIMILARITY_THRESHOLD) {
          // Update the matched model using an Exponential Moving Average (EMA)
          const model = models.get(bestMatch)!;
          const alpha = SPEAKER_MODEL_UPDATE_ALPHA;
          model.featureCentroid = model.featureCentroid.map((val, i) => (1 - alpha) * val + alpha * fingerprint[i]);
          return bestMatch;
      }
      
      if (models.size < settings.expectedSpeakers) {
          const newId = `S${models.size + 1}` as SpeakerId;
          models.set(newId, { id: newId, featureCentroid: fingerprint });
          return newId;
      }
      
      return bestMatch || `S${models.size || 1}`; // Fallback to the closest match
  }, [settings.expectedSpeakers, SPEAKER_SIMILARITY_THRESHOLD, SPEAKER_MODEL_UPDATE_ALPHA]);

  const endCurrentSegment = useCallback((endTime: number) => {
    if (currentSegmentRef.current) {
        const segment = { ...currentSegmentRef.current, endMs: endTime };
        if (segment.endMs - segment.startMs >= MIN_SEGMENT_DURATION_MS) {
            setSegments(prev => [...prev, segment]);
        }
    }
    currentSegmentRef.current = null;
    setActiveSpeaker(null);
  }, [MIN_SEGMENT_DURATION_MS]);

  const processAudioFrame = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !startTime || !sampleRateRef.current) {
      if (settings.enabled) animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
      return;
    }

    const freqArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqArray);
    
    const { energy, spectralFingerprint } = calculateFeatures(freqArray, sampleRateRef.current);
    const currentTimeMs = Date.now() - startTime;

    if (energy > SILENCE_THRESHOLD) {
        silenceFramesRef.current = 0;
        featureBufferRef.current.push({ energy, spectralFingerprint, timestamp: currentTimeMs });
        
        if (featureBufferRef.current.length >= FEATURE_WINDOW_SIZE) {
            const windowFingerprint = featureBufferRef.current
                .reduce((acc, f) => {
                    f.spectralFingerprint.forEach((val, i) => acc[i] += val);
                    return acc;
                }, new Array(SPECTRAL_BANDS.length).fill(0))
                .map(val => val / featureBufferRef.current.length);

            const detectedSpeaker = detectSpeaker(windowFingerprint);
            
            if (activeSpeaker !== detectedSpeaker) {
                endCurrentSegment(currentTimeMs);
                setActiveSpeaker(detectedSpeaker);
                const firstTimestamp = featureBufferRef.current[0]?.timestamp || currentTimeMs;
                currentSegmentRef.current = {
                    speakerId: detectedSpeaker,
                    startMs: firstTimestamp,
                    endMs: currentTimeMs,
                };
            } else if (currentSegmentRef.current) {
                currentSegmentRef.current.endMs = currentTimeMs;
            }
            featureBufferRef.current = [];
        }
    } else {
        silenceFramesRef.current++;
        // Approximate frame duration based on how often rAF is called. This is not perfect but good enough.
        const frameDuration = 1000 / 60; 
        const silenceDuration = silenceFramesRef.current * frameDuration;
        
        if (silenceDuration >= SILENCE_DURATION_MS && activeSpeaker) {
            endCurrentSegment(currentTimeMs);
            featureBufferRef.current = [];
        }
    }

    animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
  }, [
      startTime, settings.enabled, calculateFeatures, detectSpeaker, endCurrentSegment, 
      SILENCE_THRESHOLD, FEATURE_WINDOW_SIZE, SILENCE_DURATION_MS, SPECTRAL_BANDS, activeSpeaker
  ]);

  const initializeAudioProcessing = useCallback(async () => {
    if (!stream || !settings.enabled || !startTime) return;

    try {
      const context = AudioContextManager.acquire('diarization');
      sampleRateRef.current = context.sampleRate;
      
      const source = context.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = AUDIO_CONSTANTS.SMOOTHING_TIME_CONSTANT;
      analyserRef.current = analyser;
      
      source.connect(analyser);

      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);

    } catch (err) {
      console.error('Error initializing audio processing for diarization:', err);
    }
  }, [stream, settings.enabled, startTime, processAudioFrame, FFT_SIZE]);

  const resetDiarization = useCallback(() => {
    setSegments([]);
    speakerModelsRef.current.clear();
    featureBufferRef.current = [];
    silenceFramesRef.current = 0;
    currentSegmentRef.current = null;
    setActiveSpeaker(null);
  }, []);

  const cleanup = useCallback(() => {
    if (currentSegmentRef.current && startTime) {
      endCurrentSegment(Date.now() - startTime);
    }
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    animationFrameIdRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    AudioContextManager.release('diarization');
  }, [startTime, endCurrentSegment]);

  useEffect(() => {
    if (stream && settings.enabled && startTime) {
      resetDiarization();
      initializeAudioProcessing();
    } else {
      cleanup();
    }
    return cleanup;
  }, [stream, settings.enabled, startTime, initializeAudioProcessing, cleanup, resetDiarization]);

  return { segments, activeSpeaker, resetDiarization };
};

export default useDiarization;
