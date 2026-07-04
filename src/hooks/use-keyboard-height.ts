import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * iOS 에서 키보드가 뜰 때 실제 높이를 추적한다.
 * absolute-positioned composer 를 KeyboardAvoidingView 로 감쌌을 때,
 * 그 뒤의 FlatList 는 키보드 존재를 모르므로 마지막 메시지가 가려짐.
 * 이 훅으로 얻은 height 를 FlatList paddingBottom 에 더하면 해결된다.
 *
 * Android 는 windowSoftInputMode 로 시스템이 리사이즈해주므로 0 반환.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
