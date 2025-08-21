import { type TranscriptEntry, type SpeakerProfile, type SpeakerId, type ActionItem, type Snippet, type SpeechAnalytics, type SummaryStyle } from './types';

// 🔮 Astril Continuum Universe (ACU) flavored sample data for DefScribe guided tour
// Drop-in replacement for the original placeholders.

export const SAMPLE_SPEAKER_PROFILES: Record<SpeakerId, SpeakerProfile> = {
  S1: { id: 'S1', label: 'Ymzo',   color: '#a78bfa', isEditable: true }, // violet arcane
  S2: { id: 'S2', label: 'Sinira', color: '#f472b6', isEditable: true }, // rebel magenta
};

export const SAMPLE_TRANSCRIPT_ENTRIES: TranscriptEntry[] = [
  {
    id: 'entry-1',
    rawTimestamp: 1700000000000,
    timestamp: '10:00:00 AM',
    text: "Sinira, let's sync on the HYRUM Sentinel dashboard. What's the status on the Fluon analytics integration?",
    isFinal: true,
    speakerIds: ['S1'],
  },
  {
    id: 'entry-2',
    rawTimestamp: 1700000005000,
    timestamp: '10:00:05 AM',
    text: "Hey Ymzo. Good momentum—charts are rendering and the Cosmik trendlines look clean. I hit a snag with real-time Ylem flux updates, though. Polling the leyline bus is too jittery. I've got a solution in mind.",
    isFinal: true,
    speakerIds: ['S2'],
  },
  {
    id: 'entry-3',
    rawTimestamp: 1700000012000,
    timestamp: '10:00:12 AM',
    text: "Outline it. We need AHYBE-safe stability and scalability. No cross-talk with corrupted leylines.",
    isFinal: true,
    speakerIds: ['S1'],
  },
  {
    id: 'entry-4',
    rawTimestamp: 1700000018000,
    timestamp: '10:00:18 AM',
    text: "Switching to RiftSockets for the livefeed—more efficient than polling. I'll spin up a Convergence broker on the server-side and route through the Ailo relay to smooth the bursts. I do need approval for additional AHYBE-compliant relay capacity.",
    isFinal: true,
    speakerIds: ['S2'],
  },
  {
    id: 'entry-5',
    rawTimestamp: 1700000026000,
    timestamp: '10:00:26 AM',
    text: "Approved. Create a ticket for the extra relay quotas and assign it to me. I want a working demo before the minor Convergence—call it Friday. Feasible?",
    isFinal: true,
    speakerIds: ['S1'],
  },
  {
    id: 'entry-6',
    rawTimestamp: 1700000034000,
    timestamp: '10:00:34 AM',
    text: "Friday is tight but doable. I’ll prioritize RiftSockets over UI gloss. This is the critical artery.",
    isFinal: true,
    speakerIds: ['S2'],
  },
];

export const SAMPLE_ANALYTICS: Partial<SpeechAnalytics> = {
  wpm: 158,
  fillers: 2,
  duration: 40,
  words: 170,
  sentences: 6,
  pauses: 5,
  speakingRateLabel: 'Medium',
  emotionalTone: 'thinking',
  topics: ['HYRUM Sentinel Dashboard', 'Fluon Analytics', 'RiftSockets', 'AHYBE Relay Quotas', 'Convergence Demo'],
  talkTime: {
    S1: { percentage: 46, seconds: 18 },
    S2: { percentage: 54, seconds: 22 },
  },
  vocabularyRichness: 70,
  questionCount: 3,
  avgSentenceLength: 28,
};

export const SAMPLE_SUMMARIES: Record<SummaryStyle, string> = {
  basic:
    "Ymzo and Sinira reviewed progress on the HYRUM Sentinel dashboard. Sinira proposed replacing polled leyline updates with RiftSockets for stable real-time Ylem flux. Ymzo approved additional AHYBE-compliant relay capacity and requested a working demo by Friday (minor Convergence).",
  detailed:
    "In a status sync for the HYRUM Sentinel dashboard, Sinira confirmed chart rendering and clean Cosmik trendlines. Real-time Ylem flux updates were unstable under polling, so she proposed a RiftSocket-based livefeed with a Convergence broker and Ailo relay smoothing. Ymzo approved the request for AHYBE-compliant relay quotas and asked her to file a ticket assigning him. A demo is due by Friday (aligned to the upcoming minor Convergence).",
  full:
    "The session opened with Ymzo requesting a Fluon analytics update for the HYRUM Sentinel dashboard. Sinira reported solid progress—visualizations are in place and Cosmik trendlines look accurate—but highlighted jitter in real-time Ylem flux due to polled leyline reads.\n\nShe proposed moving to RiftSockets for the livefeed, fronted by a server-side Convergence broker and routed through an Ailo relay to buffer spikes and maintain AHYBE-safe stability. This approach requires additional AHYBE-compliant relay capacity.\n\nYmzo approved the capacity increase and asked Sinira to create a ticket and assign it to him for tracking. He set a clear expectation for a working demo by Friday, timed ahead of the minor Convergence. Sinira acknowledged the tight timeline, committing to prioritize the RiftSocket pipeline over UI aesthetics to land the critical path.",
};

export const SAMPLE_ACTION_ITEMS: ActionItem[] = [
  {
    id: 'action-1',
    type: 'action',
    content: 'Sinira to create a ticket for AHYBE-compliant relay quotas and assign it to Ymzo.',
    speakerId: 'S1',
    speakerLabel: 'Ymzo',
  },
  {
    id: 'action-2',
    type: 'decision',
    content: 'Ymzo approved increasing relay capacity to support RiftSocket-based real-time Ylem flux.',
    speakerId: 'S1',
    speakerLabel: 'Ymzo',
  },
  {
    id: 'action-3',
    type: 'action',
    content: 'Sinira to provide a working RiftSockets demo by Friday (minor Convergence).',
    speakerId: 'S1',
    speakerLabel: 'Ymzo',
  },
];

export const SAMPLE_SNIPPETS: Snippet[] = [
  {
    id: 'snippet-1',
    type: 'question',
    content: "What's the status on the Fluon analytics integration?",
    speakerId: 'S1',
    speakerLabel: 'Ymzo',
  },
  {
    id: 'snippet-2',
    type: 'insight',
    content: "Switching to RiftSockets—more efficient than polling the leyline bus.",
    speakerId: 'S2',
    speakerLabel: 'Sinira',
  },
  {
    id: 'snippet-3',
    type: 'quote',
    content: 'Friday is tight but doable. This is the critical artery.',
    speakerId: 'S2',
    speakerLabel: 'Sinira',
  },
];

export const SAMPLE_TOPICS: string[] = [
  'HYRUM Sentinel Dashboard',
  'Fluon Analytics',
  'RiftSockets',
  'AHYBE Relay Quotas',
  'Convergence Demo',
];