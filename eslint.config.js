// Flat config. `expo lint` wants to fetch this on first run, which needs a
// network the build box may not have — so it is committed instead.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'landing/*', 'node_modules/*'],
  },
  {
    // Build-time scripts run in Node, not on a device, so they get Node's
    // globals. Without this, `Buffer` and friends read as undefined.
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly' },
    },
  },
];
