/**
 * First-run intro.
 *
 * Three slides, skippable from the first frame. Each one names something the
 * app actually does rather than selling a feeling, because the fastest way to
 * lose somebody on slide one is to spend it on adjectives.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '../components/Button';
import { markIntroSeen } from '../lib/firstRun';
import { useScreenInsets } from '../lib/insets';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Slide = {
  icon: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'search',
    title: 'Everything around you, in one place',
    body: 'Restaurants, salons, garages, plumbers. Search by name or pick a category and see what is actually near you.',
  },
  {
    icon: 'time',
    title: 'Know it is open before you go',
    body: 'Opening hours come from the owners themselves, so "open now" means open at this minute — not usually, not probably.',
  },
  {
    icon: 'storefront',
    title: 'Own a business? List it free',
    body: 'Claim your listing, keep the details right, reply to reviews, and see how many people are looking for you.',
  },
];

export default function IntroScreen() {
  const router = useRouter();
  const insets = useScreenInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(Dimensions.get('window').width);

  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await markIntroSeen();
    router.replace('/(tabs)');
  };

  const next = () => {
    if (last) {
      void finish();
      return;
    }
    const target = index + 1;
    setIndex(target);
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    if (page !== index) setIndex(page);
  };

  return (
    <View
      style={styles.screen}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={finish}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Skip the introduction"
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <View style={styles.art}>
              <View style={styles.blobBack} />
              <View style={styles.blobFront} />
              <View style={styles.iconWrap}>
                <Ionicons name={slide.icon as never} size={54} color={colors.textOnAccent} />
              </View>
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View
          style={styles.dots}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}
        >
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Button label={last ? 'Get started' : 'Next'} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  skip: { ...typography.bodyStrong, color: colors.textSecondary, padding: spacing.sm },

  pager: { flex: 1 },
  slide: {
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },

  art: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  blobBack: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentSoft,
  },
  blobFront: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 62,
    backgroundColor: colors.surfaceWarm,
    transform: [{ rotate: '18deg' }],
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: radii.xxl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 340,
  },

  bottom: {
    paddingHorizontal: spacing.screen,
    gap: spacing.xxl,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: { width: 22, backgroundColor: colors.accent },
});
