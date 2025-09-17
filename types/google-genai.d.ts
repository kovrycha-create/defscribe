declare module '@google/genai' {
  export const enum Type {
    TYPE_UNSPECIFIED = 'TYPE_UNSPECIFIED',
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    INTEGER = 'INTEGER',
    BOOLEAN = 'BOOLEAN',
    ARRAY = 'ARRAY',
    OBJECT = 'OBJECT',
    NULL = 'NULL',
  }

  export const enum Modality {
      MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED",
      TEXT = "TEXT",
      IMAGE = "IMAGE",
  }

  export type GenerateContentResponse = {
    readonly text: string;
    // other properties may exist
    [key: string]: any;
  };

  export interface Chat {
    sendMessageStream(opts?: any): Promise<AsyncGenerator<GenerateContentResponse>>;
    sendMessage(opts?: any): Promise<GenerateContentResponse>;
  }

  export class GoogleGenAI {
    constructor(opts?: { apiKey?: string });
    chats: {
      create(opts: any): Chat;
    };
    models: {
      generateContent(opts: { model: string; contents: any; config?: any }): Promise<GenerateContentResponse>;
      generateContentStream(opts: any): Promise<AsyncGenerator<GenerateContentResponse>>;
      generateImages(opts: any): Promise<any>;
      generateVideos(opts: any): Promise<any>;
    };
    operations: {
      getVideosOperation(opts: any): Promise<any>;
    }
  }
}
