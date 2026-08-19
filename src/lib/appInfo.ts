/**
 * What version of the app this is.
 *
 * Two numbers, and they are not the same thing:
 *
 *   version      "1.0.0"  — the human one, changed by hand in app.json
 *   build        7        — a counter CI raises on every build
 *
 * Android compares the build counter to decide whether an install is an
 * upgrade, so it has to rise every time. It is not something a person needs
 * to read: "1.6.0 (11)" invites the question of which number matters, and
 * neither answer helps anybody. Settings shows the version alone, and the
 * build stays available for the update check, which is the only thing that
 * has a use for it.
 */
import * as Application from 'expo-application';
import Constants from 'expo-constants';

export type AppVersion = { version: string; build: number | null };

/** What Settings shows. Kept separate from the platform reads so it can be tested. */
export function formatVersion({ version }: AppVersion): string {
  return version || 'Unknown';
}

/** Version and build together, for a bug report or a log line. */
export function formatVersionWithBuild({ version, build }: AppVersion): string {
  if (!version) return 'Unknown';
  return build === null ? version : `${version} (${build})`;
}

/** `null` for anything that is not a finite number, including "" and NaN. */
export function parseBuild(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function readAppVersion(): AppVersion {
  /*
   * Prefer what is actually installed over what the config claimed at build
   * time — they disagree whenever CI stamps the build number, which is every
   * build. Both are null on web, where there is no installed package, so the
   * config is the only source there.
   */
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '';

  const build =
    parseBuild(Application.nativeBuildVersion) ??
    parseBuild(Constants.expoConfig?.android?.versionCode) ??
    parseBuild(Constants.expoConfig?.ios?.buildNumber);

  return { version, build };
}

export function appVersionLabel(): string {
  return formatVersion(readAppVersion());
}
