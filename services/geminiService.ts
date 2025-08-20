

import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { type SummaryStyle, type Emotion, type ActionItem, type Snippet } from '../types';

const model = 'gemini-2.5-flash';

// --- Helper for Gemini API calls ---
async function callGemini<T>(
    prompt: string | { parts: any[] },
    schema?: any
): Promise<T> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const config = schema ? { responseMimeType: "application/json", responseSchema: schema } : {};
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
    });

    const text = response.text;
    if (schema) {
        try {
            // Gemini can sometimes wrap the JSON in ```json ... ```, so we strip it.
            const jsonText = (text || '').trim().replace(/^```json/, '').replace(/```$/, '').trim();
            return JSON.parse(jsonText);
        } catch (parseError) {
            console.error('Failed to parse Gemini JSON response:', text);
            console.error('Parse error details:', parseError);
            throw new Error('Failed to parse AI response. The response was not valid JSON.');
        }
    } else {
        // For non-JSON responses, wrap it in a simple object to maintain a consistent return type structure.
        return { text } as T;
    }
}

// --- List of possible emotions for the AI to choose from ---
const newEmotions = [
    'calm', 'cold', 'confused', 'dizzy', 'embarassed', 'frustrated', 'goofy', 
    'happy', 'hurt', 'intense', 'listening', 'loving', 'mad', 'normal', 'sad', 
    'sleepy', 'smug', 'surprised', 'talking', 'thinking'
];

export const generateSummary = async (transcript: string, style: SummaryStyle): Promise<{ summary: string; emotion: Emotion }> => {
    if (transcript.trim().length < 10) return { summary: "Not enough content to summarize.", emotion: 'confused' };
    
    try {
        const prompt = `Analyze the following transcript and generate a summary based on the style: "${style}". 
Also, determine the single most prominent emotional tone of the conversation from the perspective of an AI assistant observing it.
The emotion must be one of: ${newEmotions.join(', ')}.

Transcript:
---
${transcript}
---`;
        const schema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING, description: `A ${style} summary of the transcript.` },
                emotion: {
                    type: Type.STRING,
                    enum: newEmotions,
                    description: 'The single most prominent emotional tone of the conversation.'
                },
            },
            required: ["summary", "emotion"],
        };
        return await callGemini(prompt, schema);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Could not generate summary.";
        console.error("Summary generation failed:", e);
        return { summary: `Error: ${message}`, emotion: 'sad' };
    }
};

export const generateTopics = async (transcript: string): Promise<string[]> => {
    if (transcript.trim().length < 50) return [];
    try {
        const prompt = `Identify the main topics discussed in the following transcript. List up to 5 key topics.

Transcript:
---
${transcript}
---`;
        const schema = { type: Type.ARRAY, items: { type: Type.STRING } };
        const result = await callGemini<string[]>(prompt, schema);
        return Array.isArray(result) ? result : [];
    } catch(e) {
        console.error("Topic generation failed:", e);
        return [];
    }
};

export const generateActionItems = async (transcript: string): Promise<Omit<ActionItem, 'id'>[]> => {
    if (transcript.trim().length < 20) return [];
    try {
        const prompt = `Extract any action items or decisions from the following transcript. For each, identify the speaker by their label (e.g., "Speaker 1").

Transcript:
---
${transcript}
---

Each object should have a 'type' ("action" or "decision"), 'content' (the action item text), and 'speakerLabel'.`;
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['action', 'decision'] },
                    content: { type: Type.STRING },
                    speakerLabel: { type: Type.STRING }
                },
                required: ['type', 'content']
            }
        };
        const result = await callGemini<Omit<ActionItem, 'id'>[]>(prompt, schema);
        return Array.isArray(result) ? result : [];
    } catch (e) {
        console.error("Action item generation failed:", e);
        return [];
    }
};

export const generateSnippets = async (transcript: string): Promise<Omit<Snippet, 'id'>[]> => {
    if (transcript.trim().length < 50) return [];
    try {
        const prompt = `Extract key quotes, important questions, and noteworthy insights from the transcript. For each, identify the speaker by their label (e.g., "Speaker 1").

Transcript:
---
${transcript}
---

Each object should have a 'type' ("quote", "question", or "insight"), 'content' (the snippet text), and 'speakerLabel'.`;
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['quote', 'question', 'insight'] },
                    content: { type: Type.STRING },
                    speakerLabel: { type: Type.STRING }
                },
                required: ['type', 'content']
            }
        };
        const result = await callGemini<Omit<Snippet, 'id'>[]>(prompt, schema);
        return Array.isArray(result) ? result : [];
    } catch(e) {
        console.error("Snippet generation failed:", e);
        return [];
    }
};

export const translateText = async (text: string, language: string): Promise<string> => {
    if (!text.trim()) return "";
    try {
        const prompt = `Translate the following text to ${language}:

---
${text}
---`;
        const result = await callGemini<{ text: string }>(prompt);
        return result.text || "Translation failed.";
    } catch(e) {
        console.error("Translation failed:", e);
        return "Translation failed.";
    }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
    try {
        const audioPart = {
            inlineData: {
                mimeType,
                data: base64Audio,
            },
        };
        
        const prompt = `Transcribe the audio recording accurately. The recording may contain multiple speakers. Identify each speaker and label their speech using the format 'SPEAKER_XX: ' where XX is a two-digit number (e.g., SPEAKER_01, SPEAKER_02). Start with SPEAKER_01. Ensure the transcription is verbatim.`;

        const textPart = { text: prompt };

        const result = await callGemini<{ text: string }>({ parts: [audioPart, textPart] });
        return result.text || "Cloud transcription failed to return text.";

    } catch(e) {
        console.error("Cloud transcription failed:", e);
        const message = e instanceof Error ? e.message : "An unknown error occurred during transcription."
        return `Error: ${message}`;
    }
};


export const detectLanguage = async (text: string): Promise<string | null> => {
    if (!text.trim() || text.trim().length < 10) return null;
    try {
        const prompt = `What language is this text? Respond with the IETF language tag (e.g., 'en-US', 'es-ES', 'ja-JP').

Text:
---
${text}
---`;
        const schema = {
            type: Type.OBJECT,
            properties: {
                languageTag: {
                    type: Type.STRING,
                    description: "The IETF language tag for the detected language, for example 'en-US' or 'fr-FR'."
                },
            },
            required: ["languageTag"],
        };
        const result = await callGemini<{ languageTag: string }>(prompt, schema);
        return result.languageTag ? result.languageTag.trim() : null;
    } catch(e) {
        console.error("Language detection failed:", e);
        return null;
    }
};