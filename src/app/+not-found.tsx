import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '../components/Button';
import { EmptyState } from '../components/primitives';
import { spacing } from '../theme/tokens';
import { makeStyles } from '../theme/ThemeProvider';

export default function NotFoundScreen() {
  const styles = useStyles();
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

const useStyles = makeStyles((colors, tones) => ({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  actions: { paddingHorizontal: spacing.huge, marginTop: spacing.lg },
}));
