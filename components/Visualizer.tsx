

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { AudioContextManager } from '../utils/AudioContextManager';
import { AUDIO_CONSTANTS } from '../constants/audio';
import Tooltip from './Tooltip';

interface VisualizerProps {
  isListening: boolean;
  stream: MediaStream | null;
  themeColors: { primary: string; secondary: string; accent: string; };
  height: number;
}

type VisualizerStyle = 'wave' | 'bars' | 'nexus' | 'classic';
interface VisualizerActiveStyles {
  wave: boolean;
  bars: boolean;
  nexus: boolean;
  classic: boolean;
}
type Particle = { x: number; y: number; radius: number; alpha: number; vx: number; vy: number; color: string; };
type IdleParticle = Particle & { life: number; maxLife: number; };
type NexusParticle = { x: number; y: number; vx: number; vy: number; radius: number; alpha: number; };
type TendrilPoint = { x: number; y: number; };
type Tendril = {
  points: TendrilPoint[];
  life: number;
  maxLife: number;
  width: number;
};

const SMALL_VISUALIZER_HEIGHT_THRESHOLD = 150;

const ToggleIcon: React.FC<{
  label: string; 
  icon: string; 
  enabled: boolean; 
  onChange: () => void;
}> = ({label, icon, enabled, onChange}) => (
  <Tooltip content={label}>
    <button onClick={onChange} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${enabled ? 'bg-[var(--color-primary)] text-black font-bold' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700/80'}`}>
      <i className={`fas ${icon}`}></i>
    </button>
  </Tooltip>
);

// Helper to robustly convert hex to an RGB array, avoiding CSS var race conditions.
const hexToRgbArray = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [77, 138, 255]; // Fallback to default primary
};


