import { callOpenAI, OpenAIAPIError } from './openaiService';
import { callGemini, GeminiAPIError } from './geminiService';
import { getAIConfig } from '../config/aiConfig';

type AIError = OpenAIAPIError | GeminiAPIError;

class AIErrorWrapper extends Error {
    constructor(
        message: string,
        public originalError: AIError,
        public provider: 'gemini' | 'openai'
    ) {
        super(message);
        this.name = 'AIError';
    }
}

async function callAI<T>(
    prompt: string | { parts: any[] },
    schema?: any,
    options: { retries?: number, timeout?: number } = {}
): Promise<T> {
    const config = getAIConfig();
    
    try {
        if (config.provider === 'openai') {
            return await callOpenAI<T>(prompt, schema, options);
        } else {
            // Default to Gemini for backward compatibility
            return await callGemini<T>(prompt, schema, options);
        }
    } catch (error) {
        const aiError = error as AIError;
        throw new AIErrorWrapper(
            `AI call failed (${config.provider}): ${aiError.message}`,
            aiError,
            config.provider
        );
    }
}

// Re-export all the functions from the individual services for backward compatibility
export {
    callAI as default,
    callAI,
    callGemini,
    callOpenAI,
    GeminiAPIError,
    OpenAIAPIError,
    AIErrorWrapper as AIError,
};
