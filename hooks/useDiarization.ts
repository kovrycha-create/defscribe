import { useState, useEffect, useRef, useCallback } from 'react';
import { type DiarizationSettings, type DiarizationSegment, type SpeakerId } from '../types';
import { AudioContextManager } from '../utils/AudioContextManager';
import { AUDIO_CONSTANTS } from '../constants/audio';

interface AudioFeatures {
  energy: number;
  pitch: number;
  spectralCentroid: number;
  timestamp: number;
}

interface SpeakerModel {
  id: SpeakerId;
  features: AudioFeatures[];
  avgEnergy: number;
  avgPitch: number;
  avgSpectralCentroid: number;
  lastSeen: number;
}

const useDiarization = (
  stream: MediaStream | null,
  settings: DiarizationSettings,
  startTime: number | null
) => {
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerId | null>(null);
  const [segments, setSegments] = useState<DiarizationSegment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const freqArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  const speakerModelsRef = useRef<Map<SpeakerId, SpeakerModel>>(new Map());
  const currentSegmentRef = useRef<DiarizationSegment | null>(null);
  const silenceCountRef = useRef(0);
  const featureBufferRef = useRef<AudioFeatures[]>([]);
  
  const {
    SILENCE_THRESHOLD,
    SILENCE_DURATION_MS,
    FEATURE_WINDOW_SIZE,
    SPEAKER_CHANGE_THRESHOLD,
    MIN_SEGMENT_DURATION_MS
  } = AUDIO_CONSTANTS;

  const calculateFeatures = useCallback((timeData: Uint8Array, freqData: Uint8Array, sampleRate: number): AudioFeatures => {
    const samples = new Float32Array(timeData.length);
    for (let i = 0; i < timeData.length; i++) {
      samples[i] = (timeData[i] - 128) / 128;
    }

    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const energy = Math.sqrt(sum / samples.length);

    let zeroCrossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const pitch = (zeroCrossings * sampleRate) / (2 * samples.length);

    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let i = 0; i < freqData.length; i++) {
      const magnitude = freqData[i];
      const freq = (i * sampleRate) / (AUDIO_CONSTANTS.FFT_SIZE);
      weightedSum += magnitude * freq;
      magnitudeSum += magnitude;
    }
    const spectralCentroid = magnitudeSum > 0 ? (weightedSum / magnitudeSum) : 0;

    return {
      energy,
      pitch,
      spectralCentroid,
      timestamp: Date.now()
    };
  }, []);

  const calculateSimilarity = useCallback((features1: AudioFeatures[], features2: AudioFeatures[]): number => {
    if (features1.length === 0 || features2.length === 0) return 0;

    const avg1 = {
      energy: features1.reduce((sum, f) => sum + f.energy, 0) / features1.length,
      pitch: features1.reduce((sum, f) => sum + f.pitch, 0) / features1.length,
      spectralCentroid: features1.reduce((sum, f) => sum + f.spectralCentroid, 0) / features1.length
    };

    const avg2 = {
      energy: features2.reduce((sum, f) => sum + f.energy, 0) / features2.length,
      pitch: features2.reduce((sum, f) => sum + f.pitch, 0) / features2.length,
      spectralCentroid: features2.reduce((sum, f) => sum + f.spectralCentroid, 0) / features2.length
    };

    const NORM_EPSILON = 0.1; // Add epsilon to prevent division by zero or small numbers

    const energyDiff = Math.abs(avg1.energy - avg2.energy) / (Math.max(avg1.energy, avg2.energy) + NORM_EPSILON);
    const pitchDiff = Math.abs(avg1.pitch - avg2.pitch) / (Math.max(avg1.pitch, avg2.pitch) + NORM_EPSILON);
    const spectralDiff = Math.abs(avg1.spectralCentroid - avg2.spectralCentroid) / (Math.max(avg1.spectralCentroid, avg2.spectralCentroid) + NORM_EPSILON);

    // Re-weighted to prioritize pitch more, as it's a key differentiator of voices
    const distance = (energyDiff * 0.2) + (pitchDiff * 0.5) + (spectralDiff * 0.3);
    
    return Math.max(0, 1 - distance);
  }, []);

  const detectSpeaker = useCallback((currentFeatures: AudioFeatures[]): SpeakerId => {
    const models = speakerModelsRef.current;
    
    if (models.size === 0 || models.size < settings.expectedSpeakers) {
      const newSpeakerId = `S${models.size + 1}` as SpeakerId;
      const newModel: SpeakerModel = {
        id: newSpeakerId,
        features: [...currentFeatures],
        avgEnergy: currentFeatures.reduce((sum, f) => sum + f.energy, 0) / currentFeatures.length,
        avgPitch: currentFeatures.reduce((sum, f) => sum + f.pitch, 0) / currentFeatures.length,
        avgSpectralCentroid: currentFeatures.reduce((sum, f) => sum + f.spectralCentroid, 0) / currentFeatures.length,
        lastSeen: Date.now()
      };
      models.set(newSpeakerId, newModel);
      return newSpeakerId;
    }

    let bestMatch: SpeakerId | null = null;
    let bestSimilarity = 0;

    models.forEach((model) => {
      const similarity = calculateSimilarity(currentFeatures, model.features.slice(-FEATURE_WINDOW_SIZE));
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = model.id;
      }
    });

    if (bestSimilarity < (1 - SPEAKER_CHANGE_THRESHOLD) && models.size < settings.expectedSpeakers) {
      const newSpeakerId = `S${models.size + 1}` as SpeakerId;
      const newModel: SpeakerModel = {
        id: newSpeakerId,
        features: [...currentFeatures],
        avgEnergy: currentFeatures.reduce((sum, f) => sum + f.energy, 0) / currentFeatures.length,
        avgPitch: currentFeatures.reduce((sum, f) => sum + f.pitch, 0) / currentFeatures.length,
        avgSpectralCentroid: currentFeatures.reduce((sum, f) => sum + f.spectralCentroid, 0) / currentFeatures.length,
        lastSeen: Date.now()
      };
      models.set(newSpeakerId, newModel);
      return newSpeakerId;
    }

    if (bestMatch) {
      const model = models.get(bestMatch)!;
      model.features = [...model.features.slice(-FEATURE_WINDOW_SIZE), ...currentFeatures];
      model.lastSeen = Date.now();
      
      const allFeatures = model.features;
      model.avgEnergy = allFeatures.reduce((sum, f) => sum + f.energy, 0) / allFeatures.length;
      model.avgPitch = allFeatures.reduce((sum, f) => sum + f.pitch, 0) / allFeatures.length;
      model.avgSpectralCentroid = allFeatures.reduce((sum, f) => sum + f.spectralCentroid, 0) / allFeatures.length;
    }

    return bestMatch || 'S1' as SpeakerId;
  }, [calculateSimilarity, settings.expectedSpeakers]);

  const endCurrentSegment = useCallback((endTime: number) => {
    if (currentSegmentRef.current) {
      const segment = currentSegmentRef.current;
      segment.endMs = endTime;
      
      if (segment.endMs - segment.startMs >= MIN_SEGMENT_DURATION_MS) {
        setSegments(prev => [...prev, segment]);
      }
      
      currentSegmentRef.current = null;
      setActiveSpeaker(null);
    }
  }, []);

  const processAudioFrame = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current || !freqArrayRef.current || !startTime) {
      if (settings.enabled) {
        animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
      }
      return;
    }

    analyserRef.current.getByteTimeDomainData(dataArrayRef.current as any);
    analyserRef.current.getByteFrequencyData(freqArrayRef.current as any);
    const audioContext = AudioContextManager.acquire('diarization');
    const sampleRate = audioContext.sampleRate;
    AudioContextManager.release('diarization');
    
    const currentTime = Date.now() - startTime;
    const features = calculateFeatures(dataArrayRef.current, freqArrayRef.current, sampleRate);

    if (features.energy < SILENCE_THRESHOLD) {
      silenceCountRef.current++;
      const silenceDuration = (silenceCountRef.current * (dataArrayRef.current.length / sampleRate)) * 1000;
      
      if (silenceDuration > SILENCE_DURATION_MS && currentSegmentRef.current) {
        endCurrentSegment(currentTime);
        featureBufferRef.current = [];
      }
    } else {
      silenceCountRef.current = 0;

      featureBufferRef.current.push(features);
      if (featureBufferRef.current.length > FEATURE_WINDOW_SIZE) {
        featureBufferRef.current = featureBufferRef.current.slice(-FEATURE_WINDOW_SIZE);
      }

      if (featureBufferRef.current.length < 3) {
        // Not enough features yet
      } else {
        const detectedSpeaker = detectSpeaker(featureBufferRef.current);

        if (!currentSegmentRef.current || currentSegmentRef.current.speakerId !== detectedSpeaker) {
          if (currentSegmentRef.current) {
            endCurrentSegment(currentTime);
          }

          currentSegmentRef.current = {
            speakerId: detectedSpeaker,
            startMs: currentTime,
            endMs: currentTime + 100
          };

          setActiveSpeaker(detectedSpeaker);
        } else {
          currentSegmentRef.current.endMs = currentTime;
        }
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);
  }, [startTime, calculateFeatures, detectSpeaker, endCurrentSegment, settings.enabled]);


  const initializeAudioProcessing = useCallback(async () => {
    if (!stream || !settings.enabled || !startTime) return;

    try {
      setIsProcessing(true);
      setError(null);

      const context = AudioContextManager.acquire('diarization');
      
      if (context.state === 'suspended') {
        await context.resume();
      }

      const source = context.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      
      const analyser = context.createAnalyser();
      analyser.fftSize = AUDIO_CONSTANTS.FFT_SIZE;
      analyser.smoothingTimeConstant = AUDIO_CONSTANTS.SMOOTHING_TIME_CONSTANT;
      analyserRef.current = analyser;

      dataArrayRef.current = new Uint8Array(analyser.fftSize);
      freqArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      
      source.connect(analyser);

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      animationFrameIdRef.current = requestAnimationFrame(processAudioFrame);

    } catch (err) {
      console.error('Error initializing audio processing:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize audio processing.');
    } finally {
      setIsProcessing(false);
    }
  }, [stream, settings.enabled, startTime, processAudioFrame]);

  const resetDiarization = useCallback(() => {
    setSegments([]);
    speakerModelsRef.current.clear();
    featureBufferRef.current = [];
    silenceCountRef.current = 0;
    currentSegmentRef.current = null;
    setActiveSpeaker(null);
  }, []);

  const cleanup = useCallback(() => {
    if (currentSegmentRef.current && startTime) {
      endCurrentSegment(Date.now() - startTime);
    }
    
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    
    AudioContextManager.release('diarization');
    setIsProcessing(false);
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

  return { 
    activeSpeaker, 
    isProcessing, 
    error,
    segments,
    resetDiarization
  };
};

export default useDiarization;