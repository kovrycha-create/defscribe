import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type TranscriptEntry, type Emotion } from '../types';
import Tooltip from './Tooltip';
import CursorTrail from './CursorTrail';
import { useKonamiCode } from '../hooks/useKonamiCode';
import { AudioContextManager } from '../utils/AudioContextManager';

interface ImmersiveModeProps {
  isListening: boolean;
  transcriptEntries: TranscriptEntry[];
  interimTranscript: string;
  stream: MediaStream | null;
  themeColors: { primary: string; secondary: string; accent: string; };
  onExit: () => void;
  onToggleListen: () => void;
  avatarEmotion: Emotion;
  avatarMap: Record<Emotion, string>;
}

type VisualizerType = 'waveform' | 'bars';
type BackgroundType = 'starfield' | 'digitalRain' | 'none';

const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
};


const useAudioProcessor = (isListening: boolean, stream: MediaStream | null) => {
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        let contextAcquired = false;
        if (isListening && stream) {
            const audioContext = AudioContextManager.acquire('immersive');
            contextAcquired = true;

            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            sourceRef.current = source;
            source.connect(analyser);
        }

        return () => {
            sourceRef.current?.disconnect();
            sourceRef.current = null;
            analyserRef.current = null;
            if (contextAcquired) {
                AudioContextManager.release('immersive');
            }
        };
    }, [isListening, stream]);
    
    return { analyser: analyserRef.current };
};


interface StarfieldBackgroundProps {
    analyser: AnalyserNode | null;
}

type Star = {
    x: number; y: number; z: number;
    radius: number; color: string; twinkleSpeed: number; twinkleOffset: number;
    isThemed: boolean;
};

