import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ColorScheme } from '@/constants/Colors';
import { getSetting, setSetting } from '@/services/db';

type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  themeMode: ThemeMode;
  compactMode: boolean;
  autoMarkRead: boolean;
  notifyBreaking: boolean;
}

interface AppContextValue {
  colors: ColorScheme;
  isDark: boolean;
  themeMode: ThemeMode;
  compactMode: boolean;
  autoMarkRead: boolean;
  notifyBreaking: boolean;
  dataVersion: number;
  setThemeMode: (mode: ThemeMode) => void;
  setCompactMode: (value: boolean) => void;
  setAutoMarkRead: (value: boolean) => void;
  setNotifyBreaking: (value: boolean) => void;
  bumpDataVersion: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_SETTINGS: SettingsState = {
  themeMode: 'system',
  compactMode: false,
  autoMarkRead: true,
  notifyBreaking: true,
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const bumpDataVersion = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [themeMode, compactMode, autoMarkRead, notifyBreaking] = await Promise.all([
          getSetting<ThemeMode>('themeMode', 'system'),
          getSetting<boolean>('compactMode', false),
          getSetting<boolean>('autoMarkRead', true),
          getSetting<boolean>('notifyBreaking', true),
        ]);
        setSettings({ themeMode, compactMode, autoMarkRead, notifyBreaking });
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const isDark = settings.themeMode === 'system'
    ? systemScheme === 'dark'
    : settings.themeMode === 'dark';

  const colors = (isDark ? Colors.dark : Colors.light) as ColorScheme;

  const updateSetting = useCallback(async <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await setSetting(key, value);
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
    }
  }, []);

  const value: AppContextValue = {
    colors,
    isDark,
    themeMode: settings.themeMode,
    compactMode: settings.compactMode,
    autoMarkRead: settings.autoMarkRead,
    notifyBreaking: settings.notifyBreaking,
    dataVersion,
    setThemeMode: (mode) => updateSetting('themeMode', mode),
    setCompactMode: (value) => updateSetting('compactMode', value),
    setAutoMarkRead: (value) => updateSetting('autoMarkRead', value),
    setNotifyBreaking: (value) => updateSetting('notifyBreaking', value),
    bumpDataVersion,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
