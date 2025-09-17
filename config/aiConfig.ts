// Supported AI providers
export type AIProvider = 'gemini' | 'openai';

// Default provider from environment variable or default to 'gemini'
const defaultProvider: AIProvider = (import.meta.env.VITE_AI_PROVIDER as AIProvider) || 'gemini';

// Configuration for each provider
const providerConfig = {
    gemini: {
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
        model: 'gemini-2.5-flash',
    },
    openai: {
        apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
        model: 'gpt-4-turbo-preview',
    },
} as const;

// Validate API key for the current provider
const validateApiKey = (provider: AIProvider) => {
    const config = providerConfig[provider];
    if (!config.apiKey) {
        console.warn(`No API key found for ${provider}. Please set VITE_${provider.toUpperCase()}_API_KEY in your .env file.`);
        return false;
    }
    return true;
};

// Get the current provider configuration
export const getAIConfig = () => {
    // Use the default provider if it has a valid API key, otherwise try the other one
    const provider = validateApiKey(defaultProvider) 
        ? defaultProvider 
        : defaultProvider === 'gemini' ? 'openai' : 'gemini';
    
    if (!validateApiKey(provider)) {
        throw new Error('No valid AI provider configuration found. Please check your environment variables.');
    }

    return {
        provider,
        ...providerConfig[provider],
    };
};

// AIProvider type is exported inline above
