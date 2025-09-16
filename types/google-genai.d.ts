declare module '@google/genai' {
  export const Type: {
    OBJECT: string;
    ARRAY: string;
    STRING: string;
  };

  export type GenerateContentResponse = {
    text?: string | undefined;
    [key: string]: any;
  };

  export interface ChatInstance {
    sendMessageStream(opts?: any): AsyncIterable<{ text?: string }>;
    sendMessage?(opts?: any): Promise<any>;
  }

  export class GoogleGenAI {
    constructor(opts?: { apiKey?: string });
    chats: {
      create(opts: any): ChatInstance;
    };
    models: {
      generateContent(opts: { model: string; contents: any; config?: any }): Promise<GenerateContentResponse>;
    };
  }

  // FIX: Removed redundant export statement that caused "Export declaration conflicts" errors.
}