const Visualizer: React.FC<VisualizerProps> = ({ isListening, stream, themeColors, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const dataArray = useRef<Uint8Array | null>(null);
  const frequencyArray = useRef<Uint8Array | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const idleTime = useRef(0);
  
  // Customization state
  const [activeStyles, setActiveStyles] = useState<VisualizerActiveStyles>({ wave: true, bars: false, nexus: true, classic: false });
  const [styleOrder, setStyleOrder] = useState<VisualizerStyle[]>(['wave', 'nexus']);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [showControls, setShowControls] = useState(false);
  
  const barPeaks = useRef<number[]>([]);
  const classicBarPeaks = useRef<number[]>([]);
  const bassPulses = useRef<{ radius: number; alpha: number; x: number, y: number }[]>([]);
  const particles = useRef<Particle[]>([]);
  const idleParticles = useRef<IdleParticle[]>([]);
  const nexusParticles = useRef<NexusParticle[]>([]);
  const nexusTendrils = useRef<Tendril[]>([]);

  const isSmall = height < SMALL_VISUALIZER_HEIGHT_THRESHOLD;

  const handleStyleToggle = (style: VisualizerStyle) => {
    setActiveStyles(prev => {
      const isActivating = !prev[style];
      if (isActivating) {
        // Add to the end of the render order (on top)
        setStyleOrder(currentOrder => [...currentOrder, style]);
      } else {
        // Remove from render order
        setStyleOrder(currentOrder => currentOrder.filter(s => s !== style));
      }
      return { ...prev, [style]: isActivating };
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Use ResizeObserver to handle canvas resizing and prevent distortion
    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            const ctx = canvas.getContext('2d');
            ctx?.scale(dpr, dpr);
        }
    });

    observer.observe(container);

    return () => {
        observer.disconnect();
    };
}, []);

  const drawIdle = useCallback(() => {
    idleTime.current += 0.01;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, W, H);
    
    const themeRgbColors = [hexToRgbArray(themeColors.primary), hexToRgbArray(themeColors.secondary), hexToRgbArray(themeColors.accent)];
    
    if(idleParticles.current.length < 75) {
        const color = themeRgbColors[Math.floor(Math.random() * themeRgbColors.length)];
        idleParticles.current.push({
            x: Math.random() * W, y: Math.random() * H,
            radius: Math.random() * 2 + 0.5, alpha: 0,
            vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
            life: 0, maxLife: Math.random() * 200 + 100,
            color: `rgba(${color.join(',')}, 1)`
        });
    }

    idleParticles.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life < p.maxLife / 2) { p.alpha = p.life / (p.maxLife / 2); } 
        else { p.alpha = 1 - ((p.life - p.maxLife / 2) / (p.maxLife / 2)); }
        
        if (p.life >= p.maxLife || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
            const newColor = themeRgbColors[Math.floor(Math.random() * themeRgbColors.length)];
            p.x = Math.random() * W; p.y = Math.random() * H;
            p.life = 0; p.alpha = 0; p.maxLife = Math.random() * 200 + 100;
            p.color = `rgba(${newColor.join(',')}, 1)`;
        }
        
        const twinkleAlpha = p.alpha * (0.7 + Math.sin(p.life * 0.1) * 0.3);
        const baseColor = p.color.slice(0, p.color.lastIndexOf(',') + 1);
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${baseColor} ${twinkleAlpha})`;
        ctx.fill();
    });

    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, `${themeColors.secondary}1A`);
    gradient.addColorStop(0.5, `${themeColors.primary}B3`);
    gradient.addColorStop(1, `${themeColors.secondary}1A`);
    ctx.shadowColor = themeColors.primary;
    ctx.lineWidth = 2;
    ctx.strokeStyle = gradient;
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const y = H/2 + Math.sin(x * 0.02 + idleTime.current) * 15 * Math.cos(idleTime.current * 0.3);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    animationFrameId.current = requestAnimationFrame(drawIdle);
  }, [themeColors]);

  const draw = useCallback(() => {
    const currentAnalyser = analyser.current;
    const currentDataArray = dataArray.current;
    const currentFrequencyArray = frequencyArray.current;
    const canvas = canvasRef.current;
    
    if (!currentAnalyser || !currentDataArray || !currentFrequencyArray || !canvas) return;
    
  // Cast to the ArrayBuffer-backed form requested by some DOM lib overloads.
  currentAnalyser.getByteTimeDomainData(currentDataArray as unknown as Uint8Array<ArrayBuffer>);
  currentAnalyser.getByteFrequencyData(currentFrequencyArray as unknown as Uint8Array<ArrayBuffer>);

    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (!ctx) return;
    
    ctx.clearRect(0, 0, W, H);
    
    styleOrder.forEach(style => {
        if (!activeStyles[style]) return;
        switch (style) {
            case 'wave':
                drawWave(ctx, W, H, currentDataArray, themeColors, sensitivity);
                break;
            case 'bars':
                drawMirroredBars(ctx, W, H, currentFrequencyArray, themeColors, sensitivity, barPeaks.current);
                break;
            case 'nexus':
                drawNexus(ctx, W, H, currentFrequencyArray, themeColors, sensitivity, nexusParticles.current, nexusTendrils.current);
                break;
            case 'classic':
                drawClassicBars(ctx, W, H, currentFrequencyArray, themeColors, sensitivity, classicBarPeaks.current);
                break;
        }
    });

    drawBass(ctx, W, H, currentFrequencyArray, themeColors, bassPulses.current);
    drawParticles(ctx, W, H, currentFrequencyArray, themeColors, particles.current);
    
    animationFrameId.current = requestAnimationFrame(draw);
  }, [activeStyles, sensitivity, themeColors, styleOrder]);

  useEffect(() => {
    let contextAcquired = false;
    if (isListening && stream) {
        const audioContext = AudioContextManager.acquire('visualizer');
        contextAcquired = true;

        analyser.current = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
        source.connect(analyser.current);
        
  analyser.current.fftSize = AUDIO_CONSTANTS.FFT_SIZE;
  analyser.current.smoothingTimeConstant = AUDIO_CONSTANTS.SMOOTHING_TIME_CONSTANT;
  dataArray.current = new Uint8Array(analyser.current.fftSize);
  frequencyArray.current = new Uint8Array(analyser.current.frequencyBinCount);
        
        barPeaks.current = [];
        classicBarPeaks.current = [];
        particles.current = [];
        bassPulses.current = [];
        nexusParticles.current = [];
        nexusTendrils.current = [];

        draw();
    } else {
        idleParticles.current = [];
        drawIdle();
    }
    
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if(sourceNodeRef.current) sourceNodeRef.current.disconnect();
      if(analyser.current) analyser.current.disconnect();
      if (contextAcquired) AudioContextManager.release('visualizer');
    };
  }, [isListening, stream, draw, drawIdle]);

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-full bg-slate-900/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden shadow-lg"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className={`absolute right-2 transition-transform duration-300 transform-gpu ${isSmall ? 'top-2 origin-top-right' : 'bottom-2 origin-bottom-right'} ${showControls ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900/80 backdrop-blur-md p-2 rounded-lg border border-slate-700/50 shadow-xl flex items-center gap-2">
          <ToggleIcon label="Wave" icon="fa-wave-square" enabled={activeStyles.wave} onChange={() => handleStyleToggle('wave')} />
          <ToggleIcon label="Bars" icon="fa-chart-bar" enabled={activeStyles.bars} onChange={() => handleStyleToggle('bars')} />
          <ToggleIcon label="Nexus" icon="fa-atom" enabled={activeStyles.nexus} onChange={() => handleStyleToggle('nexus')} />
          <ToggleIcon label="Classic" icon="fa-align-left fa-rotate-270" enabled={activeStyles.classic} onChange={() => handleStyleToggle('classic')} />
          <div className="w-px h-8 bg-slate-700/50 mx-1" />
          <div className="flex items-center gap-2 w-28">
              <Tooltip content="Sensitivity">
                  <i className="fas fa-sliders-h text-slate-300"></i>
              </Tooltip>
              <input type="range" min="0.2" max="2.5" step="0.1" value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"/>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Drawing Functions ---

const drawWave = (ctx: CanvasRenderingContext2D, W: number, H: number, timeData: Uint8Array, theme: VisualizerProps['themeColors'], sensitivity: number) => {
    const bufferLength = timeData.length;
    const sliceWidth = W * 1.0 / bufferLength;
    const mainGradient = ctx.createLinearGradient(0, 0, W, 0);
    mainGradient.addColorStop(0, theme.secondary);
    mainGradient.addColorStop(0.5, theme.primary);
    mainGradient.addColorStop(1, theme.accent);
    ctx.lineWidth = 2;
    ctx.strokeStyle = mainGradient;
    ctx.shadowBlur = 15;
    ctx.shadowColor = theme.primary;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = (timeData[i] - 128) / 128.0;
        const y = (H / 2) + (v * (H / 2) * sensitivity);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
    }
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
};

