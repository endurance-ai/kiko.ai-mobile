// Metro config wrapping — Share Extension 번들을 분리해서 서빙하기 위해
// expo-share-extension 의 withShareExtension 로 감싼다.
const { getDefaultConfig } = require('expo/metro-config');
const { withShareExtension } = require('expo-share-extension/metro');

module.exports = withShareExtension(getDefaultConfig(__dirname), {
  isCSSEnabled: true,
});
