export interface TranscriptEntry {
  id: string;
  timestamp: string;
  rawTimestamp: number;
  text: string;
  isFinal: boolean;
  speakerIds?: SpeakerId[];
  endTimestamp?: number;
  translatedText?: string;
  isTranslating?: boolean;
}

export interface ActionItem {
  id: string;
  type: 'action' | 'decision';
  content: string;
  speakerId?: SpeakerId;
  speakerLabel?: string;
}

export interface Snippet {
  id: string;
  type: 'quote' | 'question' | 'insight';
  content: string;
  speakerId?: SpeakerId;
  speakerLabel?: string;
}

export interface ChatMessage {
  id:string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  translatedText?: string;
}

export interface TimelineEvent {
  startMs: number;
  endMs: number;
  type: 'topic' | 'sentiment';
  value: string; // topic name or sentiment value
}

export interface TopicSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export type SummaryStyle = 'basic' | 'detailed' | 'full';

export type Emotion = 
  | 'calm' | 'cold' | 'confused' | 'dizzy' | 'embarassed' | 'frustrated' 
  | 'goofy' | 'happy' | 'hurt' | 'intense' | 'listening' | 'loving' 
  | 'mad' | 'normal' | 'sad' | 'sleepy' | 'smug' | 'surprised' 
  | 'talking' | 'thinking';

export interface SpeechAnalytics {
  wpm: number;
  fillers: number;
  duration: number; // in seconds
  words: number;
  sentences: number;
  pauses: number;
  speakingRateLabel: 'Slow' | 'Medium' | 'Fast';
  emotionalTone: Emotion;
  emotionHistory: Emotion[];
  topics: TopicSegment[];
  talkTime: Record<SpeakerId, { percentage: number; seconds: number }>;
  vocabularyRichness: number; // percentage
  questionCount: number;
  avgSentenceLength: number; // in words
}

export type VisualizerStyle = 'wave' | 'bars' | 'circle';
export type VisualizerBackground = 'none' | 'starfield' | 'digitalRain';

// --- Diarization Types ---
export type SpeakerId = string; // e.g. "S1", "S2"

export interface SpeakerProfile {
  id: SpeakerId;
  label: string;
  color: string;
  isEditable?: boolean;
}

export interface DiarizationSegment {
  speakerId: SpeakerId;
  startMs: number;
  endMs: number;
}

export interface DiarizationSettings {
  enabled: boolean;
  mode: "local" | "cloud";
  expectedSpeakers: number;
}

export type StatCardKey = 
  | 'wpm' 
  | 'duration' 
  | 'pauses' 
  | 'fillers' 
  | 'words' 
  | 'speakingRateLabel'
  | 'vocabularyRichness'
  | 'questionCount'
  | 'avgSentenceLength';

export interface ProactiveMessage {
  id: number;
  text: string;
}

export interface GeneratedTitle {
  id: string;
  text: string;
}

export interface Session {
  id: string;
  title: string;
  timestamp: number;
  transcriptEntries: TranscriptEntry[];
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
  speechAnalytics: Partial<SpeechAnalytics>;
  summary: string;
  actionItems: ActionItem[];
  snippets: Snippet[];
  topics: TopicSegment[];
  titles: GeneratedTitle[];
}

export interface CosmicReading {
  coreStrand: string; // The name of the strand, e.g., "lotŭr"
  cardId: string; // The ID of the card, e.g., "radi_ace"
  modifiers: string[]; // Names of Fluons or Trinkets
  readingText: string;
}

export interface AuraData {
  dominantEmotion: Emotion;
  sentiment: number; // -1 (negative) to 1 (positive)
  keywords: string[];
}

export interface LiveAudioFeatures {
    volume: number; // 0 to 1
    pitch: number; // A representative frequency in Hz
}

export interface CognitiveDistortion {
    id: string;
    name: string;
    symbol: string;
    description: string;
}

export interface ReframingResult {
  id: string; // entryId
  thoughtPattern: string;
  reframedText: string;
  codexLink: string; // ID of the distortion
  isLoading?: boolean;
}