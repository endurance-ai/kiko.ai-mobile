import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/**
 * Share Extension → 메인 앱 딥링크 수신 훅.
 *
 * 다른 앱에서 "공유하기 → 키코" 를 누르면 확장이
 *   kikoaimobile://share?url=<encoded>&text=<encoded>&image=<encoded>
 * 로 우리를 연다. payload 를 뽑아 홈의 `seed` + (있다면) `pin_image` 로
 * 넘기고 자동 검색을 시작하게 한다.
 *
 * 홈은 `seed` 파라미터가 있으면 즉시 첫 턴을 돌리는 로직이 이미 있음
 * (`src/app/home.tsx` seedParam useEffect). 이미지 URL 은 pin 상품처럼
 * 처리되고, URL 만 온 케이스는 시드 텍스트 안에 URL 을 넣어서 서버의
 * link_resolver 가 og:image 를 뽑도록 넘긴다.
 */
export function useShareIntent(): void {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (rawUrl: string | null | undefined) => {
      if (!rawUrl) return;
      const parsed = Linking.parse(rawUrl);
      if (parsed.hostname !== 'share' && parsed.path !== 'share') return;
      const params = parsed.queryParams ?? {};
      const url = typeof params.url === 'string' ? params.url : undefined;
      const text = typeof params.text === 'string' ? params.text : undefined;
      const image = typeof params.image === 'string' ? params.image : undefined;
      const seed =
        text ||
        (url ? `이거랑 비슷한 거 찾아줘\n${url}` : '이거랑 비슷한 거 찾아줘');
      // replace 로 하면 뒤로가기 스택이 깨끗해짐. 100ms 지연은 라우터 초기화
      // 타이밍 이슈 (콜드 스타트 시 아직 마운트 전) 회피용.
      setTimeout(() => {
        try {
          router.replace({
            pathname: '/home',
            params: {
              seed,
              ...(image ? { pin_image: image, pin_label: '공유한 상품' } : {}),
            },
          });
        } catch {
          // 라우터가 아직 준비 안 됐거나 unmount 된 상태 — 조용히 넘어간다.
        }
      }, 100);
    };

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });
    return () => sub.remove();
  }, [router]);
}
