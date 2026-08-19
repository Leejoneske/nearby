import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '../../components/primitives';
import { LEGAL } from '../../data/legal';
import { useScreenInsets } from '../../lib/insets';
import { spacing, typography } from '../../theme/tokens';
import { makeStyles, useTheme } from '../../theme/ThemeProvider';

export default function LegalScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const { doc } = useLocalSearchParams<{ doc: string }>();

  const content = doc === 'privacy' || doc === 'terms' ? LEGAL[doc] : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {content?.title ?? 'Not found'}
        </Text>
        <View style={styles.iconButton} />
      </View>

      {!content ? (
        <View style={styles.centered}>
          <EmptyState
            icon="document-text-outline"
            title="Page not found"
            body="We could not find that document."
          />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.screen,
            paddingBottom: insets.bottom + spacing.huge,
          }}
        >
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.updated}>Last updated {content.updated}</Text>
          <Text style={styles.intro}>{content.intro}</Text>

          {content.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              {section.paragraphs.map((paragraph, index) => (
                <Text key={index} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  screen: { flex: 1, backgroundColor: colors.canvas },
  centered: { flex: 1, justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  title: { ...typography.display, color: colors.textPrimary, marginTop: spacing.md },
  updated: { ...typography.meta, color: colors.textTertiary, marginTop: spacing.sm },
  intro: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },

  section: { marginTop: spacing.xxl, gap: spacing.md },
  heading: { ...typography.sectionTitle, color: colors.textPrimary },
  paragraph: { ...typography.body, color: colors.textSecondary },
}));
