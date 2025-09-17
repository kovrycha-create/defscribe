import React, { useState, useMemo, useEffect, useRef } from 'react';
import { type SummaryStyle, type ActionItem, type Snippet, type SpeakerProfile, type SpeakerId, type SpeechAnalytics, type TranscriptEntry, type StatCardKey, type GeneratedTitle, type TopicSegment, type CosmicReading, type AuraData, type LiveAudioFeatures, type DiarizationSegment, Emotion } from '../../types';
import TalkTimeVisualizer from '../TalkTimeVisualizer';
import AnalyticsItemLoader from '../AnalyticsItemLoader';
import { strands } from '../../data/strands';
import { cards } from '../../data/cards';
import { fluons } from '../../data/fluons';
import { trinkets } from '../../data/trinkets';
import Tooltip from '../Tooltip';
import CustomSelect from '../CustomSelect';

interface AuraSettings {
    auraPalette: string;
    setAuraPalette: (palette: string) => void;
    auraPulsationSpeed: number;
    setAuraPulsationSpeed: (speed: number) => void;
    auraParticleDensity: number;
    setAuraParticleDensity: (density: number) => void;
    auraCustomColors: { core: string; positive: string; negative: string; neutral: string; };
    setAuraCustomColors: (colors: { core: string; positive: string; negative: string; neutral: string; }) => void;
}

interface AnalyticsPanelProps extends AuraSettings {
  isSummarizing: boolean;
  summary: string;
  summaryStyle: SummaryStyle | null;
  onSummarize: (style: SummaryStyle) => void;
  actionItems: ActionItem[];
  snippets: Snippet[];
  topics: TopicSegment[];
  titles: GeneratedTitle[];
  isAnalyzing: boolean;
  isGeneratingTitles: boolean;
  onGenerateTitles: () => void;
  hasEnoughContent: boolean;
  speechAnalytics: Partial<SpeechAnalytics>;
  speakerProfiles: Record<SpeakerId, SpeakerProfile>;
    segments: DiarizationSegment[];
  transcriptEntries: TranscriptEntry[];
  highlightedTopic: string | null;
  onSetHighlightedTopic: (topic: string | null) => void;
  statCardOrder: StatCardKey[];
  setStatCardOrder: (order: StatCardKey[]) => void;
  isTourActive?: boolean;
  currentTourStepId?: string;
  onGenerateCosmicReading: () => void;
  isReading: boolean;
  cosmicReading: CosmicReading | null;
  onOpenCodex: (tab: string, entryId: string) => void;
  auraData: AuraData | null;
  liveAudioFeatures: LiveAudioFeatures;
}

// ===================================================================================
// INLINE COMPONENT: AuraVisualization
// Reason: To implement the new Aura UI without adding new files.
// ===================================================================================

const EMOTION_COLORS: Record<Emotion, [number, number, number]> = {
    happy: [255, 215, 0], // Gold
    calm: [77, 138, 255], // Blue (Primary)
    intense: [239, 68, 68], // Red
    sad: [100, 149, 237], // Cornflower Blue
    confused: [167, 119, 255], // Purple (Secondary)
    thinking: [167, 119, 255],
    talking: [77, 138, 255],
    listening: [60, 179, 113], // Medium Sea Green
    mad: [220, 20, 60], // Crimson
    frustrated: [255, 127, 80], // Coral
    surprised: [255, 165, 0], // Orange
    goofy: [255, 105, 180], // Hot Pink
    normal: [200, 200, 200], // Grey
    cold: [176, 224, 230], // PowderBlue
    dizzy: [152, 251, 152], // PaleGreen
    embarassed: [255, 182, 193], // LightPink
    hurt: [135, 206, 235], // SkyBlue
    loving: [255, 20, 147], // DeepPink
    sleepy: [72, 61, 139], // DarkSlateBlue
    smug: [218, 112, 214], // Orchid
};

const AURA_PALETTES: Record<string, Record<Emotion, [number, number, number]>> = {
    emotion: EMOTION_COLORS,
    calm: {
        ...EMOTION_COLORS,
        happy: [60, 179, 113], calm: [77, 138, 255], intense: [45, 212, 191], sad: [72, 61, 139], mad: [100, 149, 237], frustrated: [135, 206, 235],
    },
    vibrant: {
        ...EMOTION_COLORS,
        happy: [255, 215, 0], calm: [0, 255, 255], intense: [255, 0, 0], sad: [255, 20, 147], mad: [255, 0, 255], frustrated: [255, 165, 0],
    },
};

// Helper to convert hex to an RGB array
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255, 255, 255];
};

type Particle = { x: number; y: number; vx: number; vy: number; radius: number; alpha: number; color: string; };

