/**
 * GlowBannerCard — 메인 배너 글로우 카드 재사용 템플릿 (2026-08-05 사용자 확정).
 *
 * 애플뮤직 인기 추천곡 카드 문법을 코드로 재현: 흰 바탕 + 하단 방사형 글로우
 * (색만 교체하면 무한 생성) + 우상단 Kiko 로고 + 하단 좌측 텍스트(슈퍼타이틀
 * 작게 + 타이틀 볼드, 흰색). 배경 이미지 파일 없이 코드로만 그린다 —
 * react-native-svg 미설치라 data-URI SVG(base64) 방식(웹 렌더 확실).
 *
 * 사이즈 체계 1번(세로 직사각). 폭·높이는 호출부에서 계산해 width/height 로
 * 넘긴다(BANNER_CARD_ASPECT = 1.35 권장). 라운드 CARD_RADIUS_LG(26).
 *
 * 사용 예:
 *   <GlowBannerCard
 *     supertitle="더워요" title="시원한 여름 휴가 피스"
 *     glow="#EA3B2E" width={cardW} height={cardH} onPress={...} />
 *
 * 카피·색은 호출부 책임(전부 가칭 단계). 글로우는 하단이 진해 흰 텍스트가
 * 읽히도록 설계 — 아주 밝은 파스텔 글로우면 대비 확인 필요.
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { IOSFont, IOSText } from '@/theme';

// 카드 종횡비(세로 직사각) — 호출부 레이아웃 계산 기본값.
export const BANNER_CARD_ASPECT = 1.35;
const CARD_RADIUS_LG = 26; // iOS 그룹카드 관찰치
const PAD = 24; // Spacing.four 상당

// 하단 방사형 글로우 — url(#g) 그래디언트 참조는 utf8 data-URI 에서 # 가
// fragment 로 잘려 깨지므로 base64 로 인코딩. userSpaceOnUse: 카드(100×135)
// 하단 중앙(50,150)에서 반경 105 = 위로 약 절반 높이까지 차오름. 하단 진하게
// (흰 텍스트 대비) → 위로 흰 바탕에 녹아든다.
export const bannerGlowUri = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 135" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="50" cy="150" r="105"><stop offset="0" stop-color="${color}" stop-opacity="1"/><stop offset="0.42" stop-color="${color}" stop-opacity="0.72"/><stop offset="0.72" stop-color="${color}" stop-opacity="0.28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="100" height="135" fill="white"/><rect width="100" height="135" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;base64,${(globalThis as { btoa: (s: string) => string }).btoa(svg)}`;
};

// Kiko 심볼+워드마크 (모노크롬 #1E1E1E). 색만 치환해 흰색/검정 전환.
const KIKO_LOGO_SVG =
  `<svg width="1808" height="469" viewBox="0 0 1808 469" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M844 431.515H904.24V306.674L961.224 243.984L1092.83 431.515H1163.38L1002.47 203.181L1162.02 28.8916H1085.77L970.721 155.083C948.199 180.213 926.22 204.533 904.24 229.392V28.8916H844V431.515Z" fill="#1E1E1E"/><path d="M1179.62 431.515H1236.88V146.166H1179.62V431.515ZM1208.12 96.9863C1228.47 96.9863 1244.48 81.5839 1244.48 62.1283C1244.48 42.4025 1228.47 27.0001 1208.12 27.0001C1187.76 27.0001 1172.03 42.4025 1172.03 62.1283C1172.03 81.5839 1187.76 96.9863 1208.12 96.9863Z" fill="#1E1E1E"/><path d="M1279.71 431.515H1336.97V331.264L1366 303.162L1468.85 431.515H1539.13L1409.69 268.844L1530.99 146.166H1459.89L1337.78 268.033H1336.97V28.8916H1279.71V431.515Z" fill="#1E1E1E"/><path d="M1670.97 438C1752.92 438 1808 377.201 1808 289.381C1808 201.02 1752.92 139.681 1670.97 139.681C1589.02 139.681 1533.66 201.02 1533.66 289.381C1533.66 377.201 1589.02 438 1670.97 438ZM1670.97 388.821C1621.85 388.821 1591.73 350.18 1591.73 289.381C1591.73 228.042 1622.12 188.86 1670.97 188.86C1719.81 188.86 1750.2 228.042 1750.2 289.381C1750.2 349.909 1720.08 388.821 1670.97 388.821Z" fill="#1E1E1E"/><rect y="29" width="411" height="411" fill="#1E1E1E"/><rect x="498" y="27" width="229" height="411" fill="#1E1E1E"/><path d="M411 234.5L498 31.4171V437.583L411 234.5Z" fill="#1E1E1E"/></svg>`;
export const logoUri = (color: string) =>
  `data:image/svg+xml;utf8,` + KIKO_LOGO_SVG.replace(/#1E1E1E/g, color).replace(/#/g, '%23');

export function GlowBannerCard({
  supertitle,
  title,
  glow,
  bgUri,
  width,
  height,
  logoColor = 'black',
  onPress,
}: {
  supertitle: string;
  title: string;
  glow: string;
  /** 배경 이미지/패턴 data-URI 또는 원격 URL. 주면 글로우 대신 이걸 렌더
   *  (실서비스 백엔드 이미지 배급 자리 = 이 prop). 미전달 시 glow 색 방사형. */
  bgUri?: string;
  width: number;
  height: number;
  /** 상단이 어두운 배경이면 'white'. 기본 글로우(흰 바탕)는 'black'. */
  logoColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[styles.cardShadow, { width, height }]}
    >
      <View style={styles.cardClip}>
        <Image source={{ uri: bgUri ?? bannerGlowUri(glow) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <Image source={{ uri: logoUri(logoColor) }} style={styles.logo} resizeMode="contain" />
        <View style={styles.textWrap}>
          <Text style={styles.supertitle} numberOfLines={1}>
            {supertitle}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 바깥 래퍼 = 그림자 전용(overflow 없음 — native 에서 overflow:hidden 이
  // 그림자를 클립하므로). 음수 spread(-7)로 그림자를 안쪽으로 당겨 옆 번짐을
  // 최소화 → 좁은 피크 갭에서 인접 카드끼리 붙어 보이는 seam 방지(2026-08-05).
  // 주로 아래로 뜨는 방향성 드롭. boxShadow = RN 0.85 정식 지원(web·native).
  cardShadow: {
    borderRadius: CARD_RADIUS_LG,
    // ① 위쪽까지 살짝 도는 타이트 앰비언트(상단 구분) + ② 방향성 드롭(아래로
    // 뜸). 둘 다 음수 spread 로 옆 번짐 억제 → 좁은 갭 seam 방지. (2026-08-05)
    boxShadow:
      '0px 0px 8px -2px rgba(0,0,0,0.07), 0px 6px 16px -6px rgba(0,0,0,0.12)',
  },
  // 안쪽 = 실제 카드(클리핑). 배경·로고·텍스트를 라운드 안으로 자른다.
  // 애플뮤직처럼 아주 옅은 헤어라인 테두리(8% 블랙) — 흰 배경 위 밝은 카드
  // 경계를 잡아준다(어두운 카드엔 거의 안 보임). 2026-08-05 사용자.
  cardClip: {
    flex: 1,
    borderRadius: CARD_RADIUS_LG,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  logo: {
    position: 'absolute',
    top: 16,
    right: 20, // 우측 마진을 top 과 균형 맞게(2026-08-05 사용자: 살짝 좌/위로)
    width: 50, // 아주 살짝 키움(2026-08-05 사용자) — 비율 3.855 유지
    height: 13,
  },
  textWrap: {
    padding: PAD,
  },
  // 애플 표준 타입 토큰 정렬(2026-08-05 사용자: "그냥 애플 따라가자").
  // 슈퍼타이틀 = subhead(15/20/400), 타이틀 = headline(17/22/600). 배경 위
  // 흰 텍스트라 색/여백만 오버라이드.
  supertitle: {
    ...IOSText.subhead,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: 2,
    fontFamily: IOSFont.sans,
  },
  title: {
    ...IOSText.headline,
    letterSpacing: -0.2,
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
  },
});
