import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/tokens';

/**
 * Safe-area insets with a floor.
 *
 * A device with no notch or home indicator reports 0, and a header pinned to
 * a real 0 sits against the bezel. The floor costs nothing where the real
 * inset is larger, which is every modern phone.
 */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: Math.max(insets.top, spacing.md),
    bottom: Math.max(insets.bottom, spacing.sm),
    left: insets.left,
    right: insets.right,
  };
}
