import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { EmptyState } from '../components/primitives';
import { colors, spacing } from '../theme/tokens';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <EmptyState
        icon="compass-outline"
        title="This page moved"
        body="We could not find what you were looking for. Let us get you back to the map."
      />
      <View style={styles.actions}>
        <Button label="Back to Nearby" onPress={() => router.replace('/(tabs)')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  actions: { paddingHorizontal: spacing.huge, marginTop: spacing.lg },
});
