/**
 * app.json holds the configuration, and this file exists to say that nothing
 * needs adding to it at build time any more.
 *
 * It used to inject a Google Maps SDK key, because Android's Maps SDK will
 * not draw anything without one — and, worse, does not fail loudly about it:
 * a missing or refused key renders a blank grey rectangle with a watermark,
 * which is indistinguishable from a broken app. That is what shipped once,
 * and it is why the map moved to MapLibre and OpenFreeMap, which need no key,
 * no account and no card.
 *
 * Kept rather than deleted because `app.config.js` takes precedence over
 * `app.json` when both exist, and a future build-time value belongs here
 * rather than in a file that is read by tooling as static.
 */
const base = require('./app.json');

module.exports = () => base.expo;