const drawMirroredBars = (ctx: CanvasRenderingContext2D, W: number, H: number, freqData: Uint8Array, theme: VisualizerProps['themeColors'], sensitivity: number, peaks: number[]) => {
    const barCount = 32;
    const barWidth = W / barCount;
    const bufferLength = freqData.length;
    for (let i = 0; i < barCount; i++) {
        const freqIndex = Math.floor(i * ((bufferLength * 0.4) / barCount)); // Focus on lower-mid frequencies
        const barVal = freqData[freqIndex] / 255;
        const barHeight = Math.min(H / 2 - 2, Math.pow(barVal, 0.7) * (H / 2) * 1.5 * sensitivity);
        
        const x = i * barWidth;
        const gradient = ctx.createLinearGradient(0, H / 2 - barHeight, 0, H / 2 + barHeight);
        gradient.addColorStop(0, theme.primary);
        gradient.addColorStop(0.5, theme.secondary);
        gradient.addColorStop(1, theme.primary);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, H / 2 - barHeight, barWidth - 2, barHeight * 2);

        // Peaks
        if (!peaks[i] || barHeight > peaks[i]) {
            peaks[i] = barHeight;
        } else {
            peaks[i] *= 0.98; // Falloff
        }
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x, (H/2) - peaks[i] - 2, barWidth - 2, 2);
        ctx.fillRect(x, (H/2) + peaks[i], barWidth - 2, 2);
    }
};

