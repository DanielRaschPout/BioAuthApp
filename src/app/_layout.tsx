import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout — the one layout every route in the app shares.
 *
 * It renders a `Stack`, Expo Router's full-screen-push navigator, with two
 * screens:
 *   - `(tabs)`  — the tab group (Home / Explore / Vault), which mounts its
 *                 own persistent bottom tab bar (see `(tabs)/_layout.tsx`).
 *   - `liveness` — presented as a full-screen modal *outside* the tab group,
 *                 so its camera view isn't covered by that tab bar.
 *
 * Previously this file rendered `<AppTabs />` directly, which made the tab
 * bar the root of literally every screen — including `liveness`, whose
 * "Verify Liveness" button sits at the very bottom of the screen and was
 * being visually and *functionally* covered by the tab bar: taps there hit
 * the native tab bar (which was on top in the view hierarchy) instead of
 * the button underneath it.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="liveness" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </ThemeProvider>
  );
}
