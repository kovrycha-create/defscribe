export const AUDIO_CONSTANTS = {
  // Silence Detection
  SILENCE_THRESHOLD: 0.008, // Slightly more sensitive
  SILENCE_DURATION_MS: 1000, // Require a full second of silence to end a segment

  // Feature Extraction
  FFT_SIZE: 2048,
  SMOOTHING_TIME_CONSTANT: 0.8,
  FEATURE_WINDOW_SIZE: 15, // A larger window for more stable features
  
  // Frequency bands for spectral fingerprinting (approximates Mel scale)
  SPECTRAL_BANDS: [
    { name: 'sub-bass', range: [20, 100] },
    { name: 'bass', range: [100, 300] },
    { name: 'low-mid', range: [300, 700] },
    { name: 'mid', range: [700, 1500] },
    { name: 'high-mid', range: [1500, 4000] },
    { name: 'presence', range: [4000, 8000] },
    { name: 'brilliance', range: [8000, 20000] },
  ],

  // Speaker Recognition
  SPEAKER_SIMILARITY_THRESHOLD: 0.85, // Cosine similarity must be >= this to match
  MIN_SEGMENT_DURATION_MS: 750, // Minimum duration for a segment to be saved
  SPEAKER_MODEL_UPDATE_ALPHA: 0.1, // EMA alpha for updating speaker model centroids
  MAX_SPEAKERS: 6,
} as const;