const AuraVisualization: React.FC<{ auraData: AuraData | null; liveAudioFeatures: LiveAudioFeatures; settings: AuraSettings }> = ({ auraData, liveAudioFeatures, settings }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const [visibleKeywords, setVisibleKeywords] = useState<string[]>([]);
    const [showControls, setShowControls] = useState(false);
    
    const audioFeaturesRef = useRef(liveAudioFeatures);
    useEffect(() => {
        audioFeaturesRef.current = liveAudioFeatures;
    });

    // Stable keyword appearance: deterministic offsets (so they don't jump each render),
    // slightly longer display, and fewer simultaneous keywords to reduce clutter.
    const stableOffset = (s: string, range = 12) => {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (h * 31 + s.charCodeAt(i)) >>> 0;
        }
        const x = (h % (range * 2)) - range;
        const y = ((h >> 8) % (range * 2)) - range;
        return { x, y };
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (auraData?.keywords && auraData.keywords.length > 0) {
                const availableKeywords = auraData.keywords.filter(k => !visibleKeywords.includes(k));
                if (availableKeywords.length > 0) {
                    const newKeyword = availableKeywords[Math.floor(Math.random() * availableKeywords.length)];
                    setVisibleKeywords(prev => {
                        const next = [...prev, newKeyword].slice(-2); // Show max 2 keywords
                        setTimeout(() => {
                            setVisibleKeywords(current => current.filter(k => k !== newKeyword));
                        }, 6000); // 6s display duration for stability
                        return next;
                    });
                }
            }
        }, 3500);
        return () => clearInterval(interval);
    }, [auraData?.keywords, visibleKeywords]);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const dpr = window.devicePixelRatio || 1;
        let animationFrameId: number;
        
        const resize = () => {
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.offsetWidth * dpr;
                canvas.height = canvas.parentElement.offsetHeight * dpr;
                // Use setTransform to avoid accumulating scales on repeated resize
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        };
        resize();
        window.addEventListener('resize', resize);
        
        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);
            const { offsetWidth: W, offsetHeight: H } = canvas;
            ctx.clearRect(0, 0, W, H);
            
            const centerX = W / 2;
            const centerY = H / 2;
            
            const emotion = auraData?.dominantEmotion || 'normal';
            let color: [number, number, number];
            if (settings.auraPalette === 'custom') {
                color = hexToRgb(settings.auraCustomColors.core);
            } else {
                const palette = AURA_PALETTES[settings.auraPalette] || AURA_PALETTES.emotion;
                color = palette[emotion] || palette.normal;
            }
            
            // --- Particles ---
            const volume = audioFeaturesRef.current.volume || 0;
            // Reduce spawn rate and cap for a calmer experience
            if (volume > 0.5 && Math.random() > (0.95 / settings.auraParticleDensity) && particlesRef.current.length < 120) {
                const sentiment = auraData?.sentiment || 0;
                let particleColor = settings.auraCustomColors.neutral;
                if (sentiment > 0.3) particleColor = settings.auraCustomColors.positive;
                else if (sentiment < -0.3) particleColor = settings.auraCustomColors.negative;

                particlesRef.current.push({
                    x: centerX, y: centerY,
                    vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
                    radius: Math.random() * 2 + 1, alpha: 1, color: particleColor,
                });
            }

            // Iterate backwards to safely remove faded particles
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.006; // slower fade for smoother visuals
                if (p.alpha <= 0) {
                    particlesRef.current.splice(i, 1);
                    continue;
                }

                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // --- Rings ---
            for (let i = 3; i > 0; i--) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, (W * 0.15) + (i * 20) + (volume * 10 * settings.auraPulsationSpeed), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.1 * (4 - i)})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // --- Orb ---
            const baseRadius = W * 0.15;
            const radius = baseRadius * (1 + volume * 0.1 * settings.auraPulsationSpeed);
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            gradient.addColorStop(0, `rgba(${color.join(',')}, 0.9)`);
            gradient.addColorStop(0.8, `rgba(${color.join(',')}, 0.5)`);
            gradient.addColorStop(1, `rgba(${color.join(',')}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
        };

        draw();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        }
    }, [auraData, settings]);
    
    if (!auraData) {
        return (
            <div className="flex flex-col items-center justify-center text-slate-400 h-full p-6 text-center animate-[fadeIn_0.5s_ease-out]">
                <i className="fas fa-atom text-4xl mb-4 text-[var(--color-secondary)]"></i>
                <h3 className="font-semibold text-lg text-slate-200">Aura Analysis</h3>
                <p className="text-sm">Start speaking to see a real-time visualization of your communication's energy.</p>
            </div>
        );
    }
    
    return (
        <div 
            className="relative w-full h-full flex items-center justify-center"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
        >
            <div className="w-full h-full flex items-stretch gap-4">
                <div className="flex-1 relative">
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
                {/* Info panel */}
                <aside className="w-64 p-3 rounded-lg bg-slate-900/60 border border-slate-700/50 flex-shrink-0">
                    <h4 className="text-sm font-semibold text-slate-200 mb-2">Aura Readout</h4>
                    <div className="text-sm text-slate-300 space-y-2">
                        <div>
                            <div className="text-xs text-slate-400">Dominant Emotion</div>
                            <div className="font-bold text-white">{auraData.dominantEmotion}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Sentiment</div>
                            <div className="font-bold text-white">{(auraData.sentiment * 100).toFixed(0)}%</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400">Keywords</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {auraData.keywords.map(k => (
                                    <span key={k} className="bg-slate-800/40 px-2 py-1 rounded text-xs text-slate-200">{k}</span>
                                ))}
                            </div>
                        </div>
                        <div className="pt-2">
                            <div className="text-xs text-slate-400">Tips</div>
                            <div className="text-xs text-slate-300">Speak naturally; aura updates every few seconds.</div>
                        </div>
                    </div>
                </aside>
            </div>
            {visibleKeywords.map((keyword, i) => {
                const offsets = stableOffset(keyword, 16);
                const style: React.CSSProperties = {
                    position: 'absolute',
                    top: `${18 + (i * 16)}%`,
                    left: `${i % 2 === 0 ? 8 : 62}%`,
                    animation: `aura-keyword-float 6s ease-in-out forwards`,
                    // Use small deterministic translations to reduce jitter
                    transform: `translate(${offsets.x}px, ${offsets.y}px)`,
                } as React.CSSProperties;
                return (
                    <span key={keyword} style={style} className="text-lg font-bold text-slate-300 pointer-events-none select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                        {keyword}
                    </span>
                );
            })}
            <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="bg-slate-900/80 backdrop-blur-md p-2 rounded-lg border border-slate-700/50 shadow-xl flex flex-col gap-2 w-72">
                    <div className="flex items-center gap-2">
                        <Tooltip content="Color Palette"><i className="fas fa-palette text-slate-300 w-5 text-center"></i></Tooltip>
                        <div className="flex-1"><CustomSelect options={['Emotion', 'Calm', 'Vibrant', 'Custom']} value={settings.auraPalette.charAt(0).toUpperCase() + settings.auraPalette.slice(1)} onChange={(v) => settings.setAuraPalette(v.toLowerCase())} label="Aura Color Palette" /></div>
                    </div>
                    {settings.auraPalette === 'custom' && (
                        <div className="flex justify-around items-center gap-1 text-center animate-[fadeIn_0.2s_ease-out]">
                            {(['core', 'positive', 'negative', 'neutral'] as const).map(key => (
                                <div key={key} className="flex flex-col items-center gap-1">
                                    <input type="color" value={settings.auraCustomColors[key]} onChange={(e) => settings.setAuraCustomColors({...settings.auraCustomColors, [key]: e.target.value})} className="w-8 h-8 p-0 border-none rounded-md bg-transparent cursor-pointer" aria-label={`${key} color`} />
                                    <label className="text-xs text-slate-400">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Tooltip content="Pulsation Speed"><i className="fas fa-heartbeat text-slate-300 w-5 text-center"></i></Tooltip>
                        <input type="range" min="0.2" max="2.5" step="0.1" value={settings.auraPulsationSpeed} onChange={(e) => settings.setAuraPulsationSpeed(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tooltip content="Particle Density"><i className="fas fa-atom text-slate-300 w-5 text-center"></i></Tooltip>
                        <input type="range" min="0.2" max="2.5" step="0.1" value={settings.auraParticleDensity} onChange={(e) => settings.setAuraParticleDensity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"/>
                    </div>
                </div>
            </div>
        </div>
    );
};


type ActiveTab = 'summary' | 'actions' | 'snippets' | 'stats' | 'reading' | 'aura';

const useTypingEffect = (text: string, speed = 25) => {
    const [displayedText, setDisplayedText] = useState('');
    const intervalRef = useRef<number | null>(null);
    const idxRef = useRef(0);

    useEffect(() => {
        // Clear any existing interval (defensive) and reset state
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setDisplayedText('');
        idxRef.current = 0;

        if (!text) return undefined;

        intervalRef.current = window.setInterval(() => {
            setDisplayedText(prev => {
                // If prev length has gotten out of sync, snap to the expected slice
                if (prev.length !== idxRef.current) {
                    const corrected = text.slice(0, idxRef.current);
                    return corrected;
                }
                const nextChar = text.charAt(idxRef.current) || '';
                idxRef.current += 1;
                // If we've reached the end, clear interval
                if (idxRef.current >= text.length && intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                return prev + nextChar;
            });
        }, speed);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [text, speed]);

    return displayedText;
};

const CosmicReadingLoader: React.FC = () => (
    <div className="flex flex-col items-center justify-center text-slate-400 h-full p-6 text-center animate-[fadeIn_0.5s_ease-out]">
        <div className="relative w-24 h-24 mb-4">
            <div className="absolute inset-0 border-2 border-[var(--color-primary)]/30 rounded-full"></div>
            <div className="absolute inset-2 border-t-2 border-[var(--color-primary)] rounded-full animate-spin"></div>
            <div className="absolute inset-4 text-3xl text-[var(--color-secondary)] flex items-center justify-center animate-pulse">
                <i className="fas fa-atom"></i>
            </div>
        </div>
        <p className="font-semibold text-slate-300">Consulting the Cosmic Currents...</p>
        <p className="text-sm">Ymzo is interpreting the strands of fate.</p>
    </div>
);

// Removed unused fluonNames and trinketNames to eliminate lint warnings

const getLoreItemDetails = (name: string, type: 'strand' | 'card' | 'modifier', cardId?: string): { id: string, symbol: string, tab: string } | null => {
    if (type === 'strand') {
        const strand = strands.find(s => s.name === name);
        return strand ? { id: strand.id, symbol: strand.symbol, tab: 'strands' } : null;
    }
    if (type === 'card' && cardId) {
        const cardData = cards[cardId as keyof typeof cards];
        return cardData ? { id: cardId, symbol: '🃏', tab: 'cards' } : null;
    }
    if (type === 'modifier') {
        const fluon = Object.values(fluons).flat().find(f => f.name === name);
        if (fluon) return { id: fluon.id, symbol: fluon.symbol, tab: 'fluons' };
        const trinket = trinkets.find(t => t.name === name);
        if (trinket) return { id: trinket.id, symbol: trinket.symbol, tab: 'trinkets' };
    }
    return null;
};

const LoreGlyph: React.FC<{ name: string; type: 'strand' | 'card' | 'modifier'; cardId?: string; onOpenCodex: (tab: string, entryId: string) => void; }> = ({ name, type, cardId, onOpenCodex }) => {
    const details = getLoreItemDetails(name, type, cardId);
    if (!details) return <span className="text-amber-300">{name}</span>;
    
    return (
        <button
          onClick={() => onOpenCodex(details.tab, details.id)}
          className="inline-flex items-center gap-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 rounded-full px-3 py-1 text-sm font-semibold transition-colors shadow-inner"
        >
          <span className="text-lg">{details.symbol}</span>
          <span>{name}</span>
        </button>
    );
};

const CosmicReadingPanel: React.FC<{ reading: CosmicReading; onOpenCodex: (tab: string, entryId: string) => void; }> = ({ reading, onOpenCodex }) => {
    const typedReadingText = useTypingEffect(reading.readingText);
    const cardTitle = cards[reading.cardId as keyof typeof cards]?.title || reading.cardId;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-4 animate-[fadeIn_0.5s_ease-out]">
            <div className="text-center mb-4">
                <h3 className="font-russo-one text-lg text-[var(--color-primary)] tracking-wider" style={{textShadow: '0 0 8px rgba(var(--color-primary-rgb), 0.7)'}}>The Oracle's Dossier</h3>
            </div>
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <LoreGlyph name={reading.coreStrand} type="strand" onOpenCodex={onOpenCodex} />
                    <LoreGlyph name={cardTitle} type="card" cardId={reading.cardId} onOpenCodex={onOpenCodex} />
                    {reading.modifiers.map(mod => <LoreGlyph key={mod} name={mod} type="modifier" onOpenCodex={onOpenCodex} />)}
                </div>
                <div className="border-t border-[var(--color-secondary)]/20 my-4"></div>
                <div className="prose prose-sm prose-invert max-w-none prose-p:text-slate-300 min-h-[100px]">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{typedReadingText}<span className="inline-block w-0.5 h-4 bg-white/70 ml-1 animate-[cursor-blink_1s_step-end_infinite]"></span></p>
                </div>
            </div>
        </div>
    );
};

const SummaryButton: React.FC<{ style: SummaryStyle; current: SummaryStyle | null; onClick: () => void; children: React.ReactNode; }> = ({ style, current, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex-1 cosmo-button ${style === current ? 'bg-[var(--color-primary)] text-black border-transparent' : ''}`}
  >
    {children}
  </button>
);

