/**
 * Finding out whether there is a newer version, and installing it.
 *
 * Three ways a copy of this app can exist, and each updates differently:
 *
 *   sideload  installed from a file. The app can fetch the next one and hand
 *             it to Android's installer, so nobody opens a browser.
 *   play      Google owns installation. The app can only say there is one and
 *             open the listing.
 *   appStore  same, and iOS has no in-app install path at all.
 *
 * Which one this build is, is decided at build time rather than sniffed at
 * runtime: Android does expose the installing package, but not through any
 * Expo API, and a wrong guess here means offering somebody a download that
 * their store will refuse to install over.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

import { readAppVersion } from './appInfo';
import { decide, parseTag, type Channel, type Release, type UpdateDecision } from './updates';

/** Where published builds live. */
const RELEASES_API = 'https://api.github.com/repos/Leejoneske/nearby/releases/latest';
const ASSET_NAME = 'nearby.apk';

const PACKAGE = 'app.nearby.directory';

export function channel(): Channel {
  if (Platform.OS === 'ios') return 'appStore';
  if (Platform.OS !== 'android') return 'sideload';

  // Set by the workflow that publishes to a store. Anything else is a file
  // somebody installed themselves.
  return process.env.EXPO_PUBLIC_DISTRIBUTION === 'play' ? 'play' : 'sideload';
}

/** What is installed right now. */
export function installed(): { version: string; build?: number } {
  const info = readAppVersion();
  const build = Number.parseInt(String(info.build ?? ''), 10);
  return {
    version: info.version,
    build: Number.isFinite(build) ? build : undefined,
  };
}

/**
 * The newest published build, or null when there is none or we could not ask.
 *
 * A failed check is not an error worth showing. Somebody who opened the app
 * to find a coffee shop does not need to hear that a version lookup timed
 * out, and the next launch tries again.
 */
async function latestSideloadRelease(): Promise<Release | null> {
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      tag_name?: string;
      body?: string;
      assets?: { name: string; browser_download_url: string; size: number }[];
    };

    const tag = body.tag_name ? parseTag(body.tag_name) : null;
    if (!tag) return null;

    const asset = (body.assets ?? []).find((a) => a.name === ASSET_NAME);

    return {
      version: tag.version,
      build: tag.build,
      assetUrl: asset?.browser_download_url,
      sizeBytes: asset?.size,
      notes: body.body ?? undefined,
    };
  } catch (e) {
    console.warn('[updates] the check failed', e);
    return null;
  }
}

/** The newest version on the App Store, via Apple's public lookup. */
async function latestAppStoreRelease(): Promise<Release | null> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${PACKAGE}&t=${Date.now()}`,
    );
    if (!response.ok) return null;

    const body = (await response.json()) as {
      resultCount?: number;
      results?: { version?: string; releaseNotes?: string }[];
    };
    const first = body.results?.[0];
    if (!first?.version) return null;

    return { version: first.version, notes: first.releaseNotes };
  } catch (e) {
    console.warn('[updates] the check failed', e);
    return null;
  }
}

/**
 * Play has no public "what version is live" endpoint, and scraping the store
 * page is the kind of thing that works until it does not. Play's own in-app
 * update flow is the right answer here and needs a native module we do not
 * have yet, so for now a Play build simply never prompts — which is honest,
 * because Play already updates apps by itself.
 */
async function latestPlayRelease(): Promise<Release | null> {
  return null;
}

export async function checkForUpdate(): Promise<UpdateDecision> {
  const where = channel();
  const release =
    where === 'sideload'
      ? await latestSideloadRelease()
      : where === 'appStore'
        ? await latestAppStoreRelease()
        : await latestPlayRelease();

  return decide(installed(), release, where);
}

/** Opens the store listing for this app. */
export async function openStore(): Promise<void> {
  const url =
    Platform.OS === 'ios'
      ? `https://apps.apple.com/app/id${PACKAGE}`
      : `market://details?id=${PACKAGE}`;
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`).catch(
      () => {},
    );
  }
}

/**
 * Downloads the new build and hands it to Android's installer.
 *
 * The last step is Android's own confirmation screen and cannot be skipped —
 * no app may install another without the person agreeing, which is a rule
 * worth having. What this removes is everything before it: no browser, no
 * downloads folder, no hunting for the file.
 *
 * `onProgress` gets 0..1 so the sheet can show something moving; a 45 MB
 * download over a slow connection is long enough that a spinner alone reads
 * as a hang.
 */
export async function downloadAndInstall(
  release: Release,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (Platform.OS !== 'android' || !release.assetUrl) {
    throw new Error('This build cannot install updates itself.');
  }

  // The cache directory, so the system can reclaim the file later. A 45 MB
  // installer we keep forever is 45 MB somebody did not agree to give up.
  const target = new File(new Directory(Paths.cache), `nearby-${release.version}.apk`);

  // A half-finished file from an interrupted attempt would install as a
  // corrupt package, so anything already there is discarded first.
  if (target.exists) target.delete();

  const task = File.createDownloadTask(release.assetUrl, target, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      // -1 means the server sent no Content-Length. Better no bar than a
      // bar that lies about how far along it is.
      if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes);
    },
  });

  const file = await task.downloadAsync();
  if (!file?.uri) throw new Error('The download did not finish.');

  // Android will not open a file:// URI handed over by another app, so it
  // goes through the content provider Expo installs for exactly this.
  const contentUri = await getContentUriAsync(file.uri);

  await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
