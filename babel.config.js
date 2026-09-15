/**
 * babel.config.js
 *
 * Expo SDK 57 doesn't ship this file by default (Metro uses its own
 * built-in transform for production builds). However, jest-expo's
 * transform pipeline relies on Babel to compile JSX and TypeScript
 * in the test environment, so we need this file for `npm test` to work.
 *
 * It has NO effect on `npx expo run:ios` or `npx expo start`.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
