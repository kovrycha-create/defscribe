import React, { useState, useEffect } from 'react';
import Tooltip from '../Tooltip';
import { THEME_PRESETS, SPOKEN_LANGUAGES, SPOKEN_LANGUAGES_REVERSE } from '../../constants';
import { type DiarizationSettings } from '../../types';
import BackgroundPenLogo from '../BackgroundPenLogo';
import CustomSelect from '../CustomSelect';
import ViewSwitcher from '../ViewSwitcher';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description?: string;
}

interface ControlPanelProps {
  isListening: boolean;
  isAnalyzing: boolean;
  isSummarizing: boolean;
  wpm: number;
  confidence: number;
  finalTranscript: string;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onGoImmersive: () => void;
  isImmersiveButtonGlowing: boolean;
  isStartButtonGlowing: boolean;
  themeId: number;
  setThemeId: (id: number) => void;
  customThemeColors: { primary: string; secondary: string; accent: string; };
  setCustomThemeColors: (colors: { primary: string; secondary: string; accent: string; }) => void;
  diarizationSettings: DiarizationSettings;
  setDiarizationSettings: (settings: DiarizationSettings) => void;
  translationLanguage: string;
  setTranslationLanguage: (lang: string) => void;
  spokenLanguage: string;
  setSpokenLanguage: (lang: string) => void;
  liveTranslationEnabled: boolean;
  setLiveTranslationEnabled: (enabled: boolean) => void;
  onExport: () => void;
  sessionActive: boolean;
  hasContent: boolean;
  shortcuts: Shortcut[];
  isMobileView: boolean;
  isTrueMobile: boolean;
  setViewModeOverride: (mode: 'desktop' | 'mobile' | null) => void;
  isSettingsCollapsed: boolean;
  setIsSettingsCollapsed: (collapsed: boolean) => void;
  isTourActive: boolean;
  onWwyd: (e: React.MouseEvent) => void;
  isWwydLoading: boolean;
}

const IconButton: React.FC<{
  icon: string;
  text: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  size?: 'normal' | 'large';
  "data-tour-id"?: string;
  textSizeClass?: string;
}> = ({ icon, text, onClick, className = '', disabled, size = 'normal', "data-tour-id": dataTourId, textSizeClass }) => {
  const isLarge = size === 'large';
  const heightClass = isLarge ? 'h-14' : 'h-10';
  const textClass = isLarge ? 'text-xl' : (textSizeClass || 'text-sm');
  const iconSizeClass = isLarge ? 'text-xl' : 'text-lg';
  const gapClass = isLarge ? 'gap-4' : 'gap-3';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent parent click handlers from intercepting and ensure disabled state is respected
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    try { onClick(); } catch (err) { console.error('IconButton onClick error', err); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`${heightClass} flex items-center justify-center ${textClass} font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg ${className}`}
      data-tour-id={dataTourId}
    >
      {isLarge ? (
        // Centered layout for large button
        <div className={`flex items-center justify-center ${gapClass}`}>
          <i className={`fas ${icon} ${iconSizeClass}`}></i>
          <span>{text}</span>
        </div>
      ) : (
        // Original layout for normal button
        <div className={`flex items-center justify-center w-full px-4 ${gapClass}`}>
          <i className={`fas ${icon} w-6 text-center`}></i>
          <span className="flex-1 text-left">{text}</span>
        </div>
      )}
    </button>
  );
};

const HotkeysTooltipContent: React.FC<{ shortcuts: Shortcut[] }> = ({ shortcuts }) => {
    const formatShortcut = (s: Shortcut) => {
        const parts = [];
        if (s.ctrl) parts.push('Ctrl');
        if (s.shift) parts.push('Shift');
        if (s.alt) parts.push('Alt');
        parts.push(s.key.trim() === '' ? 'Space' : s.key.toUpperCase());
        return parts.join(' + ');
    };

    return (
        <div className="p-2 text-left">
            <h4 className="font-bold text-base mb-2 text-white">Keyboard Shortcuts</h4>
            <ul className="space-y-1.5 text-xs">
                {shortcuts.map((s, i) => (
                    <li key={i} className="flex justify-between items-center gap-4">
                        <span className="text-slate-300">{s.description}</span>
                        <kbd className="px-2 py-1 font-sans text-xs font-semibold text-slate-200 bg-slate-700 border border-slate-600 rounded-md shadow-sm">
                            {formatShortcut(s)}
                        </kbd>
                    </li>
                ))}
            </ul>
        </div>
    );
};


