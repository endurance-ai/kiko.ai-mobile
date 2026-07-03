// expo-share-extension 이 metro 빌드 시 index.share.js 를 sibling 으로
// 요구하기 때문에 main 을 여기(index.js)로 옮기고 expo-router 를 재수출한다.
import 'expo-router/entry';
