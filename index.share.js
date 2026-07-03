// Share Extension bundle 의 root 컴포넌트를 등록한다. iOS 확장이
// "shareExtension" 이름으로 UIView 를 요청 → metro 가 이 번들을 서빙 →
// AppRegistry 가 ShareExtension 을 마운트.
import { AppRegistry } from 'react-native';

import ShareExtension from './ShareExtension';

AppRegistry.registerComponent('shareExtension', () => ShareExtension);
