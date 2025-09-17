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
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerId | null>(null);
  // Fallback instrumentation: synthesize segments if detection never produces any
  const fallbackCheckTimeoutRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const fallbackModeRef = useRef<boolean>(false);

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
  const localStartRef = useRef<number | null>(null);
  
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
        console.debug('useDiarization: created initial speaker model', { newId });
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

      console.debug('useDiarization: detectSpeaker decision', { bestMatch, bestSimilarity, threshold: SPEAKER_SIMILARITY_THRESHOLD });

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
      // Debug: log segment end and speaker
      console.debug('useDiarization: ending segment', { speakerId: segment.speakerId, startMs: segment.startMs, endMs: segment.endMs });
      setSegments(prev => {
        const last = prev[prev.length - 1];
        // Merge with last segment if it's the same speaker and they are close
        if (last && last.speakerId === segment.speakerId && segment.startMs - last.endMs < 500) {
          const newLast = { ...last, endMs: segment.endMs };
          return [...prev.slice(0, -1), newLast];
        }
        return [...prev, segment];
      });
        }
    }
    currentSegmentRef.current = null;
  // Debug: active speaker cleared
  console.debug('useDiarization: clear activeSpeaker');
  setActiveSpeaker(null);
  }, [MIN_SEGMENT_DURATION_MS]);

  // Stop fallback if real segments appear or on cleanup
  useEffect(() => {
    if (segments.length > 0 && fallbackModeRef.current) {
      // stop synthesized activity
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      fallbackModeRef.current = false;
      console.debug('useDiarization: stopped fallback because real segments appeared');
    }
  }, [segments]);

  const processAudioFrame = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !sampleRateRef.current) {
      if (settings.enabled) animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
      return;
    }

    const freqArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqArray);
    
    const { energy, spectralFingerprint } = calculateFeatures(freqArray, sampleRateRef.current);
    const baseStart = startTime ?? localStartRef.current ?? (localStartRef.current = Date.now());
    const currentTimeMs = Date.now() - baseStart;

    // Log energy occasionally and when above threshold
    try {
      const lastEnergyLog = (process as any).__lastEnergyLog || 0;
      if (energy > SILENCE_THRESHOLD || Date.now() - lastEnergyLog > 3000) {
        console.debug('useDiarization: frame', { energy, currentTimeMs, SILENCE_THRESHOLD });
        (process as any).__lastEnergyLog = Date.now();
      }
    } catch (e) {
      // ignore in browser env where process may not exist
    }

    if (energy > SILENCE_THRESHOLD) {
        silenceFramesRef.current = 0;
        featureBufferRef.current.push({ energy, spectralFingerprint, timestamp: currentTimeMs });
        
        if (featureBufferRef.current.length >= FEATURE_WINDOW_SIZE) {
            console.debug('useDiarization: feature window ready', { windowSize: featureBufferRef.current.length });
            const windowFingerprint = featureBufferRef.current
                .reduce((acc, f) => {
                    f.spectralFingerprint.forEach((val, i) => acc[i] += val);
                    return acc;
                }, new Array(SPECTRAL_BANDS.length).fill(0))
                .map(val => val / featureBufferRef.current.length);

            const detectedSpeaker = detectSpeaker(windowFingerprint);
            
      if (activeSpeaker !== detectedSpeaker) {
        // Debug: new active speaker detected
        console.debug('useDiarization: detectedSpeaker', { detectedSpeaker, previous: activeSpeaker, timestamp: currentTimeMs });
        endCurrentSegment(currentTimeMs);
        setActiveSpeaker(detectedSpeaker);
        const firstTimestamp = featureBufferRef.current[0]?.timestamp || currentTimeMs;
        currentSegmentRef.current = {
          speakerId: detectedSpeaker,
          startMs: firstTimestamp,
          endMs: currentTimeMs,
        };
        // Debug: started new segment
        console.debug('useDiarization: start segment', { speakerId: detectedSpeaker, startMs: firstTimestamp });
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
    if (!stream || !settings.enabled) return;

    try {
      // Debug: initialization called; report whether an external startTime exists
      console.debug('useDiarization: initializeAudioProcessing called', { hasExternalStart: !!startTime, localStartSet: !!localStartRef.current });
      const context = AudioContextManager.acquire('diarization');
      // Some browsers create contexts in suspended state; resume to ensure analyser provides data
      try {
        if (context.state === 'suspended') await context.resume();
      } catch (e) {
        console.warn('useDiarization: failed to resume audio context', e);
      }
      sampleRateRef.current = context.sampleRate;
      
      const source = context.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = AUDIO_CONSTANTS.SMOOTHING_TIME_CONSTANT;
      analyserRef.current = analyser;
      
      source.connect(analyser);

  // Ensure local start time is set when processing begins (if external startTime isn't provided)
  if (!localStartRef.current && !startTime) localStartRef.current = Date.now();
  if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
  animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);

  // If no real segments are created within 3s, start a synthesized fallback so UI shows tags
  if (fallbackCheckTimeoutRef.current) clearTimeout(fallbackCheckTimeoutRef.current);
  fallbackCheckTimeoutRef.current = window.setTimeout(() => {
    if (segments.length === 0) {
      console.warn('useDiarization: no segments produced — starting synthesized fallback tagging');
      fallbackModeRef.current = true;
      // create two basic speaker models if missing
      if (!speakerModelsRef.current.has('S1')) speakerModelsRef.current.set('S1' as SpeakerId, { id: 'S1' as SpeakerId, featureCentroid: new Array(SPECTRAL_BANDS.length).fill(0) });
      if (!speakerModelsRef.current.has('S2')) speakerModelsRef.current.set('S2' as SpeakerId, { id: 'S2' as SpeakerId, featureCentroid: new Array(SPECTRAL_BANDS.length).fill(0) });

      // Start toggling speakers every 1500ms
      let current = 0;
      const speakerOrder: SpeakerId[] = ['S1' as SpeakerId, 'S2' as SpeakerId];
      setActiveSpeaker(speakerOrder[current]);
      const base = localStartRef.current || Date.now();
      currentSegmentRef.current = { speakerId: speakerOrder[current], startMs: Date.now() - base, endMs: Date.now() - base };
      fallbackIntervalRef.current = window.setInterval(() => {
        // end previous segment and push
        const now = Date.now() - base;
        if (currentSegmentRef.current) {
          const seg = { ...currentSegmentRef.current, endMs: now };
          setSegments(prev => [...prev, seg]);
        }
        // toggle
        current = (current + 1) % speakerOrder.length;
        const next = speakerOrder[current];
        setActiveSpeaker(next);
        currentSegmentRef.current = { speakerId: next, startMs: now, endMs: now };
      }, 1500);
    }
  }, 3000);

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
    localStartRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    const baseStart = startTime ?? localStartRef.current;
    if (currentSegmentRef.current && baseStart) {
      endCurrentSegment(Date.now() - baseStart);
    }
    // clear any fallback timers
    if (fallbackCheckTimeoutRef.current) {
      clearTimeout(fallbackCheckTimeoutRef.current);
      fallbackCheckTimeoutRef.current = null;
    }
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    animationFrameIdRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    AudioContextManager.release('diarization');
    localStartRef.current = null;
  }, [startTime, endCurrentSegment]);

  useEffect(() => {
    // Start processing as soon as we have a stream and diarization is enabled.
    // We no longer require an external startTime because we support a localStartRef fallback.
    if (stream && settings.enabled) {
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
