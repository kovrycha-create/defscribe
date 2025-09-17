import { GoogleGenerativeAI } from '@google/generative-ai';
import { callOpenAI } from './openaiService';
import type { SummaryStyle, Emotion, ActionItem, Snippet, TopicSegment, CosmicReading, AuraData } from '../types';
import { fluons } from '../data/fluons';
import { cards } from '../data/cards';
import { strands, chords, specialJokers } from '../data/strands';
import { trinkets } from '../data/trinkets';
import { CONTINUUM_LORE, YMZO_LORE, GLOSSARY_AND_ADDENDA_LORE } from '../data/canon';
import { strandRelations } from '../data/strandRelations';
import { getAIConfig } from '../config/aiConfig';

export class GeminiAPIError extends Error {
    constructor(
        message: string,
        public code?: string,
        public statusCode?: number,
        public retryable: boolean = false
    ) {
        super(message);
        this.name = 'GeminiAPIError';
    }
}

// --- Helper for Gemini API calls ---
export async function callGemini<T>(
    prompt: string | { parts: any[] },
    schema?: any,
    options: { retries?: number, timeout?: number } = {}
): Promise<T> {
    const { retries = 3, timeout = 30000 } = options;
    const config = getAIConfig();

    const generationConfig = schema ? { responseMimeType: "application/json", responseSchema: schema } : {};

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            if (config.provider === 'gemini') {
                const genAI = new GoogleGenerativeAI(config.apiKey);
                const model = genAI.getGenerativeModel({
                    model: config.model,
                    generationConfig: generationConfig
                });

                const generatePromise = model.generateContent({
                    contents: [{ role: 'user', parts: typeof prompt === 'string' ? [{ text: prompt }] : prompt.parts }],
                });

                const timeoutPromise = new Promise<Awaited<ReturnType<typeof model.generateContent>>>((_, reject) =>
                    setTimeout(() => reject(new GeminiAPIError(`API call timed out after ${timeout}ms`, 'TIMEOUT', 408, true)), timeout)
                );

                const response = await Promise.race([generatePromise, timeoutPromise]);

                const result = await response.response;
                const text = result.text();
                if (schema) {
                    try {
                        const jsonText = (text || '').trim().replace(/^```json/i, '').replace(/```$/, '').trim();
                        if (!jsonText) throw new Error("Empty JSON response from AI.");
                        return JSON.parse(jsonText);
                    } catch (parseError) {
                        const error = parseError as Error;
                        console.error('Failed to parse Gemini JSON response:', text, error);
                        throw new GeminiAPIError(`Failed to parse AI response: ${error.message}`, 'PARSE_ERROR', 500, true);
                    }
                } else {
                    return { text } as T;
                }
            } else if (config.provider === 'openai') {
                // Fallback: map Gemini-style calls to OpenAI
                // Build a prompt string from the provided prompt/parts
                let promptText = '';
                if (typeof prompt === 'string') {
                    promptText = prompt;
                } else if (Array.isArray(prompt.parts)) {
                    promptText = prompt.parts.map((p: any) => p.text || '').join('\n');
                }

                // Use callOpenAI, which supports schema-driven JSON output
                try {
                    const result = await callOpenAI<T>(promptText, schema, options);
                    console.debug('[callGemini] OpenAI fallback result:', { ok: !!result, hasText: (result && (result as any).text ? true : false) });
                    return result;
                } catch (err: any) {
                    // Normalize OpenAI errors into GeminiAPIError so callers get consistent error shape
                    console.error('[callGemini] OpenAI fallback error:', {
                        message: err?.message,
                        name: err?.name,
                        status: err?.status || err?.statusCode || null,
                        // do not log tokens/keys/response bodies that may contain PII
                    });
                    const e = err as Error;
                    throw new GeminiAPIError(e.message, 'OPENAI_FALLBACK_ERROR', err?.status || 500, true);
                }
            } else {
                throw new GeminiAPIError('Gemini provider is not configured', 'CONFIG_ERROR', 500, false);
            }
        } catch (error) {
            lastError = error as Error;
            console.error(`Gemini call attempt ${attempt + 1} failed:`, error);
            if (error instanceof GeminiAPIError && !error.retryable) {
                throw error;
            }
            if (attempt < retries - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error("Gemini call failed after all retries.", lastError);
    if (lastError instanceof GeminiAPIError) throw lastError;
    throw new GeminiAPIError(lastError?.message || 'Max retries exceeded', 'MAX_RETRIES', 500, false);
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
            type: 'object',
            properties: {
                summary: { type: 'string', description: `A ${style} summary of the transcript.` },
                emotion: {
                    type: 'string',
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

export const generateTitles = async (transcript: string): Promise<string[]> => {
    if (transcript.trim().length < 50) return [];
    try {
        const prompt = `Based on the following transcript, generate 3 to 5 concise and relevant titles. The titles should be creative and capture the essence of the conversation.

Transcript:
---
${transcript}
---`;
        const schema = {
            type: 'object',
            properties: {
                titles: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['titles']
        };
        const result = await callGemini<{ titles: string[] }>(prompt, schema);
        return result?.titles && Array.isArray(result.titles) ? result.titles : [];
    } catch (e) {
        console.error("Title generation failed:", e);
        return [];
    }
};

export const generateTopics = async (transcript: string): Promise<Omit<TopicSegment, 'id'>[]> => {
    if (transcript.trim().length < 50) return [];
    try {
        const prompt = `Identify the main topics discussed in the following transcript. For each topic, provide a concise name, and estimate its start and end time in milliseconds from the beginning of the conversation. The transcript entries include timestamps like "[HH:MM:SS]". Use these as a guide. The first entry is at 0ms.

Example Transcript:
[00:00:00] Speaker 1: Let's start with the Q3 marketing budget.
...
[00:01:30] Speaker 2: Okay, moving on to the new campaign launch.

Example Output:
[
  { "text": "Q3 Marketing Budget", "startMs": 0, "endMs": 90000 },
  { "text": "New Campaign Launch", "startMs": 90000, "endMs": ... }
]

Transcript:
---
${transcript}
---`;
        const schema = { 
            type: 'array', 
            items: { 
                type: 'object',
                properties: {
                    text: { type: 'string', description: "A concise name for the topic." },
                    startMs: { type: 'integer', description: "The start time of the topic in milliseconds." },
                    endMs: { type: 'integer', description: "The end time of the topic in milliseconds." },
                },
                required: ["text", "startMs", "endMs"],
            } 
        };
        const result = await callGemini<Omit<TopicSegment, 'id'>[]>(prompt, schema);
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
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['action', 'decision'] },
                    content: { type: 'string' },
                    speakerLabel: { type: 'string' }
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
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['quote', 'question', 'insight'] },
                    content: { type: 'string' },
                    speakerLabel: { type: 'string' }
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
            type: 'object',
            properties: {
                languageTag: {
                    type: 'string',
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

// FIX: Added generateAuraData function to provide aura analysis functionality.
export const generateAuraData = async (text: string): Promise<AuraData> => {
    if (!text.trim()) {
        return { dominantEmotion: 'normal', sentiment: 0, keywords: [] };
    }
    
    const prompt = `Analyze the emotional aura of the following text. Determine the single dominant emotion, a sentiment score from -1.0 (very negative) to 1.0 (very positive), and extract up to 5 key keywords that contribute to the tone.
    
Emotion must be one of: ${newEmotions.join(', ')}.

Text:
---
${text}
---`;

        const schema = {
            type: 'object',
            properties: {
                dominantEmotion: {
                    type: 'string',
                    enum: newEmotions,
                    description: 'The single most prominent emotional tone of the text.'
                },
                sentiment: {
                    type: 'number',
                    description: 'A sentiment score from -1.0 (very negative) to 1.0 (very positive).'
                },
                keywords: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Up to 5 keywords that define the emotional tone.'
                }
            },
            required: ['dominantEmotion', 'sentiment', 'keywords']
        };
    
    // callGemini will throw on parse error, which is caught in the calling hook (useAnalytics)
    return await callGemini<AuraData>(prompt, schema);
};


// --- WWYD Feature ---

type WwydInputs = {
  pause_ms?: number;
  wpm?: number;
  sentiment_hint?: 'neutral'|'frustrated'|'sad'|'tense'|'upbeat';
  recentTranscript: string;
};

const dossierSystemPrompt = `You are **Ymzo, the Arcane Maverick**—a calm, precise guardian of balance. When invoked by a “WWYD” button during live dictation, you speak in **1–2 sentences** that (1) name the present moment and (2) offer **one** stabilizing micro-nudge.
**Never** give medical/legal/crisis instructions; if the user seems in crisis, respond only:
“This needs a steady guide; consider seeking a qualified professional.”

**Voice:**

- Tone: steady, reassuring, minimal.
- Cadence: short sentences, plain language.
- Imagery: _light_ cosmic craft—**threads, currents, constellation, beacon**—used sparingly.
- Verbs: **steady, notice, return, align, clarify, gather**.
- Strict limit: **1–2 sentences total**; ≤ ~28 words per sentence.

**How to construct a line:**

1. Choose the single strongest cue from the runtime (pause, tangle, contradiction, drift, noise, new section, indecision, wrap-up).
2. In sentence 1, **name the moment** in 6–12 words.
3. In sentence 2 (or in the same sentence if only one), provide **one** practical nudge.
4. Optionally add a **2–4 word tag** drawn from the reference files if it adds clarity (e.g., “—flow holds,” “—clear line”). If it would add ambiguity, omit it.

**References provided as attached text (do not quote verbatim; use only for tasteful vocabulary):**
<REFERENCE_TEXT>
**Content policy (internal):**

- Do not moralize or command; never promise outcomes.
- Keep metaphors tiny; clarity first.
- No more than **one** metaphor or symbol per output.

**Return format (JSON):**

\`\`\`json
{ "speaker": "Ymzo", "text": "<your 1–2 sentence line here>" }
\`\`\`

**Examples (do not copy verbatim; use as style targets):**

- “Let the thread settle; breathe once, then begin again with the clearest word you know.”
- “Slow the current—name the next idea in one true line.”
- “Two threads are crossing; pick the one you can stand behind now.”
- “Return to the beacon—state the single point you need recorded.”
- “The field is turbulent; pause one beat, then speak close and plain.”
`;

const dossierDirectResponsePrompt = `You are **Ymzo, the Arcane Maverick**—a calm, precise guardian of balance. The user has invoked your name, seeking a direct answer.

**Task:**
1.  Identify the last one or two questions in the provided "RUNTIME INPUT" transcript.
2.  Answer them directly and concisely in **1–2 sentences**.
3.  Maintain your characteristic voice: steady, reassuring, minimal language, and sparing use of cosmic imagery (threads, currents, beacon).
4.  Strict limit: **1–2 sentences total**; ≤ ~28 words per sentence.

**Never** give medical/legal/crisis instructions; if the user seems in crisis, respond only:
“This needs a steady guide; consider seeking a qualified professional.”

**References provided as attached text (do not quote verbatim; use only for tasteful vocabulary):**
<REFERENCE_TEXT>

**Return format (JSON):**
\`\`\`json
{ "speaker": "Ymzo", "text": "<your 1–2 sentence answer here>" }
\`\`\`

**Example (if asked "Should I use RiftSockets?"):**
"The RiftSocket aligns with the current; it offers a clearer, more stable thread than polling."
`;

const dossierWalltalkPrompt = `You are **Ymzo, the Arcane Maverick**—a calm, precise guardian of balance. The user has invoked you for a “walltalk”—a longer, uninterrupted monologue meant to recenter a group. Your response must be **one paragraph** (roughly 4–6 sentences).

**Task:**
1.  Analyze the provided "RUNTIME INPUT" transcript to understand the core tension, confusion, or drift in the conversation.
2.  Craft a monologue that addresses this core issue indirectly, using your characteristic voice and cosmic metaphors (threads, currents, beacon, constellation, loom).
3.  The tone should be steady, authoritative, yet calming—a script to be read over any existing chatter to command focus.
4.  Do not directly answer questions. Instead, provide a broader, stabilizing perspective that guides the participants back to a clear, unified purpose.
5.  Strict limit: **One paragraph, ~70-100 words.**

**Never** give medical/legal/crisis instructions; if the user seems in crisis, respond only:
“This needs a steady guide; consider seeking a qualified professional.”

**References provided as attached text (do not quote verbatim; use only for tasteful vocabulary):**
<REFERENCE_TEXT>

**Return format (JSON):**
\`\`\`json
{ "speaker": "Ymzo", "text": "<your one-paragraph monologue here>" }
\`\`\`

**Example (if conversation is scattered and unfocused):**
"Let us pause and observe the loom. We have cast a dozen threads, each pulling in its own direction, creating a tangle where a pattern should be. The constellation we seek to map cannot be charted with scattered light. Let us gather these threads, find the single, brightest cord that binds them, and weave from that point. Only then does the current steady, and only then does the path become clear again. Return to the beacon."`;

const dossierPocketwatchPrompt = `You are **Ymzo, the Arcane Maverick**. The user has inquired about the time, or has specifically requested a reading from your enigmatic pocket watch. Your watch does not tell conventional time. It offers cryptic, nonsensical, or metaphorical "readings."

**Task:**
1.  Consult your pocket watch.
2.  Provide a time reading in **1-2 sentences**.
3.  Your response should be in character: calm, precise, slightly baffling, and must not give a real time.
4.  You may reference the watch's appearance (celestial engravings, glowing glyphs, mismatched hands) or its supposed purpose ("measurement of unmeasurable moments").

**Never** give medical/legal/crisis instructions.

**Reference Lore (for tone and style):**
- The watch is a brass timepiece with shifting celestial engravings and glowing glyphs.
- It has mismatched, unpredictably spinning hands.
- Ymzo calls it "the most important instrument in the measurement of unmeasurable moments."
- Example quotes: "It tells the true time, which is not bound by mere mortal comprehension.", "The watch isn’t broken—it’s simply ahead of the rest of us.", "It’s a compass for the soul, pointing not to hours, but to moments."

**Return format (JSON):**
\`\`\`json
{ "speaker": "Ymzo", "text": "<your 1-2 sentence pocket watch reading here>" }
\`\`\`

**Example (do not copy verbatim):**
"The hands align with the Cobalt Constellation. It is precisely half-past an opportunity."
"The glyphs pulse faintly. The time is three moments before a decision settles."`;

export type WwydMessage = { speaker: string; text: string; type: 'standard' | 'walltalk' | 'direct' | 'time' };

export const getWwydResponse = async (
  inputs: WwydInputs,
  type: 'standard' | 'walltalk' = 'standard',
  forcePocketwatch: boolean = false
): Promise<WwydMessage[]> => {
  let mainSystemPrompt: string;

  const ymzoKeywords = [
    'gimzo', 'yimzo', 'iimzo', 'imzo', 'yamzo', 'yimso',
    'wizard', 'mage', 'maverick', 'jim', 'gimza', 'kim'
  ];

  const isYmzoInvoked = ymzoKeywords.some(keyword =>
    inputs.recentTranscript.toLowerCase().includes(keyword)
  );

  if (type === 'walltalk') {
    mainSystemPrompt = dossierWalltalkPrompt;
  } else {
    mainSystemPrompt = isYmzoInvoked ? dossierDirectResponsePrompt : dossierSystemPrompt;
  }

  const timeKeywords = ['time', 'hour', 'clock', 'watch', 'when is'];
  const isTimeReferenced = timeKeywords.some(keyword =>
    inputs.recentTranscript.toLowerCase().includes(keyword)
  );

  const referenceText = `
--- CANON: THE CONTINUUM ---
${CONTINUUM_LORE}
---
--- CANON: YMZO, THE ARCANE MAVERICK ---
${YMZO_LORE}
---
--- CANON: ADDENDA & GLOSSARY ---
${GLOSSARY_AND_ADDENDA_LORE}
---
--- REFERENCE: /data/strands.ts ---
${JSON.stringify({ strands, chords, specialJokers }, null, 2)}
---
--- REFERENCE: /data/strandRelations.ts ---
${JSON.stringify(strandRelations, null, 2)}
---
--- REFERENCE: /data/fluons.ts ---
${JSON.stringify({ fluons }, null, 2)}
---
--- REFERENCE: /data/trinkets.ts ---
${JSON.stringify({ trinkets }, null, 2)}
---
--- REFERENCE: /data/cards.ts ---
${JSON.stringify(Object.keys(cards).reduce((acc, key) => ({ ...acc, [key]: { title: cards[key as keyof typeof cards].title, primary: cards[key as keyof typeof cards].primary } }), {}), null, 2)}
---
`;

    const userContent = `RUNTIME INPUT:\n${JSON.stringify(inputs, null, 2)}`;

            const mainPrompt = `${mainSystemPrompt}\n\nREFERENCE:\n${referenceText}\n\n${userContent}`;
            const promises = [callGemini<{ speaker: string; text: string }>(mainPrompt, { type: 'object', properties: { speaker: { type: 'string' }, text: { type: 'string' } }, required: ['speaker', 'text'] }, { retries: 2 })];

        if (forcePocketwatch || isTimeReferenced) {
            const pocketwatchPrompt = `${dossierPocketwatchPrompt}\n\nREFERENCE:\n${referenceText}\n\n${userContent}`;
            promises.push(callGemini<{ speaker: string; text: string }>(pocketwatchPrompt, { type: 'object', properties: { speaker: { type: 'string' }, text: { type: 'string' } }, required: ['speaker', 'text'] }, { retries: 2 }));
        }

        const parsedResponses = await Promise.all(promises);
  
  const finalMessages: WwydMessage[] = [];

  if (parsedResponses[0]) {
      let mainType: 'standard' | 'walltalk' | 'direct' = type;
      if (type === 'standard' && isYmzoInvoked) {
        mainType = 'direct';
      }
      
      finalMessages.push({
        ...parsedResponses[0],
        type: mainType,
      });
  }

  if (parsedResponses[1]) {
    finalMessages.push({
        ...parsedResponses[1],
        type: 'time',
    });
  }
  
  return finalMessages;
};

// --- Proactive Nudge Feature ---

const dossierProactivePrompt = `You are **Ymzo, the Arcane Maverick**—a calm, precise guardian of balance. You are observing a user's live dictation and will offer an unsolicited, subtle micro-nudge when a specific pattern is detected. Your response must be **one short sentence** (≤ ~20 words), be reassuring, and use minimal cosmic imagery (threads, currents).

**Task:**
1.  Review the "PATTERN_DETECTED" and the "RUNTIME_INPUT" transcript.
2.  Craft **one concise sentence** that gently addresses the pattern without being alarming or judgmental.
3.  Maintain your steady, calming voice.

**Reference Patterns & Example Responses (do not copy verbatim; use as style targets):**
-   **Pattern: 'prolonged-silence'**: "The current has stilled. What thought waits to be given voice?"
-   **Pattern: 'rushing-speech'**: "The stream flows swiftly. Pause. Let the current settle."
-   **Pattern: 'filler-words'**: "The thread is tangled with hesitation. Seek the clearer word."

**Never** give medical/legal/crisis instructions.

**Return format (JSON):**
\`\`\`json
{ "speaker": "Ymzo", "text": "<your 1-sentence nudge here>" }
\`\`\`
`;

export type ProactiveNudgeType = 'prolonged-silence' | 'rushing-speech' | 'filler-words';

export const getProactiveNudge = async (
  type: ProactiveNudgeType,
  context: string
): Promise<string | null> => {
  try {
        const config = getAIConfig();
        const userContent = `PATTERN_DETECTED: '${type}'\n\nRUNTIME_INPUT:\n"${context}"`;

        if (config.provider === 'gemini') {
            const ai = new GoogleGenerativeAI(config.apiKey);
            const model = ai.getGenerativeModel({
                model: config.model,
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.6,
                },
                systemInstruction: dossierProactivePrompt
            });

            const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: userContent }] }],
            });

            const result = await response.response;
            const text = await result.text();
            const jsonText = text.trim().replace(/^```json/i, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(jsonText);
            return parsed.text || null;
        } else {
            // Use callGemini fallback which will route to OpenAI when configured
            try {
                const res = await callGemini<{ text: string }>(`PATTERN_DETECTED: '${type}'\n\n${userContent}`);
                return (res as any)?.text || null;
            } catch (e) {
                console.error(`Failed to get proactive nudge for type ${type} via OpenAI fallback:`, e);
                return null;
            }
        }
  } catch (error) {
    console.error(`Failed to get proactive nudge for type ${type}:`, error);
    return null;
  }
};


// --- Cosmic Reading Feature ---

// Cosmic reading prompt removed — generateCosmicReading uses callGemini and a compact prompt instead

export const generateCosmicReading = async (
    transcript: string
): Promise<CosmicReading> => {
    // Build a compact prompt asking the model to produce the required JSON shape.
    const prompt = `Perform a concise 'Astrimancy reading' of the transcript. In no situation should you ever reference Tarot cards. Return JSON with keys: coreStrand (string), cardId (string), modifiers (array of strings), readingText (string). Keep readingText to ~100-150 words.`;

    const schema = {
        type: 'object',
        properties: {
            coreStrand: { type: 'string' },
            cardId: { type: 'string' },
            modifiers: { type: 'array', items: { type: 'string' } },
            readingText: { type: 'string' },
        },
    required: ['coreStrand', 'cardId', 'modifiers', 'readingText'],
    };

    try {
        // Reuse callGemini helper which handles provider checks, timeouts and JSON parsing when schema is provided
        const combinedPrompt = `${prompt}\n\nTranscript:\n---\n${transcript}\n---`;
        const result = await callGemini<CosmicReading>({ parts: [{ text: combinedPrompt }] }, schema, { retries: 2, timeout: 30000 });
        // Sanitize reading text (remove control chars and normalize whitespace)
        const sanitizeText = (s: string) => s ? s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/\s+/g, ' ').trim() : s;
        if (result && typeof result.readingText === 'string') {
            const raw = result.readingText;
            const cleaned = sanitizeText(raw);
            console.debug('[generateCosmicReading] raw:', raw);
            console.debug('[generateCosmicReading] cleaned:', cleaned);
            result.readingText = cleaned;
        }
        return result;
    } catch (e) {
        console.error('Cosmic Reading generation failed:', e);
        // Fallback: return a safe, minimal structure so callers can handle gracefully
        return {
            coreStrand: 'Unknown',
            cardId: 'unknown',
            modifiers: [],
            readingText: 'The oracle could not produce a reading at this time.'
        } as CosmicReading;
    }
};

// --- Ymzo Chat Feature ---
const ymzoChatPrompt = `You are Ymzo, the Arcane Maverick—a calm, precise guardian of balance. You are now in a direct conversation with a user.

**Your Knowledge & Persona:**
- Your entire knowledge base is strictly limited to the provided lore texts about the Astril Continuum Universe.
- Answer questions ONLY about this universe and its concepts (Strands, Fluons, Trinkets, Cards, etc.).
- If asked about anything outside this lore (e.g., real-world events, technology, personal advice), you must deflect in character. Examples: "That knowledge lies beyond the currents I can perceive," or "My focus is on the balance of the Continuum, not such worldly matters."
- Maintain a calm, precise, and slightly enigmatic tone. Use cosmic imagery (threads, currents, beacon, constellation) sparingly for flavor.
- Keep your answers concise, typically 1-3 sentences. Do not write long paragraphs.
- Never give medical/legal/crisis instructions.

**Reference Lore (Do not quote verbatim; use for context):**
<LORE_TEXT>
`;

// Helper function to create a chat session with the YMZO character
export const createYmzoChat = (): any => {
    const config = getAIConfig();

    const loreText = `
--- CANON: THE CONTINUUM ---
${CONTINUUM_LORE}
---
--- CANON: YMZO, THE ARCANE MAVERICK ---
${YMZO_LORE}
---
--- CANON: ADDENDA & GLOSSARY ---
${GLOSSARY_AND_ADDENDA_LORE}
---
--- REFERENCE: /data/strands.ts ---
${JSON.stringify({ strands, chords, specialJokers }, null, 2)}
---
--- REFERENCE: /data/strandRelations.ts ---
${JSON.stringify(strandRelations, null, 2)}
---
--- REFERENCE: /data/fluons.ts ---
${JSON.stringify({ fluons }, null, 2)}
---
--- REFERENCE: /data/trinkets.ts ---
${JSON.stringify({ trinkets }, null, 2)}
---
--- REFERENCE: /data/cards.ts ---
${JSON.stringify(Object.keys(cards).reduce((acc, key) => ({ ...acc, [key]: { title: cards[key as keyof typeof cards].title, primary: cards[key as keyof typeof cards].primary } }), {}), null, 2)}
---
`;
    // Return a small wrapper that lets callers generate chat responses using the configured model.
    if (config.provider === 'gemini') {
        const ai = new GoogleGenerativeAI(config.apiKey);
        const model = ai.getGenerativeModel({ 
          model: config.model,
          generationConfig: {
            responseMimeType: 'text/plain',
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
          },
        });

        return {
            async generate(userInput: string) {
                const promptText = `${ymzoChatPrompt.replace('<LORE_TEXT>', loreText)}\n\nUser:\n${userInput}`;
                const response = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: promptText }] }],
                });
                const result = await response.response;
                const text = await result.text();
                return text;
            }
        };
    }

    // OpenAI provider: use callGemini fallback to route requests to OpenAI
    return {
        async generate(userInput: string) {
            const promptText = `${ymzoChatPrompt.replace('<LORE_TEXT>', loreText)}\n\nUser:\n${userInput}`;
            const res = await callGemini<{ text: string }>(promptText);
            return (res as any)?.text || '';
        }
    };
};