const StarfieldBackground: React.FC<StarfieldBackgroundProps> = React.memo(({ analyser }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let stars: Star[] = [];
        const numStars = 500;
        
        const setup = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            const rootStyle = getComputedStyle(document.documentElement);
            const primaryRgb = rootStyle.getPropertyValue('--color-primary-rgb').trim();
            const secondaryRgb = rootStyle.getPropertyValue('--color-secondary-rgb').trim();
            const accentRgb = rootStyle.getPropertyValue('--color-accent-rgb').trim();
            const themeRgbColors = [primaryRgb, secondaryRgb, accentRgb].filter(Boolean);

            stars = [];
            for (let i = 0; i < numStars; i++) {
                let color = '255, 255, 255';
                let radius = Math.random() * 1.5;
                let isThemed = false;
                
                if (themeRgbColors.length > 0 && Math.random() < 0.05) { // 5% are themed
                    color = themeRgbColors[Math.floor(Math.random() * themeRgbColors.length)];
                    radius = Math.random() * 2 + 1;
                    isThemed = true;
                }

                stars[i] = {
                    x: Math.random() * canvas.width - canvas.width / 2,
                    y: Math.random() * canvas.height - canvas.height / 2,
                    z: Math.random() * canvas.width,
                    radius,
                    color,
                    twinkleSpeed: Math.random() * 0.0005,
                    twinkleOffset: Math.random() * Math.PI * 2,
                    isThemed,
                };
            }
        };
        setup();

        let animationFrameId: number;
        const draw = () => {
            let warpFactor = 0;
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
                warpFactor = (avg / 255) * 4;
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dynamic Wavy Background
            const primaryRgb = getComputedStyle(document.documentElement).getPropertyValue('--color-primary-rgb').trim() || '77, 138, 255';
            const secondaryRgb = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-rgb').trim() || '167, 119, 255';
            const time = Date.now() * 0.0002;

            ctx.fillStyle = `rgb(5, 8, 10)`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.globalAlpha = 0.5;
            ctx.filter = 'blur(30px)';

            const drawBlob = (x: number, y: number, radius: number, color: string) => {
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, `rgba(${color}, 0.2)`);
                gradient.addColorStop(1, `rgba(${color}, 0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            };

            const x1 = canvas.width / 2 + Math.sin(time) * 200;
            const y1 = canvas.height / 2 + Math.cos(time * 1.2) * 200;
            drawBlob(x1, y1, canvas.width * 0.4, primaryRgb);

            const x2 = canvas.width / 2 + Math.cos(time * 0.8) * 300;
            const y2 = canvas.height / 2 + Math.sin(time * 1.5) * 300;
            drawBlob(x2, y2, canvas.width * 0.35, secondaryRgb);

            ctx.globalAlpha = 1;
            ctx.filter = 'none';

            // Draw Stars
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);

            for (let i = 0; i < numStars; i++) {
                let star = stars[i];
                star.z -= (0.2 + warpFactor);
                if (star.z <= 0) {
                    star.z = canvas.width;
                }

                let k = 128.0 / star.z;
                let px = star.x * k;
                let py = star.y * k;
                let size = (1 - star.z / canvas.width) * star.radius * 2;
                
                const twinkle = 0.5 + Math.sin(star.twinkleOffset + Date.now() * star.twinkleSpeed) * 0.5;
                const alpha = (1 - star.z / canvas.width) * twinkle;

                if (star.isThemed) {
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = `rgba(${star.color}, 0.5)`;
                }
                
                ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fill();

                if (star.isThemed) {
                    ctx.shadowBlur = 0;
                }
            }
            ctx.restore();
            animationFrameId = requestAnimationFrame(draw);
        };
        draw();
        
        window.addEventListener('resize', setup);
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', setup);
        }
    }, [analyser]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />;
});

interface DigitalRainProps {
    analyser: AnalyserNode | null;
    themeColors: { primary: string; secondary: string; accent: string; };
}

const DigitalRainBackground: React.FC<DigitalRainProps> = React.memo(({ analyser, themeColors }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const characters = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズヅブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const fontSize = 48;
        let columns: number;
        let drops: number[];
        
        const setup = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            columns = Math.floor(canvas.width / fontSize);
            drops = Array(columns).fill(1).map(() => Math.random() * canvas.height);
        };
        setup();

        let animationFrameId: number;
        let lastFrameTime = 0;

        const draw = (currentTime: number) => {
            animationFrameId = requestAnimationFrame(draw);

            let audioEnergy = 1.0;
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const normalizedAvg = avg / 255.0; // 0 to 1
                audioEnergy = 0.5 + normalizedAvg * 1.0; // Range 0.5 to 1.5 for smoother dynamics
            }

            const interval = 1000 / (20 * audioEnergy); // Base 20 FPS, scaled by audio
            if (currentTime - lastFrameTime < interval) {
                return;
            }
            lastFrameTime = currentTime;

            ctx.fillStyle = 'rgba(5, 8, 10, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = `${fontSize}px monospace`;
            
            const colorPalette = [themeColors.primary, themeColors.secondary, themeColors.primary, themeColors.primary];

            for (let i = 0; i < drops.length; i++) {
                const text = characters.charAt(Math.floor(Math.random() * characters.length));
                const yPos = drops[i] * fontSize;

                if (Math.random() > 0.985) {
                    ctx.fillStyle = themeColors.accent;
                    ctx.shadowColor = themeColors.accent;
                    ctx.shadowBlur = 10;
                } else {
                    ctx.fillStyle = colorPalette[i % colorPalette.length];
                    ctx.shadowBlur = 0;
                }
                
                ctx.fillText(text, i * fontSize, yPos);
                
                if (yPos > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
            ctx.shadowBlur = 0;
        };

        draw(0);

        window.addEventListener('resize', setup);
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', setup);
        };
    }, [analyser, themeColors]);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />;
});


const EnhancedVisualizer: React.FC<{ analyser: AnalyserNode | null; themeColors: { primary: string; secondary: string; accent: string; }; type: VisualizerType; }> = React.memo(({ analyser, themeColors, type }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
  
    useEffect(() => {
        if (analyser) {
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.8;
        }
    }, [analyser]);
  
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const setup = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        setup();

        let animationFrameId: number;
        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);
            const ctx = canvas.getContext('2d');
            if (!ctx || !analyser) {
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, themeColors.secondary);
            gradient.addColorStop(0.5, themeColors.primary);
            gradient.addColorStop(1, themeColors.accent);
            ctx.strokeStyle = gradient;
            ctx.fillStyle = gradient;
            ctx.shadowColor = themeColors.primary;
            ctx.shadowBlur = 10;
      
            if (type === 'waveform') {
                analyser.fftSize = 2048;
                const dataArray = new Uint8Array(analyser.fftSize);
                analyser.getByteTimeDomainData(dataArray);

                ctx.lineWidth = 3;
                ctx.beginPath();
                const sliceWidth = canvas.width * 1.0 / analyser.frequencyBinCount;
                let x = 0;

                for (let i = 0; i < analyser.frequencyBinCount; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * canvas.height / 2;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
            } else if (type === 'bars') {
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);

                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
            }
        };

        draw();
        window.addEventListener('resize', setup);
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', setup);
        };
    }, [themeColors, analyser, type]);

    return <canvas ref={canvasRef} className="w-full h-full" />;
});

const MenuButton: React.FC<{text: string; onClick: () => void; icon: string; isSpecial?: 'red' | 'green'; isActive?: boolean;}> = ({text, onClick, icon, isSpecial, isActive}) => (
    <Tooltip text={text} position="bottom">
        <button onClick={onClick} className={`w-14 h-12 text-lg sm:w-20 sm:h-16 sm:text-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 rounded-xl
            ${isSpecial === 'red' ? 'bg-red-500/80 hover:bg-red-500' :
            isSpecial === 'green' ? 'bg-green-500/80 hover:bg-green-500' :
            isActive ? 'bg-[rgba(var(--color-primary-rgb),0.5)]' :
            'bg-black/40 hover:bg-black/60 backdrop-blur-sm'
            }`}
        >
            <i className={`fas ${icon}`}></i>
        </button>
    </Tooltip>
);

const getTransitionClasses = (from: Emotion, to: Emotion): { out: string, in: string } => {
    let transition = { out: 'animate-emotion-fade-out', in: 'animate-emotion-fade-in' };

    if (to === 'surprised') return { out: 'animate-none', in: 'animate-emotion-surprise-pop' };
    if (to === 'mad' || to === 'frustrated' || to === 'intense') return { out: 'animate-none', in: 'animate-emotion-shake' };

    if (to === 'happy' || to === 'goofy' || to === 'loving') {
        transition.in = 'animate-emotion-happypop-in';
    } else if (to === 'sad' || to === 'hurt') {
        transition.out = 'animate-emotion-saddroop-out';
        transition.in = 'animate-emotion-fade-in';
    } else if (to === 'thinking' || to === 'confused') {
        transition.out = 'animate-emotion-crossfade-out';
        transition.in = 'animate-emotion-crossfade-in';
    } else if (to === 'sleepy') {
        transition.out = 'animate-emotion-crossfade-out';
        transition.in = 'animate-emotion-fade-in';
    }

    if (from === 'talking' && (to === 'listening' || to === 'calm')) {
        transition.out = 'animate-emotion-fade-out-quick';
        transition.in = 'animate-emotion-fade-in-quick';
    }
    return transition;
};

const ImmersiveMode: React.FC<ImmersiveModeProps> = ({ isListening, transcriptEntries, interimTranscript, stream, themeColors, onExit, onToggleListen, avatarEmotion, avatarMap }) => {
  const [isFullscreen, setIsFullscreen] = useState(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisualsPanelOpen, setIsVisualsPanelOpen] = useState(false);
  const [visualizerType, setVisualizerType] = useState<VisualizerType>('waveform');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('starfield');

  const [showAvatar, setShowAvatar] = useState(true);
  const [avatarSize, setAvatarSize] = useState(() => window.innerWidth < 768 ? 1.5 : 2.5);
  const [avatarGlow, setAvatarGlow] = useState(0);
  const [avatarScale, setAvatarScale] = useState(1);
  const [avatarClickCount, setAvatarClickCount] = useState(0);
  const [isAvatarSpinning, setIsAvatarSpinning] = useState(false);
  const [isRaveMode, setIsRaveMode] = useState(false);
  
  const [displayedEmotion, setDisplayedEmotion] = useState(avatarEmotion);
  const [nextEmotion, setNextEmotion] = useState<Emotion | null>(null);
  const [transitionClasses, setTransitionClasses] = useState({ out: '', in: '' });

  type LiveTextState = 'visible' | 'holding' | 'fading';
  const [liveTextState, setLiveTextState] = useState<LiveTextState>('visible');
  const [liveText, setLiveText] = useState('');
  const prevInterimTranscript = usePrevious(interimTranscript);
  const prevTranscriptEntriesLength = usePrevious(transcriptEntries.length) ?? 0;
  const [lastAddedEntryId, setLastAddedEntryId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { analyser } = useAudioProcessor(isListening, stream);

  useKonamiCode(() => {
    setIsRaveMode(true);
    setTimeout(() => setIsRaveMode(false), 5000);
  });
  
  useEffect(() => {
    if (transcriptEntries.length > prevTranscriptEntriesLength) {
        setLastAddedEntryId(transcriptEntries[transcriptEntries.length - 1].id);
    } else if (transcriptEntries.length === 0 && prevTranscriptEntriesLength > 0) {
        setLastAddedEntryId(null);
    }
  }, [transcriptEntries, prevTranscriptEntriesLength]);
  
  useEffect(() => {
    if (interimTranscript) {
        setLiveText(interimTranscript);
        setLiveTextState('visible');
    } else if (prevInterimTranscript && !interimTranscript) {
        setLiveText(prevInterimTranscript);
        setLiveTextState('holding');
    }
  }, [interimTranscript, prevInterimTranscript]);

  useEffect(() => {
      let holdTimer: ReturnType<typeof setTimeout>;
      let fadeTimer: ReturnType<typeof setTimeout>;
      if (liveTextState === 'holding') {
          holdTimer = setTimeout(() => {
              setLiveTextState('fading');
          }, 1000);
      } else if (liveTextState === 'fading') {
          fadeTimer = setTimeout(() => {
              setLiveText('');
              setLiveTextState('visible');
              setLastAddedEntryId(null);
          }, 500);
      }
      return () => {
          clearTimeout(holdTimer);
          clearTimeout(fadeTimer);
      };
  }, [liveTextState]);
  
  useEffect(() => {
    if (avatarEmotion !== displayedEmotion && !nextEmotion) {
        setNextEmotion(avatarEmotion);
        const classes = getTransitionClasses(displayedEmotion, avatarEmotion);
        setTransitionClasses(classes);
        
        setTimeout(() => {
            setDisplayedEmotion(avatarEmotion);
            setNextEmotion(null);
        }, 500);
    }
  }, [avatarEmotion, displayedEmotion, nextEmotion]);
  
  const handleAvatarClick = () => {
    if (isAvatarSpinning) return;
    const newCount = avatarClickCount + 1;
    setAvatarClickCount(newCount);
    if (newCount >= 10) {
        setIsAvatarSpinning(true);
        setAvatarClickCount(0);
        setTimeout(() => setIsAvatarSpinning(false), 500);
    }
  };
  
  const toggleFullScreen = useCallback(() => {
    const doc = document as any;
    const isCurrentlyFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement;

    if (!isCurrentlyFullscreen) {
      document.documentElement.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
    } else {
        if (doc.exitFullscreen) {
            doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) { // For Safari
            doc.webkitExitFullscreen();
        }
    }
  }, []);
  
  const handleFullscreenChange = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      if (e.code === 'Space') { e.preventDefault(); onToggleListen(); }
      if (e.key === 'f' || e.key === 'F') toggleFullScreen();
      if (e.key === 'm' || e.key === 'M') setIsMenuOpen(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, onToggleListen, toggleFullScreen]);

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        const bassAvg = (dataArray.slice(0, 10).reduce((a, b) => a + b, 0)) / 10;
        const reactivity = Math.min(1, bassAvg / 220.0);
        setAvatarGlow(reactivity);
        setAvatarScale(1.62 + reactivity * 1.0);
      } else {
        setAvatarGlow(g => Math.max(0, g * 0.95));
        setAvatarScale(s => 1.62 + (s - 1.62) * 0.95);
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser]);

  const finalEntriesToShow = transcriptEntries.slice(-4);
  const placeholderText = isListening ? ' ' : (transcriptEntries.length > 0 ? '' : 'Start speaking to see your transcript here...');
  const liveTextClassName = {
      visible: 'opacity-100',
      holding: 'opacity-100',
      fading: 'opacity-0 transition-opacity duration-500 ease-out'
  }[liveTextState];

  return (
    <div ref={containerRef} className="fixed inset-0 bg-[#05080a] text-white flex flex-col items-center justify-center overflow-hidden animate-[immersive-fade-in_0.5s_ease-out] [animation:breathing-bg_20s_ease-in-out_infinite]">
      {isRaveMode && <div className="absolute inset-0 z-[9998] animate-[rave-bg_0.5s_linear_infinite]" />}
      <CursorTrail />
      {backgroundType === 'starfield' && <StarfieldBackground analyser={analyser} />}
      {backgroundType === 'digitalRain' && <DigitalRainBackground analyser={analyser} themeColors={themeColors} />}
      
      {isMenuOpen ? (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-in-out`}>
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-black/30 backdrop-blur-md rounded-2xl border border-slate-700/50" style={{ filter: `drop-shadow(0 0 10px rgba(var(--color-primary-rgb), 0.5))` }}>
                <MenuButton text={isListening ? "Stop (Space)" : "Start (Space)"} onClick={onToggleListen} icon={isListening ? 'fa-stop' : 'fa-microphone'} isSpecial={isListening ? 'red' : 'green'} />
                <MenuButton text="Visuals" onClick={() => setIsVisualsPanelOpen(p => !p)} icon="fa-paint-brush" isActive={isVisualsPanelOpen} />
                <MenuButton text={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"} onClick={toggleFullScreen} icon={isFullscreen ? 'fa-compress' : 'fa-expand'} />
                <MenuButton text="Exit (Esc)" onClick={onExit} icon="fa-times-circle" />
                <MenuButton text="Hide Menu (M)" onClick={() => setIsMenuOpen(false)} icon="fa-chevron-up" />
            </div>
            {isVisualsPanelOpen && (
                <div className="mt-4 bg-black/30 backdrop-blur-md rounded-xl p-3 space-y-3 border border-slate-700/50 shadow-lg animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm w-16 sm:w-20 text-slate-300">Avatar:</span>
                        <input type="range" min="0.5" max="3.5" step="0.1" value={avatarSize} onChange={(e) => setAvatarSize(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"/>
                        <Tooltip text={showAvatar ? "Hide" : "Show"}><button onClick={() => setShowAvatar(!showAvatar)} className={`w-8 h-8 text-lg rounded-lg transition-colors flex-shrink-0 ${showAvatar ? 'bg-[var(--color-primary)]/30' : 'bg-slate-700/50'} hover:bg-slate-700/80`}><i className="fas fa-user-circle"></i></button></Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="font-semibold text-sm w-16 sm:w-20 text-slate-300">Visualizer:</span>
                         <button onClick={() => setVisualizerType('waveform')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${visualizerType === 'waveform' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Wave</button>
                         <button onClick={() => setVisualizerType('bars')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${visualizerType === 'bars' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Bars</button>
                    </div>
                     <div className="flex items-center gap-2">
                         <span className="font-semibold text-sm w-16 sm:w-20 text-slate-300">Background:</span>
                         <button onClick={() => setBackgroundType('starfield')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${backgroundType === 'starfield' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Stars</button>
                         <button onClick={() => setBackgroundType('digitalRain')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${backgroundType === 'digitalRain' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>Rain</button>
                         <button onClick={() => setBackgroundType('none')} className={`px-3 py-1 text-sm rounded-lg transition-colors flex-1 ${backgroundType === 'none' ? 'bg-[var(--color-primary)] text-black' : 'bg-slate-700/50 hover:bg-slate-700/80'}`}>None</button>
                    </div>
                </div>
            )}
          </div>
      ) : (
          <div className="fixed top-4 left-4 z-[100]">
            <Tooltip text="Show Menu (M)" position="right">
                <button onClick={() => setIsMenuOpen(true)} className="w-12 h-12 text-xl sm:w-14 sm:h-14 sm:text-2xl rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center border border-slate-700/50 shadow-lg hover:bg-slate-700/80 transition-colors animate-cosmic-glow">
                    <i className="fas fa-bars"></i>
                </button>
            </Tooltip>
          </div>
      )}
      
      {showAvatar && (
        <div
            className="absolute top-[30%] left-1/2 z-40 transition-transform duration-100"
            style={{
                width: `${8 * avatarSize}rem`,
                height: `${8 * avatarSize}rem`,
                transform: `translateX(-50%) translateY(-50%) scale(${avatarScale})`,
            }}
            onClick={handleAvatarClick}
        >
            <div 
                className={`relative w-full h-full rounded-full border-2 cursor-pointer transition-all duration-300 ${isAvatarSpinning ? 'animate-avatar-spin' : ''}`}
                style={{
                    borderColor: `rgba(var(--color-primary-rgb), ${0.2 + avatarGlow * 0.8})`,
                    boxShadow: `0 0 ${10 + avatarGlow * 80}px rgba(var(--color-primary-rgb), ${0.3 + avatarGlow * 0.6}), inset 0 0 8px rgba(255,255,255,0.2)`
                }}
            >
                <img
                    key={displayedEmotion}
                    src={avatarMap[displayedEmotion]}
                    alt="Vircy Avatar"
                    className={`absolute inset-0 w-full h-full rounded-full ${nextEmotion ? transitionClasses.out : ''}`}
                />
                {nextEmotion && (
                    <img
                        key={nextEmotion}
                        src={avatarMap[nextEmotion]}
                        alt="Vircy Avatar Transition"
                        className={`absolute inset-0 w-full h-full rounded-full ${transitionClasses.in}`}
                    />
                )}
            </div>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none z-50 pb-24 sm:pb-48">
        <div className="w-full max-w-4xl text-center space-y-2 p-2 sm:p-4">
          <div className="h-48 text-lg sm:text-2xl text-slate-400 space-y-2 overflow-hidden flex flex-col justify-end">
             {finalEntriesToShow.map(entry => {
                const isTheLatestEntry = entry.id === lastAddedEntryId;
                const shouldHideTemporarily = isTheLatestEntry && liveTextState === 'holding';
                
                let animationClass = '';
                if (isTheLatestEntry) {
                    animationClass = shouldHideTemporarily ? 'opacity-0' : 'animate-[slide-fade-in_0.6s_ease-out]';
                }

                return (
                    <p
                        key={entry.id}
                        className={`transition-all duration-500 ease-out ${animationClass}`}
                    >
                        {entry.text}
                    </p>
                );
             })}
          </div>
          <div className="min-h-[4rem] text-2xl sm:text-4xl font-semibold text-slate-100 p-2 sm:p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-lg">
            <p className={liveTextClassName}>
              {liveText || placeholderText}
              {isListening && liveTextState === 'visible' && <span className="inline-block w-1 h-8 sm:h-10 bg-[var(--color-accent)] ml-1 animate-[cursor-blink_1s_step-end_infinite]"></span>}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-48 z-20 pointer-events-none">
        <EnhancedVisualizer analyser={analyser} themeColors={themeColors} type={visualizerType} />
      </div>
    </div>
  );
};

export default ImmersiveMode;