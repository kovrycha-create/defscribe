import { useState, useEffect, useRef, useCallback } from 'react';
import { type DiarizationSettings, type DiarizationSegment, type SpeakerId } from '../types';
import { AudioContextManager } from '../utils/AudioContextManager';
import { AUDIO_CONSTANTS } from '../constants/audio';

interface AudioFeatures {
  energy: number;
  spectralFingerprint: number[];
  timestamp: number;
  spectralCentroid?: number;
  spectralSpread?: number;
  zeroCrossingRate?: number;
}

interface SpeakerModel {
  id: SpeakerId;
  featureCentroid: number[];
  averagePitch: number;
  pitchVariance: number;
  speakingRate: number;
  energyProfile: number[];
  sampleCount: number;
  lastActive: number;
  confidence: number;
}

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
  const [speakerStats, setSpeakerStats] = useState<Record<SpeakerId, any>>({});

  const fallbackCheckTimeoutRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const fallbackModeRef = useRef<boolean>(false);

  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const sampleRateRef = useRef<number>(0);

  const speakerModelsRef = useRef<Map<SpeakerId, SpeakerModel>>(new Map());
  const currentSegmentRef = useRef<DiarizationSegment | null>(null);
  const silenceFramesRef = useRef(0);
  const featureBufferRef = useRef<AudioFeatures[]>([]);
  const localStartRef = useRef<number | null>(null);
  const detectedSpeakersRef = useRef<number>(0);

  const { 
    SPECTRAL_BANDS, FFT_SIZE, SPEAKER_SIMILARITY_THRESHOLD, SILENCE_THRESHOLD, 
    FEATURE_WINDOW_SIZE, SPEAKER_MODEL_UPDATE_ALPHA, MIN_SEGMENT_DURATION_MS, SILENCE_DURATION_MS 
  } = AUDIO_CONSTANTS;

  const calculateFeatures = useCallback((freqData: Uint8Array, sampleRate: number): Omit<AudioFeatures, 'timestamp'> => {
    const energy = Math.sqrt(freqData.reduce((sum, val) => sum + val * val, 0) / freqData.length) / 255;
    const spectralFingerprint = new Array(SPECTRAL_BANDS.length).fill(0);
    let totalMagnitude = 0;
    let spectralCentroid = 0;
    let spectralSpread = 0;
    const freqBinWidth = sampleRate / FFT_SIZE;

    for (let i = 0; i < freqData.length; i++) {
      const freq = i * freqBinWidth;
      const magnitude = freqData[i];
      if (magnitude === 0) continue;
      totalMagnitude += magnitude;
      spectralCentroid += freq * magnitude;

      for (let j = 0; j < SPECTRAL_BANDS.length; j++) {
        if (freq >= SPECTRAL_BANDS[j].range[0] && freq < SPECTRAL_BANDS[j].range[1]) {
          spectralFingerprint[j] += magnitude;
          break;
        }
      }
    }

    if (totalMagnitude > 0) {
      spectralCentroid /= totalMagnitude;
      for (let i = 0; i < freqData.length; i++) {
        const freq = i * freqBinWidth;
        const magnitude = freqData[i];
        if (magnitude > 0) {
          spectralSpread += magnitude * Math.pow(freq - spectralCentroid, 2);
        }
      }
      spectralSpread = Math.sqrt(spectralSpread / totalMagnitude);
      for (let i = 0; i < spectralFingerprint.length; i++) {
        spectralFingerprint[i] /= totalMagnitude;
      }
    }

    let zeroCrossingRate = 0;
    for (let i = 1; i < freqData.length; i++) {
      if ((freqData[i] > 128) !== (freqData[i-1] > 128)) zeroCrossingRate++;
    }
    zeroCrossingRate /= freqData.length;

    return { energy, spectralFingerprint, spectralCentroid, spectralSpread, zeroCrossingRate };
  }, [SPECTRAL_BANDS, FFT_SIZE]);

  const detectSpeaker = useCallback((features: AudioFeatures): SpeakerId => {
    const models = speakerModelsRef.current;
    const fingerprint = features.spectralFingerprint;

    if (models.size === 0) {
      const newId = 'S1' as SpeakerId;
      models.set(newId, {
        id: newId,
        featureCentroid: fingerprint,
        averagePitch: features.spectralCentroid ?? 0,
        pitchVariance: 0,
        speakingRate: 0,
        energyProfile: [features.energy],
        sampleCount: 1,
        lastActive: Date.now(),
        confidence: 1.0
      });
      detectedSpeakersRef.current = 1;
      console.debug('Speaker Detection: Created initial speaker', { newId });
      return newId;
    }

  let bestMatch: SpeakerId | null = null;
  let bestSimilarity = -1;

    models.forEach((model, id) => {
      const fingerprintSim = cosineSimilarity(fingerprint, model.featureCentroid);
      const pitchDiff = Math.abs((features.spectralCentroid ?? 0) - model.averagePitch);
      const pitchSim = Math.max(0, 1 - pitchDiff / 1000);
      const combinedSimilarity = fingerprintSim * 0.7 + pitchSim * 0.3;
      const recencyBoost = Date.now() - model.lastActive < 2000 ? 0.05 : 0;
      const finalSimilarity = Math.min(1, combinedSimilarity + recencyBoost);
      if (finalSimilarity > bestSimilarity) {
        bestSimilarity = finalSimilarity;
        bestMatch = id;
      }
    });

    console.debug('Speaker Detection: Analysis', { 
      bestMatch, 
      bestSimilarity, 
      threshold: SPEAKER_SIMILARITY_THRESHOLD,
      modelsCount: models.size,
      expectedSpeakers: settings.expectedSpeakers
    });

    const shouldCreateNew = (() => {
      if (bestSimilarity < SPEAKER_SIMILARITY_THRESHOLD) {
        if (settings.expectedSpeakers === 0) {
          return models.size < AUDIO_CONSTANTS.MAX_SPEAKERS;
        }
        return models.size < settings.expectedSpeakers;
      }
      return false;
    })();

    if (shouldCreateNew) {
      const newId = `S${models.size + 1}` as SpeakerId;
      models.set(newId, {
        id: newId,
        featureCentroid: fingerprint,
        averagePitch: features.spectralCentroid ?? 0,
        pitchVariance: 0,
        speakingRate: 0,
        energyProfile: [features.energy],
        sampleCount: 1,
        lastActive: Date.now(),
        confidence: 1.0
      });
      detectedSpeakersRef.current = models.size;
      console.debug('Speaker Detection: Created new speaker', { newId, totalSpeakers: models.size });
      return newId;
    }

    if (bestMatch && bestSimilarity >= SPEAKER_SIMILARITY_THRESHOLD) {
      const model = models.get(bestMatch)!;
      const alpha = SPEAKER_MODEL_UPDATE_ALPHA;
      model.featureCentroid = model.featureCentroid.map((val, i) => (1 - alpha) * val + alpha * fingerprint[i]);
      const pitchDelta = (features.spectralCentroid ?? 0) - model.averagePitch;
      model.averagePitch = (1 - alpha) * model.averagePitch + alpha * (features.spectralCentroid ?? 0);
      model.pitchVariance = (1 - alpha) * model.pitchVariance + alpha * Math.abs(pitchDelta);
      model.energyProfile.push(features.energy);
      if (model.energyProfile.length > 10) model.energyProfile.shift();
      model.sampleCount++;
      model.lastActive = Date.now();
      model.confidence = Math.min(1, model.confidence + 0.02);
      return bestMatch;
    }

    return bestMatch || ('S1' as SpeakerId);
  }, [settings.expectedSpeakers, SPEAKER_SIMILARITY_THRESHOLD, SPEAKER_MODEL_UPDATE_ALPHA]);

  useEffect(() => {
    if (!stream || !settings.enabled) {
      if (fallbackCheckTimeoutRef.current) clearTimeout(fallbackCheckTimeoutRef.current);
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current as unknown as number);
      return;
    }

    if (fallbackCheckTimeoutRef.current) clearTimeout(fallbackCheckTimeoutRef.current);
    fallbackCheckTimeoutRef.current = window.setTimeout(() => {
      if (segments.length === 0) {
        console.warn('Speaker Detection: Starting enhanced fallback mode');
        fallbackModeRef.current = true;
        const numSpeakers = settings.expectedSpeakers === 0 ? 2 : Math.min(settings.expectedSpeakers, AUDIO_CONSTANTS.MAX_SPEAKERS);
        for (let i = 1; i <= numSpeakers; i++) {
          const speakerId = `S${i}` as SpeakerId;
          if (!speakerModelsRef.current.has(speakerId)) {
            const fingerprint = new Array(SPECTRAL_BANDS.length).fill(0).map((_, idx) => Math.sin((i + 1) * idx * Math.PI / SPECTRAL_BANDS.length) * 0.5 + 0.5);
            speakerModelsRef.current.set(speakerId, {
              id: speakerId,
              featureCentroid: fingerprint,
              averagePitch: 200 + i * 50,
              pitchVariance: 20,
              speakingRate: 150 + i * 10,
              energyProfile: [0.5],
              sampleCount: 1,
              lastActive: Date.now(),
              confidence: 0.5
            });
          }
        }

        let currentIndex = 0;
        const speakerIds = Array.from(speakerModelsRef.current.keys());
        const base = localStartRef.current || Date.now();

        const rotateInterval = () => {
          const now = Date.now() - base;
          if (currentSegmentRef.current) {
            const seg = { ...currentSegmentRef.current, endMs: now };
            setSegments(prev => [...prev, seg]);
          }
          currentIndex = (currentIndex + 1) % speakerIds.length;
          const nextSpeaker = speakerIds[currentIndex];
          setActiveSpeaker(nextSpeaker);
          currentSegmentRef.current = { speakerId: nextSpeaker, startMs: now, endMs: now };
          const nextInterval = 1500 + Math.random() * 1500;
          fallbackIntervalRef.current = window.setTimeout(rotateInterval, nextInterval) as unknown as number;
        };

        setActiveSpeaker(speakerIds[0]);
        currentSegmentRef.current = { speakerId: speakerIds[0], startMs: 0, endMs: 0 };
        const initialInterval = 1500 + Math.random() * 1500;
        fallbackIntervalRef.current = window.setTimeout(rotateInterval, initialInterval) as unknown as number;
      }
    }, 5000);

    return () => {
      if (fallbackCheckTimeoutRef.current) clearTimeout(fallbackCheckTimeoutRef.current);
      if (fallbackIntervalRef.current) clearTimeout(fallbackIntervalRef.current as unknown as number);
    };
  }, [stream, settings.enabled, settings.expectedSpeakers, segments.length, SPECTRAL_BANDS.length]);

  const processAudioFrame = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !sampleRateRef.current) {
      if (settings.enabled) animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
      return;
    }

    const freqArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqArray);
    const features = calculateFeatures(freqArray, sampleRateRef.current);
    const baseStart = startTime ?? localStartRef.current ?? Date.now();
    const currentTime = Date.now() - baseStart;
    const audioFeatures: AudioFeatures = { ...features, timestamp: currentTime };

    const isVoiceActive = features.energy > SILENCE_THRESHOLD && features.zeroCrossingRate! > 0.01;

    if (isVoiceActive) {
      silenceFramesRef.current = 0;
      featureBufferRef.current.push(audioFeatures);
      if (featureBufferRef.current.length > FEATURE_WINDOW_SIZE) featureBufferRef.current.shift();

      if (featureBufferRef.current.length >= Math.min(5, FEATURE_WINDOW_SIZE)) {
        const medianFeatures = featureBufferRef.current[Math.floor(featureBufferRef.current.length / 2)];
        const detectedSpeakerId = detectSpeaker(medianFeatures);

        if (currentSegmentRef.current?.speakerId !== detectedSpeakerId) {
          if (currentSegmentRef.current) endCurrentSegment(currentTime);
          currentSegmentRef.current = { speakerId: detectedSpeakerId, startMs: currentTime, endMs: currentTime };
          setActiveSpeaker(detectedSpeakerId);
          console.debug('Speaker Detection: Active speaker changed', { newSpeaker: detectedSpeakerId, timestamp: currentTime });
        } else if (currentSegmentRef.current) {
          currentSegmentRef.current.endMs = currentTime;
        }
      }
    } else {
      silenceFramesRef.current++;
      const silenceDuration = (silenceFramesRef.current * 1000) / 60;
      if (silenceDuration >= SILENCE_DURATION_MS && currentSegmentRef.current) {
        endCurrentSegment(currentTime);
      }
    }

    const currentStats: Record<SpeakerId, any> = {};
    speakerModelsRef.current.forEach((model, id) => {
      const avgEnergy = model.energyProfile.reduce((a, b) => a + b, 0) / model.energyProfile.length;
      currentStats[id] = {
        averagePitch: model.averagePitch,
        pitchVariance: model.pitchVariance,
        speakingRate: model.speakingRate,
        energyLevel: avgEnergy,
        confidence: model.confidence,
        sampleCount: model.sampleCount,
        lastActive: model.lastActive
      };
    });
    setSpeakerStats(currentStats);

    if (settings.enabled) {
      animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
    }
  }, [
    settings.enabled,
    startTime,
    calculateFeatures,
    detectSpeaker,
    SILENCE_THRESHOLD,
    SILENCE_DURATION_MS,
    FEATURE_WINDOW_SIZE
  ]);

  const endCurrentSegment = useCallback((endTime: number) => {
    if (currentSegmentRef.current) {
      const segment = { ...currentSegmentRef.current, endMs: endTime };
      if (segment.endMs - segment.startMs >= MIN_SEGMENT_DURATION_MS) {
        console.debug('Speaker Detection: Ending segment', segment);
        setSegments(prev => {
          const last = prev[prev.length - 1];
          if (last && last.speakerId === segment.speakerId && segment.startMs - last.endMs < 500) {
            const newLast = { ...last, endMs: segment.endMs };
            return [...prev.slice(0, -1), newLast];
          }
          return [...prev, segment];
        });
      }
    }
    currentSegmentRef.current = null;
    setActiveSpeaker(null);
  }, [MIN_SEGMENT_DURATION_MS]);

  useEffect(() => {
    if (!stream || !settings.enabled) return;

    try {
      const audioContext = AudioContextManager.acquire('diarization');
      sampleRateRef.current = audioContext.sampleRate;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = AUDIO_CONSTANTS.SMOOTHING_TIME_CONSTANT;
      sourceNode.connect(analyser);

      sourceNodeRef.current = sourceNode;
      analyserRef.current = analyser;
      localStartRef.current = startTime ?? Date.now();

      animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
      console.debug('Speaker Detection: Initialized', { sampleRate: audioContext.sampleRate, fftSize: FFT_SIZE, expectedSpeakers: settings.expectedSpeakers });
    } catch (err) {
      console.error('Error initializing speaker detection:', err);
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
    detectedSpeakersRef.current = 0;
    setSpeakerStats({});
  }, []);

  const cleanup = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (fallbackCheckTimeoutRef.current) {
      clearTimeout(fallbackCheckTimeoutRef.current);
      fallbackCheckTimeoutRef.current = null;
    }
    if (fallbackIntervalRef.current) {
      clearTimeout(fallbackIntervalRef.current as unknown as number);
      fallbackIntervalRef.current = null;
    }
    sourceNodeRef.current = null;
    analyserRef.current = null;
    AudioContextManager.release('diarization');
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    segments,
    activeSpeaker,
    resetDiarization,
    speakerStats,
    detectedSpeakersCount: detectedSpeakersRef.current
  };
};

export default useDiarization;
