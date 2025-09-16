import { useState, useEffect, useMemo, useCallback } from 'react';
import { THEME_PRESETS } from '../constants';
import { type DiarizationSettings, type StatCardKey, type VisualizerBackground } from '../types';

const getInitialBoolean = (key: string, defaultValue: boolean): boolean => {
  try {
      const saved = localStorage.getItem(key);
      return saved !== null ? saved === 'true' : defaultValue;
  } catch {
      return defaultValue;
  }
};

const getInitialNumber = (key: string, defaultValue: number): number => {
    try {
        const saved = localStorage.getItem(key);
        const parsed = saved !== null ? parseInt(saved, 10) : defaultValue;
        return isNaN(parsed) ? defaultValue : parsed;
    } catch {
        return defaultValue;
    }
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
    
    const [viewModeOverride, _setViewModeOverride] = useState<'desktop' | 'mobile' | null>(() => localStorage.getItem('defscribe-viewModeOverride') as 'desktop' | 'mobile' | null);

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
        if (themeId === 8) { // 8 is now the custom theme ID
            return customThemeColors;
        }
        return THEME_PRESETS[themeId];
    }, [themeId, customThemeColors]);
    
    const getInitialPanelLayout = () => ({
        leftPanelWidth: getInitialNumber('defscribe-leftPanelWidth', 350),
        rightPanelWidth: getInitialNumber('defscribe-rightPanelWidth', 440),
        isLeftPanelCollapsed: getInitialBoolean('defscribe-isLeftPanelCollapsed', false),
        isRightPanelCollapsed: getInitialBoolean('defscribe-isRightPanelCollapsed', false),
    });

    const [panelLayout, setPanelLayout] = useState(getInitialPanelLayout);

    useEffect(() => {
        try {
            localStorage.setItem('defscribe-leftPanelWidth', String(panelLayout.leftPanelWidth));
            localStorage.setItem('defscribe-rightPanelWidth', String(panelLayout.rightPanelWidth));
            localStorage.setItem('defscribe-isLeftPanelCollapsed', String(panelLayout.isLeftPanelCollapsed));
            localStorage.setItem('defscribe-isRightPanelCollapsed', String(panelLayout.isRightPanelCollapsed));
        } catch {}
    }, [panelLayout]);

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
    const [isRecordingEnabled, _setIsRecordingEnabled] = useState(() => getInitialBoolean('defscribe-isRecordingEnabled', true));
    const [visualizerBackground, _setVisualizerBackground] = useState<VisualizerBackground>(() => (localStorage.getItem('defscribe-visualizerBackground') as VisualizerBackground) || 'starfield');

    const setVisualizerBackground = (bg: VisualizerBackground) => {
        _setVisualizerBackground(bg);
        localStorage.setItem('defscribe-visualizerBackground', bg);
    };

    const setIsRecordingEnabled = (enabled: boolean) => {
        _setIsRecordingEnabled(enabled);
        try {
            localStorage.setItem('defscribe-isRecordingEnabled', String(enabled));
        } catch {}
    };

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
        isRecordingEnabled,
        setIsRecordingEnabled,
        transcriptTextSize, 
        setTranscriptTextSize,
        statCardOrder,
        setStatCardOrder,
        viewModeOverride,
        setViewModeOverride,
        visualizerBackground,
        setVisualizerBackground,
        panelLayout,
        setPanelLayout,
    };
};

export default useAppSettings;