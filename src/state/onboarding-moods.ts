/**
 * 온보딩 무드 타일 — 브랜드 선택 그리드를 대체하는 사진 기반 무드 8종(성별 분리).
 *
 * 배경: 스타일 노드 21종을 전부 노출하던 방식은 선택 피로가 커 이탈이 났다.
 * 대표성을 가진 무드 8개에 노드를 묶어, 유저는 무드 1~3개만 고른다. 무드 하나를
 * 고르면 그 안의 노드들이 한 번에 취향으로 저장된다 — 고르는 수고는 줄고 모이는
 * 취향 데이터는 오히려 많아진다.
 *
 * 저장 계약은 그대로다: 무드 → 멤버 노드 코드 → 그 노드의 (성별별) 대표 brand_id
 * (`STYLE_NODES` + `REP_BRAND_IDS`)로 펼쳐 `selected_brand_ids` 로 보낸다. 서버가
 * brand_id → `brand_nodes.primary_style_node_id` 로 노드를 되유도해 {스타일, 브랜드}
 * 로 적재하므로 **API/백엔드 변경은 없다** (app/api/onboarding.py).
 *
 * `brandLabels` 는 타일 위에 얹는 전시용 텍스트(확정 무드표의 "대표 브랜드" 칸)일
 * 뿐, 저장에는 쓰이지 않는다 — 저장은 오직 `nodeCodes` → 대표 brand_id 경로.
 *
 * 매핑 확정: 2026-08-18 (강현규/최윤영). 여성은 E·F·G·H·M·P 제외(15/21) —
 * 센슈얼은 R 단독(P=럭셔리 맥시멀리스트는 결이 달라 제외). 남성은 Q·R 이 애초에
 * repBrandMen 없음이라 19노드 전부 커버.
 */
import type { OnboardingBrandPick } from '@/state/onboarding';
import { REP_BRAND_IDS, STYLE_NODES } from '@/state/style-nodes';

export type MoodTile = {
  /** 안정 슬러그 — 애널리틱스·선택 상태 키. 성별 세트 내 유일. */
  id: string;
  /** 무드명 (한국 커머스 통용어 기준). */
  name: string;
  /** 보조 한 줄 (선택). */
  subtext?: string;
  /** 멤버 스타일 노드 코드(STYLE_NODES.code, A~U). 저장은 이 코드로 펼친다. */
  nodeCodes: string[];
  /** 타일 위 전시용 브랜드 텍스트 — 저장에는 미사용. */
  brandLabels: string[];
  /** 타일 배경 사진 (require, 819×1093 JPG). */
  image?: number;
};

export const WOMEN_MOODS: MoodTile[] = [
  { id: 'minimal', name: '미니멀', nodeCodes: ['C', 'B'], brandLabels: ['LOW CLASSIC', 'Jil Sander', 'Helmut Lang'], image: require('../../assets/onboarding/moods/women/minimal.jpg') },
  { id: 'oldmoney', name: '올드머니', nodeCodes: ['D'], brandLabels: ['Toteme', 'Massimo Dutti'], image: require('../../assets/onboarding/moods/women/oldmoney.jpg') },
  { id: 'daily', name: '데일리 캐주얼', nodeCodes: ['A'], brandLabels: ['A.P.C.', '마리떼 프랑소와 저버'], image: require('../../assets/onboarding/moods/women/daily.jpg') },
  { id: 'lovely', name: '러블리', nodeCodes: ['Q'], brandLabels: ['illigo', '크랭크'], image: require('../../assets/onboarding/moods/women/lovely.jpg') },
  { id: 'sensual', name: '센슈얼', nodeCodes: ['R'], brandLabels: ['SKIMS', 'Justhaus', 'NiiHai'], image: require('../../assets/onboarding/moods/women/sensual.jpg') },
  { id: 'street', name: '스트릿', nodeCodes: ['I', 'J', 'L'], brandLabels: ['MSCHF', 'OJOS'], image: require('../../assets/onboarding/moods/women/street.jpg') },
  { id: 'kitsch', name: '키치 유니크', nodeCodes: ['K', 'N', 'O', 'U'], brandLabels: ['코이세이오', '오헤시오', 'misekiseoul'], image: require('../../assets/onboarding/moods/women/kitsch.jpg') },
  { id: 'gorpcore', name: '고프코어', nodeCodes: ['S', 'T'], brandLabels: ["Arc'teryx", 'Moncler'], image: require('../../assets/onboarding/moods/women/gorpcore.jpg') },
];

