import React, { useState, useMemo, useRef, useEffect } from 'react';

const HARSH_WORDS = new Set(['no', 'bad', 'wrong', 'stop', 'not', 'don\'t', 'can\'t', 'won\'t', 'never', 'problem', 'issue', 'terrible', 'horrible']);
const CALM_WORDS = new Set(['yes', 'good', 'right', 'ok', 'please', 'thanks', 'thank', 'great', 'excellent', 'perfect', 'agree', 'continue']);
const QUESTION_WORDS = new Set(['who', 'what', 'when', 'where', 'why', 'how', 'which', 'is', 'are', 'do', 'does', 'can', 'could', 'would']);

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
};

interface BackgroundPenLogoProps {
    isListening: boolean;
    isSummarizing: boolean;
    wpm: number;
    confidence: number;
    finalTranscript: string;
    sessionActive: boolean;
    isExpanded: boolean;
    isMobileView: boolean;
}

const BackgroundPenLogo: React.FC<BackgroundPenLogoProps> = ({ isListening, isSummarizing, wpm, confidence, finalTranscript, sessionActive, isExpanded, isMobileView }) => {
    const [easterEgg, setEasterEgg] = useState(false);
    const scribblePathRef = useRef<SVGPathElement>(null);
    const lastPointRef = useRef({ x: 128, y: 220 });
    const lastTranscriptLengthRef = useRef(0);

    const [scribbleState, setScribbleState] = useState({
        path: 'M 128 220',
        length: 0,
        animation: 'none',
    });
    
    const [isFadingOut, setIsFadingOut] = useState(false);
    const prevIsListening = usePrevious(isListening);

    useEffect(() => {
        if (prevIsListening && !isListening) {
            setIsFadingOut(true);
            const timer = setTimeout(() => {
                setIsFadingOut(false);
                // After the fade-out, always reset the path to start fresh.
                // If a "thinking" animation needs to start, the other useEffect will handle it.
                lastPointRef.current = { x: 128, y: 220 };
                setScribbleState({ path: 'M 128 220', length: 0, animation: 'none' });
            }, 500); // Match CSS transition duration
            return () => clearTimeout(timer);
        }
    }, [isListening, prevIsListening]);


    useEffect(() => {
        let newText = finalTranscript.slice(lastTranscriptLengthRef.current);
        
        if (isListening && newText.trim()) {
            const words = newText.toLowerCase().split(/\s+/);
            let sentiment = 0; 
            let isQuestion = false;
            words.forEach(word => {
                if (HARSH_WORDS.has(word)) sentiment--;
                if (CALM_WORDS.has(word)) sentiment++;
                if (QUESTION_WORDS.has(word)) isQuestion = true;
            });

            const generateSegment = () => {
                const last = lastPointRef.current;

                if (isExpanded) {
                    const length = 40 + Math.random() * 60;
                    const angle = (Math.random() - 0.5) * Math.PI * 2;
                    let nextX = last.x + Math.cos(angle) * length;
                    let nextY = last.y + Math.sin(angle) * length;
                    nextX = Math.max(20, Math.min(236, nextX));
                    nextY = Math.max(40, Math.min(240, nextY));
                    const midX = (last.x + nextX) / 2 + (Math.random() - 0.5) * 40;
                    const midY = (last.y + nextY) / 2 + (Math.random() - 0.5) * 40;
                    lastPointRef.current = { x: nextX, y: nextY };
                    return ` Q ${midX},${midY} ${nextX},${nextY}`;
                }

                const length = 10 + Math.random() * 20;
                const angle = (Math.random() - 0.5) * Math.PI * 1;
                let nextX = last.x + Math.cos(angle) * length;
                let nextY = last.y + Math.sin(angle) * length;
                nextX = Math.max(100, Math.min(156, nextX));
                nextY = Math.max(210, Math.min(240, nextY));

                let segment = '';
                if (sentiment < 0) {
                    const midX = (last.x + nextX) / 2 + (Math.random() - 0.5) * 20;
                    const midY = (last.y + nextY) / 2 + (Math.random() - 0.5) * 20;
                    segment = ` L ${midX} ${midY} L ${nextX} ${nextY}`;
                } else if (isQuestion) {
                    const c1x = last.x + (Math.random() - 0.5) * 40;
                    const c1y = last.y + (Math.random() - 0.5) * 40;
                    const c2x = nextX + (Math.random() - 0.5) * 40;
                    const c2y = nextY + (Math.random() - 0.5) * 40;
                    segment = ` C ${c1x},${c1y} ${c2x},${c2y} ${nextX},${nextY}`;
                } else {
                    const c1x = (last.x + nextX) / 2;
                    const c1y = (last.y + nextY) / 2;
                    segment = ` S ${c1x},${c1y} ${nextX},${nextY}`;
                }
                
                lastPointRef.current = { x: nextX, y: nextY };
                return segment;
            };

            setScribbleState(prev => ({ ...prev, path: prev.path + generateSegment() }));
        }
        lastTranscriptLengthRef.current = finalTranscript.length;

        if (isSummarizing && !isFadingOut) {
            lastPointRef.current = {x: 128, y: 220 };
            setScribbleState({
                path: 'M 118 220 C 108 205, 148 205, 138 220 S 168 235, 118 220',
                length: 0,
                animation: `scribble-thinking-loop 2s ease-in-out infinite`,
            });
        }
    }, [finalTranscript, isListening, isSummarizing, isExpanded, isFadingOut]);

    useEffect(() => {
        if (scribblePathRef.current) {
            const length = scribblePathRef.current.getTotalLength();
            setScribbleState(s => ({ ...s, length }));
        }
    }, [scribbleState.path]);


    const penAnimationStyle = useMemo(() => {
        if (easterEgg) return { animation: 'easter-egg-spin 1.5s ease-in-out' };
        if (isListening) {
            const speed = Math.max(0.5, 3 - (wpm / 80)); 
            return { animation: `scribble-active ${speed}s ease-in-out infinite` };
        }
        if (sessionActive) {
             return { animation: 'float-chill 12s ease-in-out infinite' };
        }
        return { animation: 'float-idle 8s ease-in-out infinite' };
    }, [isListening, wpm, easterEgg, sessionActive]);

    const scribbleStyle = useMemo(() => {
        const isVisible = isListening || (isSummarizing && !isFadingOut);
        const baseStyle: React.CSSProperties = {
            transition: 'opacity 0.5s ease-in-out, stroke-dashoffset 0.1s linear',
            filter: `drop-shadow(0 0 8px rgba(var(--color-accent-rgb), ${confidence}))`,
            strokeOpacity: 0.3 + confidence * 0.7,
            opacity: isVisible ? 1 : 0,
        };

        if (isSummarizing && !isFadingOut) {
             return {
                ...baseStyle,
                strokeDasharray: scribbleState.length,
                strokeDashoffset: 0,
                animation: scribbleState.animation,
            };
        }

        if (isListening) {
            const speed = Math.max(0.2, 1 - (wpm / 200));
            return {
                ...baseStyle,
                strokeDasharray: scribbleState.length,
                strokeDashoffset: 0,
                transition: `stroke-dashoffset ${speed}s linear, opacity 0.5s ease-in-out`,
            };
        }

        return baseStyle;
    }, [isListening, isSummarizing, wpm, confidence, scribbleState.length, scribbleState.animation, isFadingOut]);
    
    const handleEasterEgg = () => {
        setEasterEgg(true);
        setTimeout(() => setEasterEgg(false), 1500);
    };

    return (
        <div 
            className="flex justify-center transition-opacity duration-500"
            style={{ opacity: isListening || isSummarizing ? '1' : '0.7' }}
            aria-hidden="true"
        >
            <div className={`relative ${isMobileView ? 'w-48 h-48' : 'w-72 h-72'} transition-transform duration-500 ease-in-out ${isExpanded ? 'scale-[1.25]' : 'scale-[1.8]'}`}>
                <img
                    src="https://static.wixstatic.com/media/2ef790_8834bc46053541f9b07873cdb91f5649~mv2.png"
                    alt="DefScribe Pen"
                    onClick={handleEasterEgg}
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl cursor-pointer"
                    style={penAnimationStyle}
                />
                <svg
                    viewBox="0 0 256 256"
                    className="absolute inset-0 w-full h-full overflow-visible"
                >
                    <path
                        ref={scribblePathRef}
                        d={scribbleState.path}
                        stroke="var(--color-accent)"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={scribbleStyle as React.CSSProperties}
                    />
                </svg>
            </div>
        </div>
    );
};

export default BackgroundPenLogo;