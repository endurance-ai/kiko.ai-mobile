import { close, openHostApp, type InitialProps } from 'expo-share-extension';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// Share Extension 은 사용자가 다른 앱(핀터레스트, Safari, 사진 등)에서
// "공유하기 → 키코" 를 누르면 iOS 가 띄우는 얇은 팝업. 우리는 UI 를 최소화
// 하고 payload 를 그대로 메인 앱으로 딥링크해 검색을 자동 착수시킨다.
//
// 서버 링크 크롤러가 있어 URL 만 넘겨도 og:image + 상품 정보를 뽑아 pin
// 기반 검색이 가능하다. 이미지가 직접 왔으면 image URL 을 그대로 pin.
//
// 딥링크 형식: kikoaimobile://share?url=<encoded>&text=<encoded>&image=<encoded>
export default function ShareExtension({ url, text, images }: InitialProps) {
  useEffect(() => {
    const params: string[] = [];
    if (url) params.push(`url=${encodeURIComponent(url)}`);
    if (text) params.push(`text=${encodeURIComponent(text)}`);
    const firstImage = images?.[0];
    if (firstImage) params.push(`image=${encodeURIComponent(firstImage)}`);
    if (params.length === 0) {
      // 아무 payload 도 못 잡음 — 조용히 닫는다.
      close();
      return;
    }
    // openHostApp 는 우리가 준 path 를 앱 scheme 뒤에 붙여 그대로 연다.
    openHostApp(`share?${params.join('&')}`);
  }, [url, text, images]);

  return (
    <View style={styles.root}>
      <ActivityIndicator />
      <Text style={styles.label}>키코로 보내는 중…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontSize: 15,
    color: '#111',
  },
});