const drawClassicBars = (ctx: CanvasRenderingContext2D, W: number, H: number, freqData: Uint8Array, theme: VisualizerProps['themeColors'], sensitivity: number, peaks: number[]) => {
    const barCount = 48;
    const barWidth = W / barCount;
    const bufferLength = freqData.length;
    for (let i = 0; i < barCount; i++) {
        const freqIndex = Math.floor(i * ((bufferLength * 0.6) / barCount)); // Focus on first 60% of frequencies
        const barVal = freqData[freqIndex] / 255;
        const barHeight = Math.min(H - 2, Math.pow(barVal, 0.7) * H * sensitivity);

        const x = i * barWidth;
        const y = H - barHeight;
        const gradient = ctx.createLinearGradient(x, H, x, y);
        gradient.addColorStop(0, theme.secondary);
        gradient.addColorStop(1, theme.primary);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 1, barHeight);
        if (!peaks[i] || barHeight >= peaks[i]) { peaks[i] = barHeight; } 
        else { peaks[i] -= H / 120; } // Slower falloff
        const peakY = H - peaks[i];
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x, peakY, barWidth - 1, 2);
    }
};

const drawNexus = (
    ctx: CanvasRenderingContext2D, W: number, H: number, 
    freqData: Uint8Array, theme: VisualizerProps['themeColors'], 
    sensitivity: number, nexusParticles: NexusParticle[], tendrils: Tendril[]
) => {
    const centerX = W / 2;
    const centerY = H / 2;

    const bass = (freqData[1] + freqData[2] + freqData[3]) / 3;
    const mid = (freqData[30] + freqData[40] + freqData[50]) / 3;
    const treble = (freqData[100] + freqData[150] + freqData[200]) / 3;

    const baseRadius = H * 0.15;
    const pulseFactor = 1 + (mid / 255) * 0.2;
    const jitterFactor = (treble / 255) * 4;

    // --- Draw Core ---
    const jitterX = (Math.random() - 0.5) * jitterFactor;
    const jitterY = (Math.random() - 0.5) * jitterFactor;
    
    // 1. Outer glow
    const glowRadius = baseRadius * pulseFactor * 2.5;
    const glowGradient = ctx.createRadialGradient(centerX + jitterX, centerY + jitterY, 0, centerX + jitterX, centerY + jitterY, glowRadius);
    glowGradient.addColorStop(0, `${theme.primary}40`);
    glowGradient.addColorStop(0.5, `${theme.primary}10`);
    glowGradient.addColorStop(1, `${theme.primary}00`);
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX + jitterX, centerY + jitterY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main orb
    const orbRadius = baseRadius * pulseFactor;
    const orbGradient = ctx.createRadialGradient(centerX + jitterX, centerY + jitterY, orbRadius * 0.5, centerX + jitterX, centerY + jitterY, orbRadius);
    orbGradient.addColorStop(0, `${theme.accent}FF`);
    orbGradient.addColorStop(0.7, `${theme.primary}CC`);
    orbGradient.addColorStop(1, `${theme.secondary}80`);
    ctx.fillStyle = orbGradient;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(centerX + jitterX, centerY + jitterY, orbRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Inner core (subtle flicker)
    if (Math.random() > 0.7) { // Flicker only on 30% of frames
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.random() * 0.2})`; // Dimmer flicker
        ctx.beginPath();
        ctx.arc(centerX + jitterX, centerY + jitterY, orbRadius * (0.3 + Math.random() * 0.3), 0, Math.PI * 2);
        ctx.fill();
    }

    if (mid > 150 && Math.random() > 0.7 && nexusParticles.length < 50) {
        nexusParticles.push({
            x: centerX + (Math.random() - 0.5) * orbRadius, 
            y: centerY + (Math.random() - 0.5) * orbRadius,
            vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
            radius: Math.random() * 2 + 1, alpha: 1
        });
    }
    for (let i = nexusParticles.length - 1; i >= 0; i--) {
        const p = nexusParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) { nexusParticles.splice(i, 1); continue; }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // --- Tendrils ---
    if (bass > 210 && Math.random() > 0.7 && tendrils.length < 8) {
        const startAngle = Math.random() * Math.PI * 2;
        const startPoint = { x: centerX + Math.cos(startAngle) * orbRadius, y: centerY + Math.sin(startAngle) * orbRadius };
        const newTendril: Tendril = { points: [startPoint], life: 1, maxLife: 60, width: Math.random() * 2 + 1 };
        
        let currentPoint = startPoint;
        let angle = startAngle;
        for (let i = 0; i < 15; i++) {
            const length = Math.random() * 20 + 5;
            angle += (Math.random() - 0.5) * 1.5;
            currentPoint = { x: currentPoint.x + Math.cos(angle) * length, y: currentPoint.y + Math.sin(angle) * length };
            newTendril.points.push(currentPoint);
        }
        tendrils.push(newTendril);
    }
    
    // Update and draw tendrils
    for (let i = tendrils.length - 1; i >= 0; i--) {
        const tendril = tendrils[i];
        tendril.life -= 0.02;
        if (tendril.life <= 0) { tendrils.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.moveTo(tendril.points[0].x, tendril.points[0].y);
        for (let j = 1; j < tendril.points.length; j++) { ctx.lineTo(tendril.points[j].x, tendril.points[j].y); }
        ctx.strokeStyle = `rgba(var(--color-primary-rgb), ${tendril.life})`;
        ctx.lineWidth = tendril.width * tendril.life;
        ctx.shadowColor = theme.primary;
        ctx.shadowBlur = 15;
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // The old spiky ring, but toned down
    ctx.beginPath();
    const numPoints = 128;
    const bufferLength = freqData.length;
    const radiusMultiplier = H * 0.1 * sensitivity;
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * (Math.PI * 2);
        const freqBin = Math.floor((i < numPoints / 2 ? i : numPoints - i) / (numPoints / 2) * (bufferLength / 4));
        const val = freqData[freqBin] / 255;
        const radius = orbRadius + 10 + Math.pow(val, 2) * radiusMultiplier;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = theme.secondary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
};

// --- Effect Functions ---

const drawBass = (ctx: CanvasRenderingContext2D, W: number, H: number, freqData: Uint8Array, theme: VisualizerProps['themeColors'], pulses: { radius: number; alpha: number, x:number, y:number }[]) => {
    const bass = (freqData[0] + freqData[1] + freqData[2]) / 3;
    const primaryRgb = hexToRgbArray(theme.primary);
    if (bass > 220 && Math.random() > 0.6 && pulses.length < 5) {
        pulses.push({ radius: H*0.1, alpha: 1, x: W/2, y: H/2 });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.radius += 3;
        p.alpha -= 0.02;
        if(p.alpha <= 0) { pulses.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${primaryRgb.join(',')}, ${p.alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }
};

const drawParticles = (ctx: CanvasRenderingContext2D, W: number, H: number, freqData: Uint8Array, theme: VisualizerProps['themeColors'], particles: Particle[]) => {
    const treble = freqData.slice(freqData.length/2).reduce((a,b) => a+b, 0) / (freqData.length/2);
    if (treble > 120 && Math.random() > 0.5 && particles.length < 100) {
        for(let i=0; i<2; i++) {
            const colors = [theme.primary, theme.secondary, theme.accent];
            particles.push({
                x: Math.random() * W, y: Math.random() * H,
                radius: Math.random() * 2 + 1, alpha: 1,
                vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }
     for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if(p.alpha <= 0) { particles.splice(i, 1); continue; }
        
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
};

export default Visualizer;