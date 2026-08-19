/**
 * Which palette is in force, and how a screen gets at it.
 *
 * Three states, not two. "System" is the default and is what most people
 * expect: the app follows the phone, including when the phone switches at
 * dusk. The other two are an explicit override, kept on the device.
 *
 * The shape here is what makes the refactor cheap. `makeStyles` builds one
 * stylesheet per palette, once, at module load — so a theme switch is
 * choosing between two objects that already exist rather than rebuilding
 * styles on every render. `StyleSheet.create` still runs exactly as before.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import {
  dark,
  darkTones,
  light,
  lightTones,
  type Palette,
  type Tones,
} from './palettes';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

const KEY = 'nearby.theme.v1';

type ThemeValue = {
  /** What is actually being drawn. */
  scheme: Scheme;
  colors: Palette;
  tones: Tones;
  /** What the person chose. `system` means "whatever the phone says". */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const FALLBACK: ThemeValue = {
  scheme: 'light',
  colors: light,
  tones: lightTones,
  preference: 'system',
  setPreference: () => {},
};

const ThemeContext = createContext<ThemeValue>(FALLBACK);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setStored] = useState<ThemePreference>('system');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (alive && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setStored(saved);
        }
      } catch {
        // A preference we cannot read is the system one, which is the default
        // anyway. Never a reason to fail a launch.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStored(next);
    void AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? dark : light,
      tones: scheme === 'dark' ? darkTones : lightTones,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Turns a style description into a hook.
 *
 *     const useStyles = makeStyles((colors, tones) => ({
 *       card: { backgroundColor: colors.surface },
 *     }));
 *
 * The callback parameters are named `colors` and `tones` on purpose: every
 * rule inside a stylesheet that used the imported tokens keeps reading
 * exactly as it did, and only the wrapper around it changed.
 *
 * Both palettes are built once, at module load, so a theme switch picks
 * between two finished stylesheets. Nothing is recomputed while scrolling.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  build: (colors: Palette, tones: Tones) => T & StyleSheet.NamedStyles<T>,
): () => T {
  const sheets: Record<Scheme, T> = {
    light: StyleSheet.create(build(light, lightTones)),
    dark: StyleSheet.create(build(dark, darkTones)),
  };

  return function useStyles(): T {
    return sheets[useTheme().scheme];
  };
}