const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const { isListening, isAnalyzing, isSummarizing, wpm, confidence, finalTranscript, onStart, onStop, onClear, onGoImmersive, isImmersiveButtonGlowing, isStartButtonGlowing,
  themeId, setThemeId, customThemeColors, setCustomThemeColors, diarizationSettings, setDiarizationSettings,
  translationLanguage, setTranslationLanguage, spokenLanguage, setSpokenLanguage, 
  liveTranslationEnabled, setLiveTranslationEnabled, isMobileView, isTrueMobile,
  onExport, sessionActive, hasContent, shortcuts, setViewModeOverride, isSettingsCollapsed, setIsSettingsCollapsed, isTourActive, onWwyd, isWwydLoading } = props;
  
  const [isCustomThemeOpen, setIsCustomThemeOpen] = useState(false);
  const [changedColors, setChangedColors] = useState<Set<string>>(new Set());
  const [isExportButtonFlashing, setIsExportButtonFlashing] = useState(false);

  const languageOptions = ["English", "Spanish", "French", "German", "Japanese", "Mandarin"];
  const spokenLanguageOptions = Object.keys(SPOKEN_LANGUAGES);
  const selectedSpokenLanguageName = SPOKEN_LANGUAGES_REVERSE[spokenLanguage] || 'English (US)';
  
  const handleStopClick = () => {
    onStop();
    setIsExportButtonFlashing(true);
    setTimeout(() => {
        setIsExportButtonFlashing(false);
    }, 500);
  };

  const handleClearWithConfirmation = () => {
    const confirmationMessage = "Are you sure you want to clear the entire session? This action is irreversible and all data will be permanently lost.";
    // Always show a confirmation dialog to ensure consistent behavior on all devices and prevent accidental data loss.
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(confirmationMessage)) onClear();
      } else {
        // Fallback: if confirm is not available (rare), just call onClear
        onClear();
      }
    } catch (err) {
      // If anything goes wrong showing confirm, fallback to clearing to avoid leaving stale state
      console.error('Confirmation failed, proceeding to clear:', err);
      onClear();
    }
  };

  const handleCustomThemeClick = () => {
    if (isCustomThemeOpen) {
      setIsCustomThemeOpen(false);
      return;
    }
    setChangedColors(new Set());
    setThemeId(8); // Custom theme ID
    setIsCustomThemeOpen(true);
  };

  const handleColorChange = (colorKey: 'primary' | 'secondary' | 'accent', value: string) => {
    setCustomThemeColors({ ...customThemeColors, [colorKey]: value });
    setChangedColors(prev => new Set(prev).add(colorKey));
  };

  useEffect(() => {
    if (isCustomThemeOpen && changedColors.size === 3) {
      const timer = setTimeout(() => {
        setIsCustomThemeOpen(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [changedColors, isCustomThemeOpen]);


  return (
    <div className="flex flex-col h-full cosmo-panel md:rounded-2xl p-2 md:p-4 gap-2 md:gap-4 overflow-y-auto overflow-x-hidden">
      <header className="flex items-stretch gap-3 pb-2 border-b border-[rgba(var(--color-primary-rgb),0.2)]">
        {/* Title Section */}
        <div 
          className="flex-1 flex flex-col items-center justify-center rounded-lg p-2 transition-all duration-500 overflow-hidden relative"
        >
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.15), rgba(var(--color-secondary-rgb), 0.15), rgba(var(--color-primary-rgb), 0.15))`,
              backgroundSize: '400% 400%',
              animation: 'subtle-shine 10s ease-in-out infinite',
              boxShadow: `inset 0 0 10px rgba(var(--color-primary-rgb), 0.2)`
            }}
          ></div>
          <div className="relative z-10 text-center">
              <h1 className="text-2xl font-russo-one tracking-wider text-white" style={{ textShadow: `0 0 10px rgba(var(--color-primary-rgb), 0.7)`}}>DefScribe</h1>
              <p className="text-xs text-slate-400">Advanced Dictation Assistant</p>
          </div>
        </div>

        {/* Signature Section */}
        <div className="flex items-center justify-center px-2">
          <a href="https://paypal.me/deffy" target="_blank" rel="noopener noreferrer" aria-label="Donate to the developer">
            <img 
              src="https://defscribe.app/deffy-sig.png" 
              alt="Deffy Signature, link to donate"
              className="h-12 w-auto cursor-pointer transition-transform duration-300 hover:scale-110 [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.2))_drop-shadow(0_0_12px_rgba(var(--color-primary-rgb),0.5))]"
            />
          </a>
        </div>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        <BackgroundPenLogo 
            isListening={isListening || isTourActive} 
            isSummarizing={isSummarizing || isAnalyzing}
            wpm={wpm} 
            confidence={confidence}
            finalTranscript={finalTranscript}
            sessionActive={sessionActive}
            isExpanded={!isSettingsCollapsed}
            isMobileView={isMobileView}
        />
      </div>

      <div className="space-y-2" data-tour-id="start-button">
        {isListening ? (
          <IconButton icon="fa-stop-circle" text="Stop Listening" onClick={handleStopClick} disabled={isTourActive} className="bg-red-500/80 text-white hover:bg-red-500/100 animate-[recording-glow_2s_ease-in-out_infinite] w-full" size="large" />
        ) : (
          <IconButton icon="fa-microphone-alt" text="Start Listening" onClick={onStart} disabled={isTourActive} className={`bg-green-500/80 text-white hover:bg-green-500/100 ${isStartButtonGlowing ? 'animate-start-button-glow' : ''} w-full`} size="large" />
        )}
      </div>

      <div className="pt-2">
        <div className="border-t border-[rgba(var(--color-primary-rgb),0.2)]"></div>
      </div>
      
      {/* Settings Section */}
      <div className="transition-all duration-500 ease-in-out overflow-hidden" style={{ maxHeight: isSettingsCollapsed ? '56px' : '850px' }}>
        <div className="py-1">
          <div className="p-1" data-tour-id="settings-toggle">
            <button 
              onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)} 
              className="w-full h-10 flex justify-center items-center rounded-lg text-white font-semibold transition-all duration-300 cosmo-button hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-[var(--color-primary)] hover:animate-[pulse-glow_2s_infinite]"
              style={{
                  background: `linear-gradient(90deg, rgba(var(--color-primary-rgb), 0.4), rgba(var(--color-secondary-rgb), 0.4))`,
                  '--color': 'rgba(var(--color-primary-rgb), 0.5)'
              } as React.CSSProperties}
              aria-expanded={!isSettingsCollapsed}
              aria-controls="settings-panel-content"
              aria-label={isSettingsCollapsed ? "Show settings" : "Hide settings"}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className={`transition-transform duration-500 ease-out ${!isSettingsCollapsed ? 'rotate-180' : ''}`}
              >
                  <path d="M7 10 L 17 10 L 12 15 Z" />
              </svg>
            </button>
          </div>
        </div>
        <div 
            id="settings-panel-content"
            className="space-y-4 pt-4 overflow-hidden"
            style={{
                background: 'radial-gradient(circle at 50% 0, rgba(var(--color-primary-rgb), 0.15) 0%, transparent 70%)',
                backgroundRepeat: 'no-repeat',
            }}
        >

          {/* Languages */}
          <div className="space-y-2" data-tour-id="language-select">
              <label className="text-sm font-medium text-slate-400">Spoken Language</label>
              <CustomSelect options={spokenLanguageOptions} value={selectedSpokenLanguageName} onChange={(name) => setSpokenLanguage(SPOKEN_LANGUAGES[name])} label="Select spoken language" />
          </div>

          <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Translation Language</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CustomSelect options={languageOptions} value={translationLanguage} onChange={setTranslationLanguage} label="Select translation language" />
                </div>
                <Tooltip content={liveTranslationEnabled ? "Live Translation On" : "Live Translation Off"}>
                    <button onClick={() => setLiveTranslationEnabled(!liveTranslationEnabled)} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cosmo-button ${liveTranslationEnabled ? 'text-[var(--color-primary)]' : ''}`}>
                        <i className="fas fa-satellite-dish"></i>
                    </button>
                </Tooltip>
              </div>
          </div>

          {/* Diarization */}
          {!isTrueMobile && (
            <div className="space-y-2" data-tour-id="diarization-toggle">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-400">Speaker Detection</label>
                <label className="styled-toggle-switch">
                  <input type="checkbox" checked={diarizationSettings.enabled} onChange={(e) => setDiarizationSettings({ ...diarizationSettings, enabled: e.target.checked })} />
                  <span className="styled-toggle-slider"></span>
                </label>
              </div>
              {diarizationSettings.enabled && (
                <div className="flex items-center gap-2 pl-2">
                  <label htmlFor="speaker-count" className="text-xs text-slate-400">Speakers:</label>
                  <input
                    id="speaker-count"
                    type="number"
                    min="1"
                    max="6"
                    value={diarizationSettings.expectedSpeakers}
                    onChange={(e) => setDiarizationSettings({ ...diarizationSettings, expectedSpeakers: parseInt(e.target.value, 10) })}
                    className="w-16 cosmo-input rounded-md p-1 text-center text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Theme Picker */}
          <div className="pb-2" data-tour-id="theme-picker">
            <label className="text-sm font-medium text-slate-400">Theme</label>
            <div className="flex justify-center gap-2 mt-2 p-1">
                {Object.entries(THEME_PRESETS).map(([id, theme]) => (
                    <Tooltip content={`Theme ${id}`} key={id}>
                        <button
                            onClick={() => { setThemeId(Number(id)); setIsCustomThemeOpen(false); }}
                            className={`w-8 h-8 rounded-full transition-transform duration-200 hover:scale-110 ${themeId === Number(id) ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white' : ''}`}
                            style={{ background: `linear-gradient(45deg, ${theme.primary}, ${theme.secondary})` }}
                        />
                    </Tooltip>
                ))}
                <Tooltip content="Custom Theme">
                    <button onClick={handleCustomThemeClick} className={`w-8 h-8 rounded-full transition-transform duration-200 hover:scale-110 flex items-center justify-center ${themeId === 8 ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white' : ''}`} style={{ background: 'conic-gradient(from 180deg at 50% 50%, #FF6B6B 0deg, #FFD166 60deg, #06D6A0 120deg, #118AB2 180deg, #073B4C 240deg, #7A28CB 300deg, #FF6B6B 360deg)' }}>
                        <i className="fas fa-palette text-white text-xs"></i>
                    </button>
                </Tooltip>
            </div>
            {isCustomThemeOpen && themeId === 8 && (
              <div className="mt-3 p-3 bg-slate-900/50 rounded-lg animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-start justify-around text-center">
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="color"
                      value={customThemeColors.primary}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="w-8 h-8 p-0 border-none rounded-md bg-transparent cursor-pointer"
                      aria-label="Primary color"
                    />
                    <label className="text-xs">Primary</label>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="color"
                      value={customThemeColors.secondary}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="w-8 h-8 p-0 border-none rounded-md bg-transparent cursor-pointer"
                      aria-label="Secondary color"
                    />
                    <label className="text-xs">Secondary</label>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="color"
                      value={customThemeColors.accent}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="w-8 h-8 p-0 border-none rounded-md bg-transparent cursor-pointer"
                      aria-label="Accent color"
                    />
                    <label className="text-xs">Accent</label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="pt-4 mt-auto flex items-center gap-2">
        <IconButton
            icon="fa-file-export"
            text="Export & Share"
            onClick={onExport}
            disabled={isListening || !hasContent || isTourActive}
            className={`cosmo-button flex-1 ${isExportButtonFlashing ? 'animate-flash-effect' : ''}`}
            data-tour-id="export-button"
            textSizeClass="text-sm"
        />
        <IconButton
            icon="fa-trash-alt"
            text="Clear"
            onClick={handleClearWithConfirmation}
            disabled={isListening || !hasContent || isTourActive}
            className="bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 border border-red-500/30 flex-1"
            textSizeClass="text-lg"
        />
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-[rgba(var(--color-primary-rgb),0.2)]">
        {isTrueMobile ? <div /> : (
          <Tooltip content={<HotkeysTooltipContent shortcuts={shortcuts} />} contentClassName="w-72">
              <button className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-2">
                  <i className="fas fa-keyboard"></i>
                  <span>Shortcuts</span>
              </button>
          </Tooltip>
        )}
        <div className="flex items-center gap-2">
            {!isTrueMobile && (
              <ViewSwitcher isMobileView={isMobileView} setViewModeOverride={setViewModeOverride} />
            )}
            <Tooltip content={<div className="text-center p-1"><div>What Would Ymzo Do?</div><div className="text-xs text-slate-400 mt-1">Alt+Click for walltalk<br/>Ctrl+Click for time</div></div>} contentClassName="w-max">
              <button onClick={onWwyd} disabled={isWwydLoading || isTourActive} className="h-8 w-8 cosmo-button rounded-full flex items-center justify-center text-lg text-amber-300 disabled:opacity-50 disabled:cursor-wait">
                {isWwydLoading ? <i className="fas fa-spinner fa-spin text-sm"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
              </button>
            </Tooltip>
            <Tooltip content="Go Immersive">
              <button data-tour-id="immersive-button" onClick={onGoImmersive} className={`h-8 w-8 cosmo-button rounded-full flex items-center justify-center text-lg ${isImmersiveButtonGlowing ? 'animate-[gold-pulse_2s_ease-in-out_infinite]' : ''}`}>
                  <i className="fas fa-meteor"></i>
              </button>
            </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;