// Metro config wrapping — Share Extension 번들을 분리해서 서빙하기 위해
// expo-share-extension 의 withShareExtension 로 감싼다.
const { getDefaultConfig } = require('expo/metro-config');
const { withShareExtension } = require('expo-share-extension/metro');

// withShareExtension 은 (config) 하나만 받는다. 두 번째 인자는 조용히 버려
// 지므로 넘기지 않는다.
module.exports = withShareExtension(getDefaultConfig(__dirname));
