/**
 * app.json holds everything that is the same in every build. This file adds
 * the one thing that is not: the Android Maps SDK key.
 *
 * The key does not belong in app.json. An Android Maps key is restricted by
 * package name and signing certificate rather than kept secret, so committing
 * one is not a breach — but it is still an account-specific credential, and a
 * checked-in placeholder is worse than nothing. `REPLACE_WITH_…` was sitting
 * in the config being handed to Google, which answers a bad key by rendering
 * a blank grey rectangle rather than an error. That is why the map looked
 * broken.
 *
 * With no key set the app draws its own map instead — see src/lib/mapsKey.ts.
 * A build without the key is a build with a worse map, not a broken one.
 *
 * Set GOOGLE_MAPS_API_KEY in the environment (a .env file locally, a repo
 * secret in CI) to get the real thing.
 */
const base = require('./app.json');

module.exports = () => {
  const expo = base.expo;
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();

  return {
    ...expo,
    android: {
      ...expo.android,
      ...(apiKey ? { config: { googleMaps: { apiKey } } } : {}),
    },
  };
};
