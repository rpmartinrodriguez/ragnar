import React, { createContext, useContext, useEffect, useState } from 'react';
import { APPEARANCE_KEY, loadAppearance, normalizeAppearance, resolveAppearance } from '../utils/appearance';

const AppearanceContext = createContext(null);
const mediaQuery = '(prefers-color-scheme: dark)';

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(mediaQuery).matches;
}

export function AppearanceProvider({ children }) {
  const [mode, setModeState] = useState(() =>
    loadAppearance(typeof window === 'undefined' ? null : window.localStorage));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const resolved = resolveAppearance(mode, systemDark);

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(mediaQuery);
    const handleChange = event => setSystemDark(event.matches);
    setSystemDark(query.matches);
    if (query.addEventListener) query.addEventListener('change', handleChange);
    else query.addListener?.(handleChange);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', handleChange);
      else query.removeListener?.(handleChange);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ragnarTheme = resolved;
    document.documentElement.dataset.ragnarAppearance = mode;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'light' ? '#f6f5ef' : '#101012');
  }, [mode, resolved]);

  const setMode = nextMode => {
    const normalized = normalizeAppearance(nextMode);
    setModeState(normalized);
    try { window.localStorage.setItem(APPEARANCE_KEY, normalized); }
    catch { /* En navegación privada se usa el ajuste durante la sesión. */ }
  };

  return (
    <AppearanceContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance requiere AppearanceProvider');
  return context;
}
