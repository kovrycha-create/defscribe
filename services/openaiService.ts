import OpenAI from 'openai';

class OpenAIAPIError extends Error {
    constructor(
        message: string,
        public code?: string,
        public status?: number,
        public retryable: boolean = false
    ) {
        super(message);
        this.name = 'OpenAIAPIError';
    }
}

async function callOpenAI<T>(
    prompt: string | { parts: any[] },
    schema?: any,
    options: { retries?: number, timeout?: number } = {}
): Promise<T> {
    const { retries = 3, timeout = 30000 } = options;
    // Read Vite environment variable (works in browser and Node builds when injected)
    const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_OPENAI_API_KEY) || '';
    if (!apiKey) {
        throw new OpenAIAPIError('OpenAI API key is missing. Set VITE_OPENAI_API_KEY in your environment.', 'CONFIG_ERROR', 401, false);
    }

    // Allow running the OpenAI client in browser ONLY if explicitly opted in for development.
    // Set VITE_ALLOW_OPENAI_IN_BROWSER=true in your .env.local to enable. This is dangerous for production.
    const allowInBrowser = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_ALLOW_OPENAI_IN_BROWSER) === 'true';

    if (typeof window !== 'undefined' && !allowInBrowser) {
        // Running in browser environment and not explicitly allowed
        throw new OpenAIAPIError(
            'OpenAI client is running in a browser-like environment. This is disabled by default to protect your API key. For development only, you can set VITE_ALLOW_OPENAI_IN_BROWSER=true in your .env.local to opt in, or better: proxy requests through a server-side endpoint to keep secrets safe. See: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety',
            'BROWSER_BLOCK',
            403,
            false
        );
    }

    const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: allowInBrowser
    });
    
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const messages = [];
            
            // Handle both string and parts format to match Gemini's interface
            if (typeof prompt === 'string') {
                messages.push({ role: 'user' as const, content: prompt });
            } else if (Array.isArray(prompt.parts)) {
                for (const part of prompt.parts) {
                    if (part.text) {
                        messages.push({ role: 'user' as const, content: part.text });
                    }
                    // Handle other part types if needed
                }
            }

            // Add system message for JSON response if schema is provided
            if (schema) {
                messages.unshift({
                    role: 'system' as const,
                    content: 'You are a helpful assistant that outputs in JSON format.'
                });
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages,
                response_format: schema ? { type: 'json_object' } : undefined,
                temperature: 0.7,
            }, { signal: controller.signal });

            clearTimeout(timeoutId);

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new OpenAIAPIError('Empty response from OpenAI');
            }

            if (schema) {
                try {
                    const parsed = JSON.parse(content);
                    return parsed as T;
                } catch (parseError) {
                    console.error('Failed to parse OpenAI JSON response:', content, parseError);
                    throw new OpenAIAPIError(
                        `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                        'PARSE_ERROR',
                        500,
                        true
                    );
                }
            }

            return { text: content } as unknown as T;
        } catch (error) {
            lastError = error as Error;
            console.error(`OpenAI call attempt ${attempt + 1} failed:`, error);
            
            if (error instanceof OpenAIAPIError && !error.retryable) {
                throw error;
            }
            
            // Add exponential backoff
            if (attempt < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
        }
    }

    console.error("OpenAI call failed after all retries.", lastError);
    if (lastError instanceof OpenAIAPIError) throw lastError;
    throw new OpenAIAPIError(
        lastError?.message || 'Max retries exceeded',
        'MAX_RETRIES',
        500,
        false
    );
}

export {
    callOpenAI,
    OpenAIAPIError
};
