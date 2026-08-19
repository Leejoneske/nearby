/**
 * The last thing between a thrown error and a white screen.
 *
 * React unmounts the whole tree when a render throws, so without this the app
 * becomes a blank rectangle with no way back and nothing recorded anywhere.
 * Here it becomes a sentence, a way out, and a row an admin can read.
 */
import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { reportError } from '../lib/errorReporting';
import { colors, spacing, typography } from '../theme/tokens';
import { Button } from './Button';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError('app', error, { boundary: true });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          That is on us, and we have been told about it. Try again, and if it keeps
          happening, closing the app and reopening it usually clears it.
        </Text>
        <View style={styles.action}>
          <Button label="Try again" onPress={() => this.setState({ failed: false })} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.huge,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.md },
});
