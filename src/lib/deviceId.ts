/**
 * A stable, anonymous name for this device.
 *
 * The only thing that catches one person running ten accounts, because that
 * is one phone with many sign-ins. Everything else — an email address, a
 * name, a location — is free to invent as many times as you like.
 *
 * What it is deliberately not: an advertising id, a hardware serial, or
 * anything that follows somebody between apps. It is a random value this app
 * generates once and keeps, mixed with the coarse device model, so it
 * identifies "the phone Nearby was installed on" and nothing else. Clearing
 * the app's data resets it, which is a limitation and the right trade: the
 * alternative is collecting an identifier we have no business holding.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const KEY = 'nearby.deviceId.v1';

/** djb2 over the pieces, so what is stored and sent is opaque and short. */
export function hashDevice(seed: string, model: string, os: string): string {
  const input = `${seed}|${model}|${os}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function randomSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The fingerprint for this install, generating one on first use.
 *
 * Never throws: a device that cannot be identified is a device we score
 * without that signal, not a launch that fails.
 */
export async function deviceFingerprint(): Promise<string> {
  let seed: string | null = null;
  try {
    seed = await AsyncStorage.getItem(KEY);
    if (!seed) {
      seed = randomSeed();
      await AsyncStorage.setItem(KEY, seed);
    }
  } catch {
    seed = randomSeed();
  }

  return hashDevice(
    seed,
    `${Device.brand ?? ''} ${Device.modelName ?? ''}`.trim(),
    `${Platform.OS} ${Device.osVersion ?? ''}`.trim(),
  );
}
