
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { THEME_PRESETS } from '../constants';
import { type DiarizationSettings, type StatCardKey } from '../types';

const useResizablePanels = (defaultLeftWidth: number, defaultRightWidth: number, minWidth: number, maxWidth: number) => {
  const getInitialWidth = (key: string, defaultValue: number): number => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return defaultValue;
      const num = parseInt(saved, 10);
      return isNaN(num) ? defaultValue : Math.max(minWidth, Math.min(maxWidth, num));
    } catch {
      return defaultValue;
    }
  };

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => getInitialWidth('defscribe-leftPanelWidth', defaultLeftWidth));
  const [rightPanelWidth, setRightPanelWidth] = useState(() => getInitialWidth('defscribe-rightPanelWidth', defaultRightWidth));
  const activeResizer = useRef<"left" | "right" | null>(null);

  const handleMouseDown = useCallback((resizer: 'left' | 'right') => {
    activeResizer.current = resizer;
    document.body.classList.add('resizing');
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeResizer.current) return;
      if (activeResizer.current === 'left') {
        const newWidth = e.clientX;
        const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        setLeftPanelWidth(constrainedWidth);
      } else if (activeResizer.current === 'right') {
        const newWidth = window.innerWidth - e.clientX;
        const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        setRightPanelWidth(constrainedWidth);
      }
    };
    const handleMouseUp = () => {
      activeResizer.current = null;
      document.body.classList.remove('resizing');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [minWidth, maxWidth]);
  
  useEffect(() => { try { localStorage.setItem('defscribe-leftPanelWidth', String(leftPanelWidth)); } catch {} }, [leftPanelWidth]);
  useEffect(() => { try { localStorage.setItem('defscribe-rightPanelWidth', String(rightPanelWidth)); } catch {} }, [rightPanelWidth]);
  
  const resetLayout = () => {
    setLeftPanelWidth(defaultLeftWidth);
    setRightPanelWidth(defaultRightWidth);
    try {
      localStorage.removeItem('defscribe-leftPanelWidth');
      localStorage.removeItem('defscribe-rightPanelWidth');
    } catch {}
  }

  return { leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout };
};

