import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider } from '../lib/store';
import { colors } from '../theme/tokens';

export default function RootLayout() {
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
