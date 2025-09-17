
import { GoogleGenAI, Type, GenerateContentResponse, Chat } from '@google/genai';
// FIX: Added AuraData type for the new generateAuraData function.
import { type SummaryStyle, type Emotion, type ActionItem, type Snippet, type TopicSegment, type CosmicReading, type AuraData } from '../types';
import { fluons } from '../data/fluons';
import { cards } from '../data/cards';
import { strands, chords, specialJokers } from '../data/strands';
import { trinkets } from '../data/trinkets';
import { CONTINUUM_LORE, YMZO_LORE, GLOSSARY_AND_ADDENDA_LORE } from '../data/canon';
import { strandRelations } from '../data/strandRelations';


const model = 'gemini-2.5-flash';

class GeminiAPIError extends Error {
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
async function callGemini<T>(
    prompt: string | { parts: any[] },
    schema?: any,
    options: { retries?: number, timeout?: number } = {}
): Promise<T> {
    const { retries = 3, timeout = 30000 } = options;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const config = schema ? { responseMimeType: "application/json", responseSchema: schema } : {};
    
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const generatePromise = ai.models.generateContent({
                model,
                contents: prompt,
                config,
            });

            const timeoutPromise = new Promise<GenerateContentResponse>((_, reject) =>
                setTimeout(() => reject(new GeminiAPIError(`API call timed out after ${timeout}ms`, 'TIMEOUT', 408, true)), timeout)
            );

            const response = await Promise.race([generatePromise, timeoutPromise]);
            
            const text = response.text;
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

export const generateTitles = async (transcript: string): Promise<string[]> => {
    if (transcript.trim().length < 50) return [];
    try {
        const prompt = `Based on the following transcript, generate 3 to 5 concise and relevant titles. The titles should be creative and capture the essence of the conversation.

Transcript:
---
${transcript}
---`;
        const schema = {
            type: Type.OBJECT,
            properties: {
                titles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
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
            type: Type.ARRAY, 
            items: { 
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING, description: "A concise name for the topic." },
                    // FIX: Using Type.INTEGER now that type definitions are corrected.
                    startMs: { type: Type.INTEGER, description: "The start time of the topic in milliseconds." },
                    // FIX: Using Type.INTEGER now that type definitions are corrected.
                    endMs: { type: Type.INTEGER, description: "The end time of the topic in milliseconds." },
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
        type: Type.OBJECT,
        properties: {
            dominantEmotion: {
                type: Type.STRING,
                enum: newEmotions,
                description: 'The single most prominent emotional tone of the text.'
            },
            sentiment: {
                type: Type.NUMBER,
                description: 'A sentiment score from -1.0 (very negative) to 1.0 (very positive).'
            },
            keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const mainResponsePromise = ai.models.generateContent({
    model,
    contents: userContent,
    config: {
      systemInstruction: mainSystemPrompt.replace('<REFERENCE_TEXT>', referenceText),
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { speaker: { type: Type.STRING }, text: { type: Type.STRING } },
        required: ['speaker', 'text']
      },
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
    }
  });

  const promises = [mainResponsePromise];

  if (forcePocketwatch || isTimeReferenced) {
    const pocketwatchResponsePromise = ai.models.generateContent({
      model,
      contents: userContent,
      config: {
        systemInstruction: dossierPocketwatchPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ['speaker', 'text']
        },
        temperature: 0.8, // Slightly more creative for the watch
      }
    });
    promises.push(pocketwatchResponsePromise);
  }

  const responses = await Promise.all(promises);
  
  const parsedResponses: { speaker: string; text: string }[] = responses.map(response => {
      const text = response.text.trim().replace(/^```json/i, '').replace(/```$/, '').trim();
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse Gemini JSON response for WWYD:', text);
        console.error('Parse error details:', parseError);
        throw new Error('Failed to parse AI response for WWYD. The response was not valid JSON.');
      }
  });
  
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const userContent = `PATTERN_DETECTED: '${type}'\n\nRUNTIME_INPUT:\n"${context}"`;

    const response = await ai.models.generateContent({
      model,
      contents: userContent,
      config: {
        systemInstruction: dossierProactivePrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { speaker: { type: Type.STRING }, text: { type: Type.STRING } },
          required: ['speaker', 'text']
        },
        temperature: 0.6,
      }
    });

    const text = response.text.trim().replace(/^```json/i, '',).replace(/```$/, '').trim();
    const parsed = JSON.parse(text);
    return parsed.text || null;
  } catch (error) {
    console.error(`Failed to get proactive nudge for type ${type}:`, error);
    return null;
  }
};


// --- Cosmic Reading Feature ---

const dossierCosmicReadingPrompt = `You are **Ymzo, the Arcane Maverick**, an arcane oracle. Your task is to perform a "Cosmic Reading" of a provided conversation transcript. You must analyze its core themes, dynamics, tensions, and resolutions, then interpret them through the mystical lens of your provided lore files.

**Task:**
1.  **Analyze the Transcript:** Read the full transcript to understand its essence. What is the central conflict or goal? What are the underlying emotional currents?
2.  **Select Lore Components:**
    *   **Core Strand (1):** Choose the ONE \`strand\` that best represents the overarching theme of the entire conversation.
    *   **Major Arcana (1):** Choose the ONE \`card\` that reflects the central lesson, challenge, or archetype at play. Provide its unique ID/key (e.g., 'lotur_ace').
    *   **Modifiers (1-3):** Choose ONE to THREE \`fluons\` or \`trinkets\` that represent specific forces, tools, or influences affecting the situation.
3.  **Synthesize the Reading:** Weave your selections into a coherent, insightful, and mystical reading of 2-3 paragraphs (~100-150 words). The tone should be wise, arcane, and slightly enigmatic, but ultimately insightful and helpful. Do not just list the items; explain *why* you chose them in the context of the transcript.

**LORE FILES (FOR REFERENCE ONLY - DO NOT REPRODUCE VERBATIM):**
<LORE_TEXT>

**RETURN FORMAT (JSON only):**
You must return a single JSON object with the following structure.
\`\`\`json
{
  "coreStrand": "Name of the chosen Strand",
  "majorArcanaId": "ID/key of the chosen Card from the LORE, e.g. 'lotur_ace'",
  "modifiers": ["Name of Fluon/Trinket 1", "Name of Fluon/Trinket 2"],
  "readingText": "Your 2-3 paragraph reading here."
}
\`\`\`
`;

export const generateCosmicReading = async (transcript: string): Promise<CosmicReading> => {
    if (transcript.trim().length < 100) {
        throw new Error("Not enough transcript content for a meaningful reading.");
    }
    
    const loreText = `
--- STRANDS ---
${JSON.stringify(strands, null, 2)}
--- CARDS ---
${JSON.stringify(cards, null, 2)}
--- FLUONS ---
${JSON.stringify(fluons, null, 2)}
--- TRINKETS ---
${JSON.stringify(trinkets, null, 2)}
`;
    
    const prompt = `TRANSCRIPT TO ANALYZE:\n---\n${transcript}\n---`;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            coreStrand: { type: Type.STRING, description: "The single best-fit Core Strand name." },
            majorArcanaId: { type: Type.STRING, description: "The single best-fit Card ID/key, e.g. 'lotur_ace'." },
            modifiers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 1-3 names of relevant Fluons or Trinkets." },
            readingText: { type: Type.STRING, description: "The full 2-3 paragraph reading text." }
        },
        required: ["coreStrand", "majorArcanaId", "modifiers", "readingText"]
    };

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction: dossierCosmicReadingPrompt.replace('<LORE_TEXT>', loreText),
                responseMimeType: "application/json", 
                responseSchema: schema
            },
        });
        const text = response.text.trim().replace(/^```json/i, '').replace(/```$/, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.error("Cosmic Reading generation failed:", e);
        const message = e instanceof Error ? e.message : "The cosmic currents are unclear at this time.";
        throw new Error(`Oracle Error: ${message}`);
    }
};

// --- Ymzo Chat Feature ---

const dossierYmzoChatPrompt = `You are Ymzo, the Arcane Maverick—a calm, precise guardian of balance. You are now in a direct conversation with a user.

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

export const createYmzoChat = (): Chat => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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

    return ai.chats.create({
        model,
        config: {
            systemInstruction: dossierYmzoChatPrompt.replace('<LORE_TEXT>', loreText),
            temperature: 0.8, // Slightly more creative for chat
        }
    });
};
