declare module '@google/genai' {
  export const Type: {
    OBJECT: string;
    ARRAY: string;
    STRING: string;
    INTEGER: string;
    NUMBER: string;
    BOOLEAN: string;
    NULL: string;
    TYPE_UNSPECIFIED: string;
  };

  export type GenerateContentResponse = {
    text?: string | undefined;
    [key: string]: any;
  };

  export interface Chat {
    sendMessageStream(opts?: any): AsyncIterable<{ text?: string }>;
    sendMessage?(opts?: any): Promise<any>;
  }

  export class GoogleGenAI {
    constructor(opts?: { apiKey?: string });
    chats: {
      create(opts: any): Chat;
    };
    models: {
      generateContent(opts: { model: string; contents: any; config?: any }): Promise<GenerateContentResponse>;
    };
  }
}
