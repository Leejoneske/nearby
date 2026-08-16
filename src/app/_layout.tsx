import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { hasSeenIntro } from '../lib/firstRun';
import { StoreProvider } from '../lib/store';
import { colors } from '../theme/tokens';

/*
 * Hold the splash screen until we know whether this is a first run. Without
 * it the tab bar paints for a frame and is then replaced by the intro, which
 * reads as a glitch on every cold start.
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or unsupported on this platform. Nothing to recover.
});

export default function RootLayout() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [needsIntro, setNeedsIntro] = useState(false);

  useEffect(() => {
    let alive = true;
    hasSeenIntro().then((seen) => {
      if (!alive) return;
      setNeedsIntro(!seen);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!checked) return;
    SplashScreen.hideAsync().catch(() => {});
    // Navigating in an effect rather than through initialRouteName, which
    // cannot depend on something asynchronous.
    if (needsIntro) router.replace('/intro');
  }, [checked, needsIntro, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="intro" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)/sign-in" />
            <Stack.Screen name="(auth)/verify" />
            <Stack.Screen name="search" />
            <Stack.Screen name="business/[id]" />
            <Stack.Screen name="reviews/[id]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="settings/profile" />
            <Stack.Screen name="legal/[doc]" />
            {/* Composing something is a task, not a place, so these slide up
                and dismiss rather than joining the back stack as pages. */}
            <Stack.Screen
              name="owner/claim"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="write-review/[id]"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
