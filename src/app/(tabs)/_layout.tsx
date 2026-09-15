/**
 * src/app/(tabs)/_layout.tsx — Tab group layout
 *
 * A parenthesized folder name, `(tabs)`, is an Expo Router *group*: it
 * organizes routes without adding a `/tabs` segment to the URL, so
 * `(tabs)/index.tsx` is still just `/`. Every screen nested in this folder
 * shares this layout, which mounts the persistent bottom tab bar.
 *
 * Keeping this group separate from the root layout is what lets `/liveness`
 * (declared as a sibling of `(tabs)` in the root Stack) render full-screen,
 * with no tab bar floating on top of it.
 */

import AppTabs from '@/components/app-tabs';

export default function TabsLayout() {
  return <AppTabs />;
}