export const MEN_MOODS: MoodTile[] = [
  { id: 'minimal', name: '미니멀', nodeCodes: ['D', 'B'], brandLabels: ['Lemaire', 'nanamica', 'A.P.C.'], image: require('../../assets/onboarding/moods/men/minimal.jpg') },
  { id: 'contemporary', name: '컨템퍼러리 캐주얼', nodeCodes: ['C', 'A'], brandLabels: ['Our Legacy', 'Séfr', 'Sunflower'], image: require('../../assets/onboarding/moods/men/contemporary.jpg') },
  { id: 'american', name: '아메리칸 캐주얼', nodeCodes: ['F', 'G'], brandLabels: ['EASTLOGUE', 'Engineered Garments', "Levi's"], image: require('../../assets/onboarding/moods/men/american.jpg') },
  { id: 'classic', name: '클래식', nodeCodes: ['E', 'H'], brandLabels: ['Polo Ralph Lauren', 'Barbour'], image: require('../../assets/onboarding/moods/men/classic.jpg') },
  { id: 'casualstreet', name: '캐주얼 스트릿', nodeCodes: ['I', 'J', 'K', 'U'], brandLabels: ['thisisneverthat', 'ADER error', 'Grailz'], image: require('../../assets/onboarding/moods/men/casualstreet.jpg') },
  { id: 'luxurystreet', name: '럭셔리 스트릿', nodeCodes: ['L', 'P'], brandLabels: ['Fear of God', 'Entire Studios'], image: require('../../assets/onboarding/moods/men/luxurystreet.jpg') },
  { id: 'avantgarde', name: '아방가르드', nodeCodes: ['M', 'N', 'O'], brandLabels: ['Rick Owens', 'Juun.J', 'Maison Margiela'], image: require('../../assets/onboarding/moods/men/avantgarde.jpg') },
  { id: 'gorpcore', name: '고프코어', nodeCodes: ['S', 'T'], brandLabels: ['Salomon', 'Stone Island'], image: require('../../assets/onboarding/moods/men/gorpcore.jpg') },
];

export const MOOD_MIN = 1;
export const MOOD_MAX = 3;

export function moodsForGender(gender: 'women' | 'men'): MoodTile[] {
  return gender === 'women' ? WOMEN_MOODS : MEN_MOODS;
}

// code → STYLE_NODES 노드 조회 (1회 구축). 키는 string 으로 넓힌다
// (mood.nodeCodes 가 string[] 이라 리터럴 유니온 키와 안 맞음).
const NODE_BY_CODE = new Map<string, (typeof STYLE_NODES)[number]>(
  STYLE_NODES.map((n) => [n.code, n]),
);

/**
 * 선택 무드 → 저장용 브랜드 픽. 각 무드의 멤버 노드마다 그 성별 대표 브랜드를
 * 뽑아 `REP_BRAND_IDS` 로 id 를 붙인다. id 없는(매핑 밖) 브랜드는 조용히 제외,
 * 같은 id 는 dedupe (여러 무드가 같은 노드를 공유해도 1건).
 */
export function moodsToBrandPicks(
  selectedMoodIds: Iterable<string>,
  gender: 'women' | 'men',
): OnboardingBrandPick[] {
  const idSet = new Set(selectedMoodIds);
  const moods = moodsForGender(gender);
  const picks: OnboardingBrandPick[] = [];
  const seen = new Set<number>();
  for (const mood of moods) {
    if (!idSet.has(mood.id)) continue;
    for (const code of mood.nodeCodes) {
      const node = NODE_BY_CODE.get(code);
      if (!node) continue;
      const rep = gender === 'women' ? node.repBrandWomen : node.repBrandMen;
      if (!rep) continue;
      const id = REP_BRAND_IDS[rep];
      if (id == null || seen.has(id)) continue;
      seen.add(id);
      picks.push({ id, name: rep });
    }
  }
  return picks;
}