const StatCard: React.FC<{ icon: string; label: string; value: string | number; unit?: string; }> = ({ icon, label, value, unit }) => (
    <div className="stat-card-full p-3 flex items-center gap-2 rounded-lg">
        <div className="text-slate-500">
            <i className="fas fa-grip-vertical"></i>
        </div>
        <div className="w-10 h-10 bg-slate-900/50 rounded-full flex items-center justify-center text-[var(--color-accent)] text-xl flex-shrink-0 border-2 border-[rgba(var(--color-accent-rgb),0.2)]">
            <i className={`fas ${icon}`}></i>
        </div>
        <div className="flex-1 text-right">
            <div className="text-sm text-slate-300">{label}</div>
            <div className="text-2xl font-bold text-white">
                {value}
                {unit && <span className="text-base font-normal text-slate-300 ml-1">{unit}</span>}
            </div>
        </div>
    </div>
);

const TABS_CONFIG: { name: string; icon: string; tab: ActiveTab; }[] = [
    { name: 'Aura', icon: 'fa-atom', tab: 'aura' },
    { name: 'Stats', icon: 'fa-chart-pie', tab: 'stats' },
    { name: 'Summary', icon: 'fa-file-alt', tab: 'summary' },
    { name: 'Actions', icon: 'fa-bolt', tab: 'actions' },
    { name: 'Snippets', icon: 'fa-thumbtack', tab: 'snippets' },
    { name: 'Reading', icon: 'fa-book-open', tab: 'reading' },
];