const useAppSettings = () => {
    const getInitialCustomTheme = () => {
        try {
            const saved = localStorage.getItem('defscribe-customTheme');
            return saved ? JSON.parse(saved) : { primary: '#1E90FF', secondary: '#FF69B4', accent: '#FFD700' };
        } catch {
            return { primary: '#1E90FF', secondary: '#FF69B4', accent: '#FFD700' };
        }
    };
    
    const [userApiKey, _setUserApiKey] = useState<string | null>(() => localStorage.getItem('defscribe-userApiKey'));
    const [viewModeOverride, _setViewModeOverride] = useState<'desktop' | 'mobile' | null>(() => localStorage.getItem('defscribe-viewModeOverride') as 'desktop' | 'mobile' | null);

    const setUserApiKey = (key: string | null) => {
        _setUserApiKey(key);
        if (key) {
            localStorage.setItem('defscribe-userApiKey', key);
        } else {
            localStorage.removeItem('defscribe-userApiKey');
        }
    };

    const setViewModeOverride = (mode: 'desktop' | 'mobile' | null) => {
        _setViewModeOverride(mode);
        if (mode) {
            localStorage.setItem('defscribe-viewModeOverride', mode);
        } else {
            localStorage.removeItem('defscribe-viewModeOverride');
        }
    };

    const [themeId, _setThemeId] = useState(() => parseInt(localStorage.getItem('defscribe-themeId') || '1', 10));
    const [customThemeColors, _setCustomThemeColors] = useState(getInitialCustomTheme);
    
    const setThemeId = (id: number) => {
        _setThemeId(id);
        localStorage.setItem('defscribe-themeId', String(id));
    };

    const setCustomThemeColors = (colors: { primary: string; secondary: string; accent: string; }) => {
        _setCustomThemeColors(colors);
        localStorage.setItem('defscribe-customTheme', JSON.stringify(colors));
    };

    const themeColors = useMemo(() => {
        if (themeId === 5) { // 5 is now the custom theme ID
            return customThemeColors;
        }
        return THEME_PRESETS[themeId];
    }, [themeId, customThemeColors]);

    const [diarizationSettings, setDiarizationSettings] = useState<DiarizationSettings>({
        enabled: false,
        mode: "local",
        expectedSpeakers: 2,
    });
    const [showTimestamps, setShowTimestamps] = useState(true);
    const [translationLanguage, setTranslationLanguage] = useState('Spanish');
    const [spokenLanguage, _setSpokenLanguage] = useState('en-US');
    const [liveTranslationEnabled, setLiveTranslationEnabled] = useState(false);
    const [transcriptTextSize, setTranscriptTextSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

    const { leftPanelWidth, rightPanelWidth, handleMouseDown, resetLayout } = useResizablePanels(320, 400, 280, 500);

    const setSpokenLanguage = useCallback((lang: string) => {
        _setSpokenLanguage(lang);
    }, []);
    
    // --- Stat Card Order ---
    const DEFAULT_STAT_ORDER: StatCardKey[] = [
        'wpm', 'duration', 'speakingRateLabel', 'words', 'avgSentenceLength', 
        'vocabularyRichness', 'questionCount', 'fillers', 'pauses'
    ];
    
    const getInitialStatOrder = (): StatCardKey[] => {
        try {
            const saved = localStorage.getItem('defscribe-statOrder');
            if (saved) {
                const parsed = JSON.parse(saved);
                const savedSet = new Set(parsed);
                const merged = [...parsed];
                DEFAULT_STAT_ORDER.forEach(key => {
                    if (!savedSet.has(key)) merged.push(key);
                });
                const validKeys = new Set(DEFAULT_STAT_ORDER);
                return merged.filter(key => validKeys.has(key));
            }
        } catch { /* ignore error */ }
        return DEFAULT_STAT_ORDER;
    };

    const [statCardOrder, _setStatCardOrder] = useState<StatCardKey[]>(getInitialStatOrder);

    const setStatCardOrder = (newOrder: StatCardKey[]) => {
        _setStatCardOrder(newOrder);
        try {
            localStorage.setItem('defscribe-statOrder', JSON.stringify(newOrder));
        } catch {}
    };


    useEffect(() => {
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
        };
        const root = document.documentElement;
        root.style.setProperty('--color-primary', themeColors.primary);
        root.style.setProperty('--color-secondary', themeColors.secondary);
        root.style.setProperty('--color-accent', themeColors.accent);
        const primaryRgb = hexToRgb(themeColors.primary);
        const secondaryRgb = hexToRgb(themeColors.secondary);
        const accentRgb = hexToRgb(themeColors.accent);
        if (primaryRgb) root.style.setProperty('--color-primary-rgb', primaryRgb);
        if (secondaryRgb) root.style.setProperty('--color-secondary-rgb', secondaryRgb);
        if (accentRgb) root.style.setProperty('--color-accent-rgb', accentRgb);
    }, [themeColors]);

    return {
        themeId,
        themeColors,
        setThemeId,
        customThemeColors,
        setCustomThemeColors,
        diarizationSettings,
        setDiarizationSettings,
        showTimestamps,
        setShowTimestamps,
        translationLanguage,
        setTranslationLanguage,
        spokenLanguage,
        setSpokenLanguage,
        liveTranslationEnabled,
        setLiveTranslationEnabled,
        leftPanelWidth,
        rightPanelWidth,
        handleMouseDown,
        resetLayout,
        transcriptTextSize, 
        setTranscriptTextSize,
        userApiKey,
        setUserApiKey,
        statCardOrder,
        setStatCardOrder,
        viewModeOverride,
        setViewModeOverride,
    };
};

export default useAppSettings;
