/**
 * Floating capsule tab bar.
 *
 * The shape comes from the fintech reference: a rounded grey bar lifted off
 * the bottom edge, with a white pill sliding under whichever tab is active.
 * It renders over the content, so screens pad their scroll views by
 * TAB_BAR_HEIGHT + TAB_BAR_INSET rather than reserving layout space.
 */
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, shadows, spacing, TAB_BAR_HEIGHT, TAB_BAR_INSET, typography } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';

/** Icon pairs keyed by route name — outline when idle, solid when active. */
const ICONS: Record<string, [string, string]> = {
  index: ['home-outline', 'home'],
  saved: ['heart-outline', 'heart'],
  map: ['map-outline', 'map'],
  recent: ['time-outline', 'time'],
  profile: ['person-outline', 'person'],
};

const LABELS: Record<string, string> = {
  index: 'Home',
  saved: 'Saved',
  map: 'Map',
  recent: 'Recent',
  profile: 'Profile',
};

/**
 * Expo Router vendors React Navigation rather than re-exporting it, so
 * `BottomTabBarProps` has no stable public import path. This describes the
 * part of the shape this component actually touches, which keeps the file off
 * a `build/` deep import that a patch release could move.
 */
type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    // The return type differs per event — only preventable events carry
    // `defaultPrevented` — so it is read back through a narrow cast below.
    emit: (event: {
      type: 'tabPress' | 'tabLongPress';
      target: string;
      canPreventDefault?: boolean;
    }) => unknown;
    navigate: (name: string) => void;
  };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // On a device with no home indicator the bar would otherwise sit on the edge.
  const bottom = Math.max(insets.bottom, TAB_BAR_INSET);

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const [idle, active] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const label = LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            }) as { defaultPrevented?: boolean };
            if (!focused && !event?.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Ionicons
                name={(focused ? active : idle) as never}
                size={21}
                color={focused ? colors.textPrimary : colors.textSecondary}
              />
              <Text
                style={[styles.label, focused && styles.labelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.tabBar,
    ...shadows.floating,
    // The capsule should hug its five items, not stretch to the screen edges.
    maxWidth: 420,
    ...Platform.select({ web: { width: '92%' }, default: { width: '92%' } }),
  },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT - (spacing.xs + 2) * 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    gap: 2,
  },
  itemActive: {
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.caption,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
}));
