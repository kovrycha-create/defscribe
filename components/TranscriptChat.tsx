



import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { type ChatMessage } from '../types';
import Tooltip from './Tooltip';
import { translateText } from '../services/geminiService';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface TranscriptChatProps {
  transcript: string;
  onClose: () => void;
  translationLanguage: string;
  isMobile: boolean;
}

const TranscriptChat: React.FC<TranscriptChatProps> = ({ transcript, onClose, translationLanguage, isMobile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [autoScroll, setAutoScroll] = useState(true);
  const [newContent, setNewContent] = useState(false);
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isTranslatingId, setIsTranslatingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  useFocusTrap(chatContainerRef, true);

  const textSizeClasses = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-2xl' };
  const textSizeLabels = { sm: 'Small', base: 'Medium', lg: 'Large', xl: 'X-Large' };
  const nextTextSizeLabel = { sm: 'Medium', base: 'Large', lg: 'X-Large', xl: 'Small' };

  useEffect(() => {
    // When the component mounts (or remounts due to the `key` prop changing),
    // this effect will run.
    if (isMobile) {
        try {
            const hasSeenInfo = localStorage.getItem('defscribe-chatMobileInfoSeen');
            if (!hasSeenInfo) {
                setMessages(prev => [...prev, {
                    id: 'info-mobile',
                    role: 'model',
                    text: "You're on a mobile device! The chat context is based on the transcript when you opened this window. New spoken text won't be included until you close and reopen the chat."
                }]);
                localStorage.setItem('defscribe-chatMobileInfoSeen', 'true');
            }
        } catch (e) {
            console.warn("Could not access localStorage for chat info message.");
        }
    }
  }, [isMobile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Scroll handler effect
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    let scrollTimeout: number;
    const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
            if (isAtBottom) {
                if (!autoScroll) setAutoScroll(true);
                if (newContent) setNewContent(false);
            } else {
                if (autoScroll) setAutoScroll(false);
            }
        }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
        clearTimeout(scrollTimeout);
        container.removeEventListener('scroll', handleScroll);
    };
  }, [autoScroll, newContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setAutoScroll(true);
    
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const modelMessageId = `model-${Date.now()}`;
    setMessages(prev => [...prev, { id: modelMessageId, role: 'model', text: '', isLoading: true }]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are a helpful assistant analyzing a meeting transcript. The full transcript is provided below. Answer the user's questions based *only* on the information within this transcript. Do not make up information. If the answer is not in the transcript, say so.
                --- TRANSCRIPT START ---
                ${transcript}
                --- TRANSCRIPT END ---`,
            },
            history: messages
                .filter(m => (m.role === 'user' || (m.role === 'model' && !m.isLoading && m.text)))
                .map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.text }]
                }))
        });

        const responseStream = await chat.sendMessageStream({ message: input });

        let fullText = '';
        let streamingStarted = false;
        for await (const chunk of responseStream) {
            if (!streamingStarted) {
                if (!autoScroll) setNewContent(true);
                streamingStarted = true;
            }
            fullText += chunk.text;
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === modelMessageId ? { ...msg, text: fullText } : msg
                )
            );
        }
      
        setMessages(prev =>
            prev.map(msg =>
                msg.id === modelMessageId ? { ...msg, isLoading: false } : msg
            )
        );

    } catch (error) {
        console.error("Chat error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        setMessages(prev =>
            prev.map(msg =>
                msg.id === modelMessageId ? { ...msg, text: `Sorry, an error occurred: ${errorMessage}`, isLoading: false } : msg
            )
        );
    } finally {
        setIsLoading(false);
    }
  };


  const handleClearChat = () => {
    setMessages([]);
  };

  const cycleTextSize = () => {
    const sizes: ('sm' | 'base' | 'lg' | 'xl')[] = ['sm', 'base', 'lg', 'xl'];
    const currentIndex = sizes.indexOf(textSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setTextSize(sizes[nextIndex]);
  };

  const handleAutoScrollClick = () => {
    setAutoScroll(true);
    setNewContent(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
  };
  
  const handleTranslate = useCallback(async (messageId: string, text: string) => {
    if (isTranslatingId) return;
    setIsTranslatingId(messageId);
    try {
        const translated = await translateText(text, translationLanguage);
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, translatedText: translated } : msg
        ));
    } catch (error) {
        console.error("Translation error in chat:", error);
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, translatedText: "Translation failed." } : msg
        ));
    } finally {
        setIsTranslatingId(null);
    }
  }, [translationLanguage, isTranslatingId]);


  return (
    <div className="fixed inset-0 bg-black/50 z-[90] animate-[fadeIn_0.3s_ease-out]" onClick={onClose}>
      <div
        ref={chatContainerRef}
        className="fixed bottom-0 right-0 h-[60vh] max-h-[600px] w-full max-w-2xl cosmo-panel border-t-2 border-[var(--color-primary)] rounded-t-2xl shadow-2xl flex flex-col animate-[char-slide-in_0.5s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-title"
      >
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[rgba(var(--color-primary-rgb),0.2)]">
          <h2 id="chat-title" className="text-lg font-bold flex items-center gap-2"><i className="fas fa-comments text-[var(--color-primary)]"></i> Chat with Transcript</h2>
          <div className="flex items-center gap-2">
            <Tooltip content="Clear Chat">
              <button aria-label="Clear chat history" onClick={handleClearChat} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cosmo-button"><i className="fas fa-trash-alt"></i></button>
            </Tooltip>

            <Tooltip content={`Change to ${nextTextSizeLabel[textSize]} text`}>
                <button aria-label={`Change text size to ${nextTextSizeLabel[textSize]}`} onClick={cycleTextSize} className="h-8 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cosmo-button">
                    <i className="fas fa-text-height"></i>
                    <span className="text-xs font-semibold w-12 text-center">{textSizeLabels[textSize]}</span>
                </button>
            </Tooltip>

            <Tooltip content={autoScroll ? "Auto-scroll On" : "Scroll to Bottom"}>
              <button aria-label={autoScroll ? "Disable auto-scroll" : "Scroll to bottom"} onClick={handleAutoScrollClick} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 cosmo-button ${autoScroll ? 'text-[var(--color-primary)]' : `text-slate-400 ${newContent ? 'animate-cosmic-glow' : ''}`}`}>
                <i className={`fas ${autoScroll ? 'fa-anchor' : 'fa-arrow-down'}`}></i>
              </button>
            </Tooltip>
            <button aria-label="Close chat" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 p-6">
                <i className="fas fa-question-circle text-4xl mb-3"></i>
                <p>Ask anything about your transcript.</p>
                <p className="text-sm">e.g., "What were the action items for Speaker 1?"</p>
            </div>
          ) : (
            messages.map(msg => (
                <div key={msg.id} className={`relative group flex gap-3 ${msg.role === 'user' ? 'justify-end items-end' : 'items-start'} pt-5`}>
                  {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0 hex-clip"><i className="fas fa-robot text-black"></i></div>}
                  <div className={`max-w-[80%] rounded-2xl p-3 leading-relaxed ${msg.role === 'user' ? 'bg-[var(--color-secondary)] text-white' : 'bg-slate-700'}`}>
                      <p className={`${textSizeClasses[textSize]}`}>{msg.text}</p>
                      {msg.isLoading && <span className="inline-block w-2 h-2 bg-slate-300 rounded-full ml-2 animate-ping"></span>}
                      {msg.translatedText && <p className={`italic text-slate-400 mt-2 pt-2 border-t border-slate-600/50 ${textSizeClasses[textSize]}`}>{msg.translatedText}</p>}
                  </div>
                   {msg.role === 'model' && !msg.isLoading && msg.text && msg.id !== 'info-mobile' && (
                       <div className="absolute top-0 left-12 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-800/90 backdrop-blur-sm rounded-full border border-slate-600 p-1 shadow-lg">
                           <Tooltip content="Translate">
                                <button onClick={() => handleTranslate(msg.id, msg.text)} disabled={!!isTranslatingId} className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-wait" aria-label="Translate message">
                                    {isTranslatingId === msg.id ? <i className="fas fa-spinner fa-spin text-xs"></i> : <i className="fas fa-language text-xs"></i>}
                                </button>
                           </Tooltip>
                           <Tooltip content={copiedMessageId === msg.id ? "Copied!" : "Copy"}>
                                <button onClick={() => handleCopy(msg.text, msg.id)} className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-500" aria-label="Copy message">
                                    <i className={`fas ${copiedMessageId === msg.id ? 'fa-check text-green-400' : 'fa-copy'} text-xs`}></i>
                                </button>
                           </Tooltip>
                       </div>
                   )}
                  {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 hex-clip"><i className="fas fa-user text-white"></i></div>}
                </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex-shrink-0 p-4 border-t border-[rgba(var(--color-primary-rgb),0.2)]">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="w-full cosmo-input rounded-lg py-3 pl-4 pr-12 text-sm focus:outline-none disabled:opacity-50"
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[var(--color-primary)] rounded-lg text-black flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Send message">
              {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TranscriptChat;