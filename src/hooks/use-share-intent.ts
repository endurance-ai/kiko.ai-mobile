import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';

/**
 * Share Extension → 메인 앱 딥링크 수신 훅.
 *
 * 다른 앱에서 "공유하기 → 키코" 를 누르면 확장이
 *   kikoaimobile://share?url=<encoded>&text=<encoded>&image=<encoded>
 * 로 우리를 연다. 여기서 payload 를 뽑아 홈으로 넘기고 자동 검색을
 * 시작하게 한다.
 *
 * 홈은 `seed` 파라미터가 있으면 즉시 첫 턴을 돌리는 로직이 이미 있음
 * (`src/app/home.tsx` seedParam useEffect). 이미지 URL 은 `pin_image` 로
 * 넘겨서 서버 비전 단계가 사진을 보게 하고, URL 만 온 경우엔 시드 텍스트
 * 안에 URL 자체를 넣어 서버 링크 크롤러가 og:image 를 뽑는다.
 */
export function useShareIntent(): void {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (rawUrl: string | null | undefined) => {
      if (!rawUrl) return;
      const parsed = Linking.parse(rawUrl);
      // scheme 은 무시하고 path 만 본다 — kikoaimobile://share, 또는
      // Universal Link 로 왔을 때도 동일 hostname/path 규칙 적용.
      if (parsed.hostname !== 'share' && parsed.path !== 'share') return;
      const params = parsed.queryParams ?? {};
      const url = typeof params.url === 'string' ? params.url : undefined;
      const text = typeof params.text === 'string' ? params.text : undefined;
      const image = typeof params.image === 'string' ? params.image : undefined;
      // 홈이 기대하는 파라미터 형태로 정리.
      //  - image 가 있으면 pin_image 로 넘겨 서버가 사진 기반 검색.
      //  - text 는 시드 문장 그대로.
      //  - URL 만 있으면 "이거랑 비슷한 거 찾아줘\n<url>" 로 감싼다.
      const seed =
        text ||
        (url ? `이거랑 비슷한 거 찾아줘\n${url}` : '이거랑 비슷한 거 찾아줘');
      router.push({
        pathname: '/home',
        params: {
          seed,
          ...(image ? { pin_image: image, pin_label: '공유한 상품' } : {}),
        },
      });
    };

    // 콜드 스타트: 딥링크로 앱이 뜨는 케이스.
    void Linking.getInitialURL().then(handleUrl);
    // 앱이 이미 떠 있을 때: 수신 리스너.
    const sub = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });
    return () => sub.remove();
  }, [router]);
}
