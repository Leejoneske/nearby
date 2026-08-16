/**
 * Whether the intro has been seen.
 *
 * Storage can fail — a full disk, a locked keystore, a web build in private
 * mode. None of that is worth blocking the app for, so a failed read is
 * treated as "already seen": showing the intro to a returning user every
 * launch is far more annoying than skipping it once for a new one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nearby.introSeen.v1';

export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return true;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // Nothing useful to do: the intro simply shows again next launch.
  }
}

/** Only used by the "show the intro again" row in settings. */
export async function resetIntro(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Same reasoning as above.
  }
}
