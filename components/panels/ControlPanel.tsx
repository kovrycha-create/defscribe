

import React, { useState } from 'react';
import Tooltip from '../Tooltip';
import { THEME_PRESETS, SPOKEN_LANGUAGES, SPOKEN_LANGUAGES_REVERSE } from '../../constants';
import { type DiarizationSettings } from '../../types';
import BackgroundPenLogo from '../BackgroundPenLogo';
import CustomSelect from '../CustomSelect';

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
  onResetLayout: () => void;
  onExport: () => void;
  sessionActive: boolean;
  shortcuts: Shortcut[];
}

const IconButton: React.FC<{ icon: string; text: string; onClick: () => void; className?: string; disabled?: boolean; }> = ({ icon, text, onClick, className = '', disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-11 w-full flex items-center justify-center text-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg ${className}`}
    >
      <div className="flex items-center justify-center w-full px-4 gap-3">
        <i className={`fas ${icon} w-6 text-center`}></i>
        <span className="flex-1 text-left">{text}</span>
      </div>
    </button>
);

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
  liveTranslationEnabled, setLiveTranslationEnabled,
  onResetLayout, onExport, sessionActive, shortcuts } = props;
  
  const [isCustomThemeOpen, setIsCustomThemeOpen] = useState(false);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);
  const [isExportButtonFlashing, setIsExportButtonFlashing] = useState(false);
  const [isSpokenLanguageSelectOpen, setSpokenLanguageSelectOpen] = useState(false);
  const [isTranslationLanguageSelectOpen, setTranslationLanguageSelectOpen] = useState(false);

  const isAnySelectOpen = isSpokenLanguageSelectOpen || isTranslationLanguageSelectOpen;

  const languageOptions = ["Spanish", "French", "German", "Japanese", "Mandarin"];
  const spokenLanguageOptions = Object.keys(SPOKEN_LANGUAGES);
  const selectedSpokenLanguageName = SPOKEN_LANGUAGES_REVERSE[spokenLanguage] || 'English (US)';
  
  const handleStopClick = () => {
    onStop();
    setIsExportButtonFlashing(true);
    setTimeout(() => {
        setIsExportButtonFlashing(false);
    }, 500);
  };

  return (
    <div className={`flex flex-col h-full cosmo-panel md:rounded-2xl p-2 md:p-4 gap-2 md:gap-4 ${isAnySelectOpen ? 'overflow-visible' : 'overflow-y-auto'}`}>
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
              <h1 className="text-2xl font-russo-one tracking-wider text-white" style={{ textShadow: `0 0 10px rgba(var(--color-primary-rgb), 0.7)`}}>DefScribe AI</h1>
              <p className="text-xs text-slate-400">Advanced Dictation Assistant</p>
          </div>
        </div>

        {/* Signature Section */}
        <div className="flex items-center justify-center px-2">
          <a href="https://paypal.me/deffy" target="_blank" rel="noopener noreferrer" aria-label="Donate to the developer">
            <img 
              src="https://defscribe.app/deffy-sig.png" 
              alt="Deffy Signature, link to donate"
              className="h-12 w-auto cursor-pointer transition-transform duration-300 hover:scale-110 [filter:drop-shadow(0_0_4px_rgba(255,215,0,0.6))] hover:animate-[gold-pulse_3s_ease-in-out_infinite]"
            />
          </a>
        </div>
      </header>

      <div className="space-y-2 md:space-y-3">
        {!isListening ? (
          <IconButton icon="fa-microphone" text="Start Listening" onClick={onStart} className={`bg-green-600/80 hover:bg-green-600/100 shadow-lg ${isStartButtonGlowing ? 'animate-start-button-glow' : ''}`} />
        ) : (
          <IconButton icon="fa-stop-circle" text="Stop Listening" onClick={handleStopClick} className="bg-red-600/80 hover:bg-red-600/100 shadow-lg animate-recording-glow" />
        )}
        <IconButton icon="fa-file-export" text="Export Transcript" onClick={onExport} disabled={isListening} className={`control-button ${isExportButtonFlashing ? 'animate-flash-effect' : ''}`} />
        <IconButton icon="fa-trash-alt" text="Clear Session" onClick={onClear} disabled={isListening} className="control-button" />
        <IconButton
            icon="fa-rocket"
            text="Immersive Mode"
            onClick={onGoImmersive}
            className={`control-button ${isImmersiveButtonGlowing ? 'animate-cosmic-glow' : ''}`}
        />
      </div>
      
      <div className="flex-1 flex items-center justify-center transition-all duration-500 ease-in-out">
        <BackgroundPenLogo 
          isListening={isListening} 
          isSummarizing={isSummarizing || isAnalyzing} 
          wpm={wpm}
          confidence={confidence} 
          finalTranscript={finalTranscript}
          sessionActive={sessionActive}
          isExpanded={isSettingsCollapsed}
        />
      </div>

      <div className="pt-4 border-t border-[rgba(var(--color-primary-rgb),0.2)] bg-[rgba(var(--color-primary-rgb),0.1)] rounded-lg">
        <div 
          className="px-4 pb-2 text-sm font-semibold text-slate-300 uppercase tracking-wider flex justify-between items-center"
        >
          <div
            className="flex-1 cursor-pointer flex items-center gap-2"
            onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
            aria-expanded={!isSettingsCollapsed}
            aria-controls="settings-panel"
          >
            <span>Settings</span>
          </div>
           <div className="flex items-center gap-3">
            <Tooltip
                content={<HotkeysTooltipContent shortcuts={shortcuts} />}
                contentClassName="w-72 whitespace-normal"
            >
                <i className="fas fa-keyboard text-slate-400 hover:text-white cursor-help"></i>
            </Tooltip>
            <i 
                className={`fas fa-chevron-down transition-transform duration-300 cursor-pointer ${isSettingsCollapsed ? 'rotate-180' : ''}`}
                onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
            ></i>
          </div>
        </div>
        <div 
          id="settings-panel"
          className={`transition-all duration-500 ease-in-out ${isAnySelectOpen ? 'overflow-visible' : 'overflow-hidden'} ${isSettingsCollapsed ? 'max-h-0' : 'max-h-[1000px]'}`}
        >
          <div className="space-y-3 md:space-y-4 px-4 pb-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Theme</label>
              <div className="grid grid-cols-5 gap-2">
                  {Object.entries(THEME_PRESETS).map(([idStr, theme]) => (
                      <Tooltip content={`Theme ${idStr}`} key={idStr}>
                          <button
                              onClick={() => { setThemeId(Number(idStr)); setIsCustomThemeOpen(false); }}
                              className={`h-8 w-full rounded-lg transition-all duration-200 ${Number(idStr) === themeId ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-deep)] ring-white' : ''}`}
                              style={{ background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary}, ${theme.accent})` }}
                              aria-label={`Select Theme ${idStr}`}
                          />
                      </Tooltip>
                  ))}
                   <Tooltip content="Custom Theme">
                      <button
                          onClick={() => { setThemeId(5); setIsCustomThemeOpen(prev => !prev); }}
                          className={`h-8 w-full rounded-lg transition-all duration-200 flex items-center justify-center ${5 === themeId ? 'ring-2 ring-offset-2 ring-offset-[var(--color-bg-deep)] ring-white' : ''}`}
                          style={{ background: `conic-gradient(from 180deg at 50% 50%, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)` }}
                          aria-label="Select Custom Theme"
                      >
                          <i className="fas fa-palette text-white text-opacity-80"></i>
                      </button>
                  </Tooltip>
              </div>
               {themeId === 5 && isCustomThemeOpen && (
                  <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 space-y-2 animate-[fadeIn_0.3s_ease-out]">
                      <h4 className="text-xs font-semibold text-slate-300 mb-1">Custom Colors</h4>
                      <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-400">Primary</label>
                          <input type="color" value={customThemeColors.primary} onChange={e => setCustomThemeColors({...customThemeColors, primary: e.target.value})} className="w-8 h-8 bg-transparent border-none cursor-pointer" />
                      </div>
                      <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-400">Secondary</label>
                          <input type="color" value={customThemeColors.secondary} onChange={e => setCustomThemeColors({...customThemeColors, secondary: e.target.value})} className="w-8 h-8 bg-transparent border-none cursor-pointer" />
                      </div>
                      <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-400">Accent</label>
                          <input type="color" value={customThemeColors.accent} onChange={e => setCustomThemeColors({...customThemeColors, accent: e.target.value})} className="w-8 h-8 bg-transparent border-none cursor-pointer" />
                      </div>
                  </div>
              )}
            </div>
            
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <label htmlFor="diarization-toggle" className="text-sm font-medium text-slate-400">Speaker Detection</label>
                 <button onClick={() => setDiarizationSettings({ ...diarizationSettings, enabled: !diarizationSettings.enabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${diarizationSettings.enabled ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${diarizationSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`}/>
                 </button>
               </div>
               {diarizationSettings.enabled && (
                 <div className="flex items-center justify-between pl-2 animate-[fadeIn_0.3s_ease-out]">
                   <label htmlFor="speakers-count" className="text-sm font-medium text-slate-400">Speakers</label>
                   <input 
                     type="number"
                     id="speakers-count"
                     min="1" max="6"
                     value={diarizationSettings.expectedSpeakers}
                     onChange={e => setDiarizationSettings({...diarizationSettings, expectedSpeakers: parseInt(e.target.value, 10)})}
                     className="w-16 cosmo-input rounded-md text-center"
                   />
                 </div>
               )}
            </div>

            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-400">Spoken Language</label>
                <div className="w-40">
                  <CustomSelect
                    label="Spoken Language"
                    options={spokenLanguageOptions}
                    value={selectedSpokenLanguageName}
                    onChange={(name) => setSpokenLanguage(SPOKEN_LANGUAGES[name])}
                    onOpenChange={setSpokenLanguageSelectOpen}
                  />
                </div>
            </div>

            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-400">Translate to</label>
                <div className="w-36">
                  <CustomSelect
                    label="Translate to"
                    options={languageOptions}
                    value={translationLanguage}
                    onChange={setTranslationLanguage}
                    onOpenChange={setTranslationLanguageSelectOpen}
                  />
                </div>
            </div>
            <div className="flex items-center justify-between">
                <label htmlFor="live-translation-toggle" className="text-sm font-medium text-slate-400">Live Translation</label>
                <button onClick={() => setLiveTranslationEnabled(!liveTranslationEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${liveTranslationEnabled ? 'bg-[var(--color-primary)]' : 'bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${liveTranslationEnabled ? 'translate-x-6' : 'translate-x-1'}`}/>
                </button>
            </div>
            <button onClick={onResetLayout} className="control-button text-sm h-10 w-full rounded-lg flex items-center justify-center gap-2"><i className="fas fa-undo"></i> Reset Layout</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
