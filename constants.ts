
import { type Emotion } from './types';

export const FILLER_WORDS: Set<string> = new Set([
  "um", "uh", "like", "you know", "sort of", "kind of", "basically",
  "actually", "literally", "anyway", "so", "well", "right", "i mean",
  "just", "yeah", "hmm", "erm", "mmm", "okay"
]);

export const THEME_PRESETS: { [key: number]: { primary: string; secondary:string; accent: string } } = {
  1: { primary: "#4d8aff", secondary: "#a777ff", accent: "#ffc94d" }, // CosmoTech Default
  2: { primary: "#4dffd4", secondary: "#4d8aff", accent: "#ff6b6b" }, // Cyan Nebula
  3: { primary: "#a777ff", secondary: "#ff6b6b", accent: "#4dffd4" }, // Violet Flare
  4: { primary: "#ffbe0b", secondary: "#4d8aff", accent: "#ff6b6b" }, // Gold Supernova
};

export const AVATAR_EMOTIONS: Record<Emotion, string> = {
  calm: "https://defscribe.app/avatar/calm.png",
  cold: "https://defscribe.app/avatar/cold.png",
  confused: "https://defscribe.app/avatar/confused.png",
  dizzy: "https://defscribe.app/avatar/dizzy.png",
  embarassed: "https://defscribe.app/avatar/embarassed.png",
  frustrated: "https://defscribe.app/avatar/frustrated.png",
  goofy: "https://defscribe.app/avatar/goofy.png",
  happy: "https://defscribe.app/avatar/happy.png",
  hurt: "https://defscribe.app/avatar/hurt.png",
  intense: "https://defscribe.app/avatar/intense.png",
  listening: "https://defscribe.app/avatar/listening.png",
  loving: "https://defscribe.app/avatar/loving.png",
  mad: "https://defscribe.app/avatar/mad.png",
  normal: "https://defscribe.app/avatar/normal.png",
  sad: "https://defscribe.app/avatar/sad.png",
  sleepy: "https://defscribe.app/avatar/sleepy.png",
  smug: "https://defscribe.app/avatar/smug.png",
  surprised: "https://defscribe.app/avatar/surprised.png",
  talking: "https://defscribe.app/avatar/talking.png",
  thinking: "https://defscribe.app/avatar/thinking.png"
};

// --- Word sets for Emotion Detection ---
export const HAPPY_WORDS = new Set(['happy', 'joy', 'great', 'wonderful', 'excellent', 'love', 'amazing', 'fantastic', 'perfect']);
export const SAD_WORDS = new Set(['sad', 'unhappy', 'cry', 'depressed', 'miserable', 'hurt', 'pain']);
export const ANGRY_WORDS = new Set(['angry', 'mad', 'furious', 'hate', 'frustrated', 'annoyed']);
export const CONFUSED_WORDS = new Set(['confused', 'huh', 'what', "what's", "i don't understand", 'unclear', 'pardon']);
export const SURPRISED_WORDS = new Set(['wow', 'omg', 'really', 'surprised', 'incredible', 'no way']);
export const GOOFY_WORDS = new Set(['lol', 'haha', 'funny', 'silly', 'goofy', 'joking']);
export const INTENSE_WORDS = new Set(['fast', 'urgent', 'now', 'critical', 'intense', 'important']);
export const POSITIVE_AFFIRMATIONS = new Set(['yes', 'agree', 'right', 'correct', 'exactly']);


export const DIARIZATION_PALETTE: string[] = ["#7dd3fc","#a78bfa","#fca5a5","#86efac","#fcd34d","#f9a8d4"];

export const SPOKEN_LANGUAGES: Record<string, string> = {
  'English (US)': 'en-US',
  'Spanish (Spain)': 'es-ES',
  'French (France)': 'fr-FR',
  'German (Germany)': 'de-DE',
  'Japanese': 'ja-JP',
  'Mandarin (China)': 'zh-CN',
};

// Create a reverse map for easy lookup
export const SPOKEN_LANGUAGES_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(SPOKEN_LANGUAGES).map(([name, code]) => [code, name])
);