const TabButton: React.FC<{
    name: string;
    icon: string;
    tab: ActiveTab;
    activeTab: ActiveTab;
    onClick: (tab: ActiveTab) => void;
    count?: number;
    isIconOnly?: boolean;
    iconSizeVariant?: 'normal' | 'compact' | 'xs';
    pulse?: boolean;
}> = ({ name, icon, tab, activeTab, onClick, count, isIconOnly, iconSizeVariant = 'normal' }) => {
  const isActive = activeTab === tab;
  
  const baseClasses = 'relative text-center font-semibold py-4 text-sm md:py-2 transition-all duration-300 rounded-t-lg border border-b-0 flex items-center justify-center';
  const activeClasses = 'bg-[rgba(var(--color-primary-rgb),0.3)] text-white border-[rgba(var(--color-primary-rgb),0.5)]';
  const inactiveClasses = 'bg-[rgba(var(--color-primary-rgb),0.1)] text-slate-400 border-transparent hover:bg-[rgba(var(--color-primary-rgb),0.2)] hover:border-[rgba(var(--color-primary-rgb),0.4)] hover:border-b-transparent';
  
    const layoutClasses = isIconOnly
        ? (iconSizeVariant === 'xs' ? 'flex-grow-0 flex-shrink-0 basis-10' : iconSizeVariant === 'compact' ? 'flex-grow-0 flex-shrink-0 basis-12' : 'flex-grow-0 flex-shrink-0 basis-16')
        : 'flex-auto';

        return (
    <Tooltip content={name}>
      <button
        onClick={() => onClick(tab)}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${layoutClasses}`}
      >
        {isIconOnly ? <i className={`fas ${icon} ${iconSizeVariant === 'xs' ? 'text-sm' : iconSizeVariant === 'compact' ? 'text-base' : 'text-lg'}`}></i> : name}
        {/* pulse handled by parent via absolute badge when needed */}
        {count != null && count > 0 && (
          <span className={`absolute top-1 text-xs bg-[var(--color-secondary)] text-white rounded-full h-5 min-w-[1.25rem] px-1 flex items-center justify-center font-bold ${isIconOnly ? 'right-1' : 'right-2'}`}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
    </Tooltip>
  );
};
TabButton.displayName = 'TabButton';


const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ 
  isSummarizing, summary, summaryStyle, onSummarize, actionItems, 
  snippets, topics, titles, isAnalyzing, isGeneratingTitles, onGenerateTitles, hasEnoughContent,
  speechAnalytics, speakerProfiles, transcriptEntries,
  highlightedTopic, onSetHighlightedTopic, statCardOrder, setStatCardOrder,
  isTourActive, currentTourStepId, onGenerateCosmicReading, isReading, cosmicReading, onOpenCodex,
  auraData, liveAudioFeatures, ...auraSettings
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<ActiveTab>('stats');
  const [copiedTitleId, setCopiedTitleId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [navWidth, setNavWidth] = useState(0);

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) return;

    setNavWidth(navElement.offsetWidth);

    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            setNavWidth(entry.contentRect.width);
        }
    });

    observer.observe(navElement);
    return () => observer.disconnect();
  }, []);

  const activeTab = isTourActive && currentTourStepId === 'summary' ? 'summary' : localActiveTab;

    // Auto-open Aura tab when aura data appears (helps users discover the feature)
    useEffect(() => {
        if (auraData) {
            setLocalActiveTab('aura');
        }
    }, [auraData]);

  const handleTabClick = (tab: ActiveTab) => {
    setLocalActiveTab(tab);
  };

  const hasEnoughContentForAnalytics = useMemo(() => {
    const totalWords = transcriptEntries.map(e => e.text).join(' ').split(/\s+/).filter(Boolean).length;
    return totalWords > 20;
  }, [transcriptEntries]);

  const hasAnyAnalytics = speechAnalytics.wpm !== undefined || actionItems.length > 0 || snippets.length > 0;
  
  const [draggedItem, setDraggedItem] = useState<StatCardKey | null>(null);
  const [dragOverItem, setDragOverItem] = useState<StatCardKey | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, statKey: StatCardKey) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItem(statKey);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, statKey: StatCardKey) => {
        e.preventDefault();
        if (statKey !== dragOverItem) {
            setDragOverItem(statKey);
        }
    };
    
    const handleDragLeave = () => {
        setDragOverItem(null);
    };

    const handleDrop = () => {
        if (!draggedItem || !dragOverItem || draggedItem === dragOverItem) return;

        const draggedIndex = statCardOrder.indexOf(draggedItem);
        const dropIndex = statCardOrder.indexOf(dragOverItem);
        
        const newOrder = [...statCardOrder];
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dropIndex, 0, removed);

        setStatCardOrder(newOrder);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverItem(null);
    };
    
    const handleCopyTitle = (title: GeneratedTitle) => {
        navigator.clipboard.writeText(title.text);
        setCopiedTitleId(title.id);
        setTimeout(() => setCopiedTitleId(null), 2000);
    }
    
    const allStats: Record<StatCardKey, { icon: string; label: string; value: string | number; unit?: string; }> = {
        wpm: { icon: "fa-tachometer-alt", label: "Avg. Speed", value: speechAnalytics.wpm?.toFixed(0) || 0, unit: "WPM" },
        duration: { icon: "fa-stopwatch", label: "Duration", value: speechAnalytics.duration ? new Date(speechAnalytics.duration * 1000).toISOString().substr(14, 5) : '00:00', unit: "MM:SS" },
        speakingRateLabel: { icon: "fa-rocket", label: "Speaking Rate", value: speechAnalytics.speakingRateLabel || 'Medium' },
        words: { icon: "fa-file-word", label: "Total Words", value: speechAnalytics.words || 0 },
        avgSentenceLength: { icon: "fa-paragraph", label: "Avg. Sentence", value: speechAnalytics.avgSentenceLength?.toFixed(1) || 0, unit: "words" },
        vocabularyRichness: { icon: "fa-book-open", label: "Vocabulary", value: speechAnalytics.vocabularyRichness?.toFixed(1) || 0, unit: "% rich" },
        questionCount: { icon: "fa-question-circle", label: "Questions Asked", value: speechAnalytics.questionCount || 0 },
        fillers: { icon: "fa-comment-dots", label: "Filler Words", value: speechAnalytics.fillers || 0 },
        pauses: { icon: "fa-pause-circle", label: "Pauses", value: speechAnalytics.pauses || 0 },
    };

        // Choose the largest icon size variant that fits entirely within the nav width.
        // This prevents starting to shrink icons until the full 'normal' width would overflow.
        const VARIANT_BASIS_PX: Record<'normal'|'compact'|'xs', number> = { normal: 64, compact: 48, xs: 40 };
        const variants: Array<'normal'|'compact'|'xs'> = ['normal','compact','xs'];
        let iconSizeVariant: 'normal'|'compact'|'xs' = 'normal';
        if (navWidth && TABS_CONFIG.length) {
            // Try the largest (normal) first; pick the first variant that fits total width
            const totalFor = (variant: 'normal'|'compact'|'xs') => VARIANT_BASIS_PX[variant] * TABS_CONFIG.length;
            const found = variants.find(v => totalFor(v) <= navWidth);
            iconSizeVariant = found || 'xs';
        }

  return (
    <div className="flex flex-col h-full cosmo-panel md:rounded-2xl p-2 md:p-4 gap-4 overflow-hidden">
      <header className="flex items-end z-10 -mx-2 md:-mx-4">
        <nav ref={navRef} className="flex w-full px-2 md:px-4 border-b border-[rgba(var(--color-primary-rgb),0.5)]">
                {TABS_CONFIG.map(tabConfig => {
                // Render tabs as icon-only (reverted to the original behavior)
                const isIconOnly = true;
                let count: number | undefined;
                if (tabConfig.tab === 'actions') count = actionItems.length;
                if (tabConfig.tab === 'snippets') count = snippets.length;
                
                return (
                                                                <div key={tabConfig.tab} className="relative">
                                                                    <TabButton
                                                                        name={tabConfig.name}
                                                                        icon={tabConfig.icon}
                                                                        tab={tabConfig.tab}
                                                                        activeTab={activeTab}
                                                                        onClick={handleTabClick}
                                                                        count={count}
                                                                        isIconOnly={isIconOnly}
                                                                        iconSizeVariant={iconSizeVariant}
                                                                    />
                                                                    {/* Aura pulse indicator: show a small pulsing dot when auraData exists and user isn't viewing aura */}
                                                                    {tabConfig.tab === 'aura' && auraData && activeTab !== 'aura' && (
                                                                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(250,204,21,0.9)] animate-pulse" aria-hidden="true"></span>
                                                                    )}
                                                                </div>
                );
            })}
        </nav>
      </header>
      
      {!hasAnyAnalytics && !isAnalyzing && activeTab !== 'reading' && activeTab !== 'aura' ? (
          <EmptyState text={hasEnoughContentForAnalytics ? "No analytics available." : "Not enough content to generate analytics."} />
      ) : isAnalyzing && activeTab !== 'stats' && activeTab !== 'reading' && activeTab !== 'aura' ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 z-10">
            <i className="fas fa-brain text-4xl mb-3 spinner-animation"></i>
            <p>Analyzing transcript...</p>
        </div>
      ) : (
        <>
            {activeTab === 'aura' && (
                <div className="flex-1 flex flex-col min-h-0 z-10">
                   <AuraVisualization auraData={auraData} liveAudioFeatures={liveAudioFeatures} settings={auraSettings} />
                </div>
            )}
            {activeTab === 'summary' && (
            <div className="flex-1 flex flex-col min-h-0 z-10">
                <div className="flex-1 flex flex-col min-h-0">
                    <TalkTimeVisualizer talkTimeData={speechAnalytics.talkTime || {}} speakerProfiles={speakerProfiles} />
                    <div className="flex gap-2 mb-3" data-tour-id="summary-buttons">
                        <SummaryButton style="basic" current={summaryStyle} onClick={() => onSummarize('basic')}>Basic</SummaryButton>
                        <SummaryButton style="detailed" current={summaryStyle} onClick={() => onSummarize('detailed')}>Detailed</SummaryButton>
                        <SummaryButton style="full" current={summaryStyle} onClick={() => onSummarize('full')}>Full</SummaryButton>
                    </div>
                    {isSummarizing ? (
                        <AnalyticsItemLoader />
                    ) : (
                        <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-4 prose prose-sm prose-invert max-w-none prose-p:text-slate-300">
                            <p style={{ whiteSpace: 'pre-wrap' }}>{summary}</p>
                        </div>
                    )}
                    {(speechAnalytics.topics && speechAnalytics.topics.length > 0) && (
                        <div className="pt-3 mt-3 border-t border-[rgba(var(--color-primary-rgb),0.2)]">
                            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Topics</h3>
                            <div className="flex flex-wrap gap-2">
                                {speechAnalytics.topics.map(topic => (
                                    <button 
                                        key={topic.id} 
                                        onClick={() => onSetHighlightedTopic(topic.text === highlightedTopic ? null : topic.text)}
                                        className={`px-2 py-1 text-xs rounded-full transition-colors duration-200 
                                            ${highlightedTopic === topic.text 
                                                ? 'bg-[var(--color-accent)] text-black font-bold shadow-[0_0_8px_rgba(var(--color-accent-rgb),0.7)]' 
                                                : 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/40'
                                            }`}
                                    >
                                        {topic.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="pt-3 mt-auto">
                    <button onClick={onGenerateTitles} disabled={isGeneratingTitles || !hasEnoughContent} className="cosmo-button w-full h-10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isGeneratingTitles ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                        <span>{isGeneratingTitles ? 'Generating...' : 'Suggest Titles'}</span>
                    </button>
                    {titles.length > 0 && (
                        <div className="mt-3 space-y-2 animate-[fadeIn_0.3s_ease-out]">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase">Suggestions:</h4>
                        {titles.map(title => (
                            <button key={title.id} onClick={() => handleCopyTitle(title)} className="w-full text-left text-sm p-2 rounded-md bg-slate-800/50 hover:bg-slate-700/50 transition-colors flex justify-between items-center group">
                            <span className="flex-1 pr-2">{title.text}</span>
                            {copiedTitleId === title.id ? (
                                <span className="text-green-400 text-xs font-bold">Copied!</span>
                            ) : (
                                <i className="fas fa-copy text-slate-500 group-hover:text-slate-300 transition-colors"></i>
                            )}
                            </button>
                        ))}
                        </div>
                    )}
                </div>
            </div>
            )}
            
            {activeTab === 'stats' && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 z-10">
                    {!speechAnalytics.wpm ? <EmptyState text="No stats available." /> : (
                        <div className="flex flex-col gap-3">
                            {statCardOrder.map(key => {
                                const stat = allStats[key];
                                if (!stat) return null;

                                const isBeingDragged = draggedItem === key;
                                const isDragTarget = dragOverItem === key;

                                return (
                                    <div
                                        key={key}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, key)}
                                        onDragOver={(e) => handleDragOver(e, key)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onDragEnd={handleDragEnd}
                                        className={`transition-all duration-200 cursor-move rounded-lg ${isBeingDragged ? 'opacity-30 scale-95' : 'opacity-100'}`}
                                    >
                                        {isDragTarget && <div className="h-2 bg-[var(--color-primary)]/50 rounded-full my-1 animate-pulse" />}
                                        <StatCard
                                            icon={stat.icon}
                                            label={stat.label}
                                            value={stat.value}
                                            unit={stat.unit}
                                        />
                                    </div>
                                );
                           })}
                        </div>
                    )}
                </div>
            )}


            {activeTab === 'actions' && (
                <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {isAnalyzing ? <AnalyticsItemLoader /> : actionItems.length === 0 ? <EmptyState text="No action items found." /> : (
                      actionItems.map(item => <ListItem key={item.id} icon={item.type === 'action' ? 'fa-bolt' : 'fa-gavel'} content={item.content} />)
                    )}
                </div>
            )}

            {activeTab === 'snippets' && (
                <div className="flex-1 overflow-y-auto space-y-3 z-10">
                    {isAnalyzing ? <AnalyticsItemLoader /> : snippets.length === 0 ? <EmptyState text="No key snippets found." /> : (
                      snippets.map(item => <ListItem key={item.id} icon={item.type === 'quote' ? 'fa-quote-left' : item.type === 'question' ? 'fa-question-circle' : 'fa-lightbulb'} content={item.content} />)
                    )}
                </div>
            )}

            {activeTab === 'reading' && (
                <div className="flex-1 flex flex-col min-h-0 z-10">
                    {isReading ? (
                        <CosmicReadingLoader />
                    ) : cosmicReading ? (
                        <CosmicReadingPanel reading={cosmicReading} onOpenCodex={onOpenCodex} />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 h-full p-6 text-center">
                            <i className="fas fa-crystal-ball text-4xl mb-4 text-[var(--color-secondary)]"></i>
                            <h3 className="font-semibold text-lg text-slate-200">The Oracle Awaits</h3>
                            <p className="text-sm mb-4">Consult Ymzo for a mystical reading of your conversation, woven from the cosmic strands of fate.</p>
                            <button 
                                onClick={onGenerateCosmicReading} 
                                disabled={!hasEnoughContent}
                                className="cosmo-button h-12 px-6 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed animate-[cosmic-glow_3s_infinite]"
                            >
                                <i className="fas fa-wand-magic-sparkles"></i>
                                <span>Consult the Oracle</span>
                            </button>
                            {!hasEnoughContent && <p className="text-xs mt-2 text-slate-500">A reading requires more transcript content.</p>}
                        </div>
                    )}
                </div>
            )}
        </>
      )}
    </div>
  );
};

const EmptyState: React.FC<{text: string}> = ({ text }) => (
    <div className="flex flex-col items-center justify-center text-slate-400 h-full p-6 text-center">
        <svg className="w-16 h-16 mb-4 text-slate-500" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M49.22 23.36C48.56 15.34 41.36 9 32.99 9C25.96 9 20.2 13.58 18.23 20.03C17.92 19.96 17.6 19.92 17.27 19.92C14.02 19.92 11.33 22.61 11.33 25.86C11.33 29.11 14.02 31.8 17.27 31.8H48.41C52.73 31.8 56.26 28.27 56.26 23.95C56.26 19.86 53.18 16.51 49.34 16.14" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'rgba(var(--color-primary-rgb), 0.4)' }}/>
            <path d="M22 38L32 48L42 38" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'rgba(var(--color-primary-rgb), 0.6)' }}/>
            <path d="M32 48V26" stroke="currentColor" strokeWidth="3" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'rgba(var(--color-primary-rgb), 0.6)' }}/>
        </svg>
        <p>{text}</p>
    </div>
);

const ListItem: React.FC<{icon: string, content: string}> = ({icon, content}) => (
    <div className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg">
        <i className={`fas ${icon} text-[var(--color-accent)] pt-1 w-5 text-center`}></i>
        <p className="flex-1 text-sm text-slate-300">{content}</p>
    </div>
)

export default AnalyticsPanel;
