import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { fetchLinkPreviewImage } from '@/lib/og-image';

/**
 * Share Extension → 메인 앱 딥링크 수신 훅.
 *
 * 다른 앱에서 "공유하기 → 키코" 를 누르면 확장이
 *   kikoaimobile://share?url=<encoded>&text=<encoded>&image=<encoded>
 * 로 우리를 연다. 여기서 payload 를 뽑아 홈으로 넘기고 자동 검색을
 * 시작하게 한다.
 *
 * 서버는 raw URL 을 "링크로는 직접 분석이 안 돼요" 로 리젝트하기 때문에
 * URL 만 온 케이스는 여기서 og:image / twitter:image 를 뽑아 `pin_image`
 * 로 승격시킨 뒤 홈으로 넘긴다. 실패하면 URL 을 시드 텍스트에 남겨서
 * 유저가 상황을 인지할 수 있게 한다.
 */
export function useShareIntent(): void {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = async (rawUrl: string | null | undefined) => {
      console.log('[useShareIntent] handleUrl:', rawUrl);
      if (!rawUrl) return;
      const parsed = Linking.parse(rawUrl);
      console.log('[useShareIntent] parsed:', JSON.stringify(parsed));
      if (parsed.hostname !== 'share' && parsed.path !== 'share') {
        console.log('[useShareIntent] skipped: not a share URL');
        return;
      }
      const params = parsed.queryParams ?? {};
      const url = typeof params.url === 'string' ? params.url : undefined;
      const text = typeof params.text === 'string' ? params.text : undefined;
      let image = typeof params.image === 'string' ? params.image : undefined;

      // URL 만 온 경우: og:image 를 fetch 해서 pin_image 로 승격.
      // 서버는 raw URL 로는 검색을 못 하고 이미지가 있어야 비전 파이프라인
      // 이 돈다.
      if (!image && url) {
        console.log('[useShareIntent] resolving og:image for', url);
        const og = await fetchLinkPreviewImage(url);
        console.log('[useShareIntent] og:image =', og);
        if (og) image = og;
      }

      const seed = image
        ? '이 상품이랑 비슷한 거 찾아줘'
        : text ||
          (url ? `이거랑 비슷한 거 찾아줘\n${url}` : '이거랑 비슷한 거 찾아줘');
      console.log(
        '[useShareIntent] routing to /home, seed=',
        seed,
        'image=',
        image,
      );
      setTimeout(() => {
        try {
          router.replace({
            pathname: '/home',
            params: {
              seed,
              ...(image ? { pin_image: image, pin_label: '공유한 상품' } : {}),
            },
          });
        } catch (err) {
          console.log('[useShareIntent] router.replace failed:', err);
        }
      }, 100);
    };

    void Linking.getInitialURL().then((initial) => {
      console.log('[useShareIntent] getInitialURL:', initial);
      void handleUrl(initial);
    });
    const sub = Linking.addEventListener('url', (event) => {
      console.log('[useShareIntent] url event:', event.url);
      void handleUrl(event.url);
    });
    return () => sub.remove();
  }, [router]);
}
