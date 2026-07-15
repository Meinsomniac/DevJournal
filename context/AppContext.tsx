import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ColorScheme } from '@/constants/Colors';
import { getSetting, setSetting } from '@/services/db';

type ThemeMode = 'system' | 'light' | 'dark';
export type ListMode = 'flat' | 'card' | 'compact';

interface SettingsState {
  themeMode: ThemeMode;
  listMode: ListMode;
  autoMarkRead: boolean;
  notifyBreaking: boolean;
}

interface AppContextValue {
  colors: ColorScheme;
  isDark: boolean;
  themeMode: ThemeMode;
  listMode: ListMode;
  autoMarkRead: boolean;
  notifyBreaking: boolean;
  dataVersion: number;
  setThemeMode: (mode: ThemeMode) => void;
  setListMode: (mode: ListMode) => void;
  setAutoMarkRead: (value: boolean) => void;
  setNotifyBreaking: (value: boolean) => void;
  bumpDataVersion: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_SETTINGS: SettingsState = {
  themeMode: 'system',
  listMode: 'flat',
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
        const [themeMode, listModeRaw, legacyCompact, autoMarkRead, notifyBreaking] = await Promise.all([
          getSetting<ThemeMode>('themeMode', 'system'),
          getSetting<ListMode | null>('listMode', null),
          getSetting<boolean>('compactMode', false),
          getSetting<boolean>('autoMarkRead', true),
          getSetting<boolean>('notifyBreaking', true),
        ]);
        // Migrate the old boolean "compact mode": true -> 'compact', otherwise
        // fall back to the new default 'flat'.
        const listMode = listModeRaw ?? (legacyCompact ? 'compact' : 'flat');
        setSettings({ themeMode, listMode, autoMarkRead, notifyBreaking });
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
    listMode: settings.listMode,
    autoMarkRead: settings.autoMarkRead,
    notifyBreaking: settings.notifyBreaking,
    dataVersion,
    setThemeMode: (mode) => updateSetting('themeMode', mode),
    setListMode: (mode) => updateSetting('listMode', mode),
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
