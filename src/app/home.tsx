import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image as ExpoImage } from "expo-image";

import { Banner } from "@/components/banner";
import { FeedbackTrigger } from "@/components/feedback-trigger";
import { GlassSurface } from "@/components/glass-surface";
import { PixelSpinner, ShimmerText } from "@/components/pixel-spinner";
import { PRODUCT_CARD_WIDTH, ProductCard } from "@/components/product-card";
import { TopBar } from "@/components/top-bar";
import { Haptic, IOSColors, IOSFont, IOSText, Opacity , Radius , withAlpha , Scrim } from "@/theme";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import {
  createSessionStream,
  getMessages,
  sendCallbackStream,
  sendMessageStream,
} from "@/lib/chat";
import {
  FREE_LIMIT_VERSION,
  setAnalyticsSessionId,
  trackEvent,
  trackOnboarding,
} from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { parseAnchorPrefix } from "@/lib/anchor";
import { getProduct } from "@/lib/products";
import {
  isCapExhausted,
  type CapMeta,
  type CapReachedInfo,
  type ChatStreamController,
} from "@/lib/sse";
import { uploadImage } from "@/lib/uploads";
import { CurationSheet } from "@/components/curation-sheet";
import { useAuth } from "@/state/auth";
import { useBanner } from "@/state/banner";
import { useCuration } from "@/state/curation";
import { readOnboardingGender, type OnboardingGender } from "@/state/onboarding";
import {
  chipLabelForQuery,
  chipsForGender,
  type SuggestionChip,
} from "@/state/suggestion-chips";
import { useCap } from "@/state/cap";
import { buildFilterLabel, PRICE_MAX, useFilter } from "@/state/filter";
import { MOCK_PRODUCTS, type Product } from "@/state/products";
import { useWishlist } from "@/state/wishlist";
import type { ClarifyPayload, ProductRef } from "@/types/api";

type TurnStatus = "analyzing" | "picking" | "searching" | "results" | "empty";

type VisionItem = {
  id: string;
  label: string;
  emoji: string;
};

const MOCK_VISION_ITEMS: VisionItem[] = [
  { id: "shirt", label: "코튼 오버셔츠", emoji: "👔" },
  { id: "jeans", label: "와이드 데님", emoji: "👖" },
  { id: "shoes", label: "레더 스니커즈", emoji: "👟" },
  { id: "watch", label: "미니멀 시계", emoji: "⌚" },
];

type UserMessage = {
  text?: string;
  imageUri?: string;
  colorHint?: string;
  /** 재입장 시 서버 텍스트의 [#id …] 앵커에서 파싱한 상품 id — 이미지 복원용. */
  anchorProductId?: string;
};

type Narrowing = {
  question: string;
  options: string[];
};

type Turn = {
  id: number;
  user: UserMessage;
  status: TurnStatus;
  visionItems?: VisionItem[];
  pickedItem?: VisionItem;
  results?: Product[];
  narrowing?: Narrowing | null;
  // SSE chat turn (real backend). When `isStream` is true the mock fields
  // above are ignored and the assistant bubble streams in directly.
  isStream?: boolean;
  streamText?: string;
  streamProducts?: ProductRef[];
  streamDone?: boolean;
  /** Placeholder shown while waiting for the first text_delta. */
  streamPlaceholder?: string;
  /** search_id from the server (SSE 'search' event) — tags feedback / view records. */
  streamSearchId?: string;
  /** 검색 결과 세트 전체 크기 — SSE 'search' 이벤트의 total. [더보기 (N)] 표시. */
  streamSearchTotal?: number;
  /** Inline-keyboard prompt (pick_item / gender / category_pick / ...).
   *  Retained across tap so the chat log preserves the choice history.
   *  `streamClarifyPicks` — set of already-searched option callbacks.
   *  Already-searched buttons stay visible but non-tappable + muted; the
   *  rest remain interactive so the user can scroll back and try another. */
  streamClarify?: ClarifyPayload | null;
  streamClarifyPicks?: string[];
};

const SEARCH_HINT = "인디 · 빈티지 2,900+ 브랜드에서 찾는 중…";
const ANALYZE_HINT = "사진 분석 중… 아이템 추출하고 있어";

// Composer placeholder pools. Rotated by a ticker so the hint refreshes
// while the user is reading. Sources of truth for all states below.
const BUSY_GENERAL_HINTS = [
  "키코가 3,200+ 브랜드에서 찾는 중…",
  "당신 취향의 브랜드에서 찾는 중…",
  "당신 취향의 디자이너를 찾는 중…",
  "지금 막 나온 신상부터 살펴보는 중…",
  "이미지에서 핏 · 색 · 무드를 읽는 중…",
];
const BUSY_CRITIQUE_HINTS = [
  "더 디테일하게 찾는 중…",
  "더 비슷하게 다시 찾아보는 중…",
  "더 저렴한 가격으로 찾는 중…",
  "조건을 좁혀서 정확하게 찾는 중…",
];
const IDLE_INITIAL_HINTS = [
  "이미지/링크를 추가하거나 요청…",
  "SNS 링크를 넣어보세요",
  "사진 한 장이면 충분해요",
];
const IDLE_AFTER_RESULTS_HINTS = [
  "더 저렴한 것 찾아줘",
  "더 비슷한 것 찾아줘",
  "정확한 핏 요청하기",
  "디테일한 차이를 설명하기",
];
const PICK_PROMPT = (n: number) =>
  `이 사진에서 ${n}개 아이템 찾았어. 어떤 거 찾아줄까?`;
// 빈 상태 히어로 카피 — 큐레이션 시트 위에 얹는 메인 표제. 핵심가치를
// 하나씩 말하는 3종을 마운트마다 랜덤 로테이션 (7/16 재이식 — 7/14 정리 때
// curation-lab.tsx HERO_GREETINGS 로 보존했던 자산 복원, 카피 원본 동일).
// ① 발견: 인디 브랜드 풀·신선함 ② 취향: 발견·취향 매칭 ③ 목적: v1.0 시그니처.
// 로그인 시 ②의 이름 치환("OO님이 몰랐던")은 display_name fetch 와 함께 추후.
const HERO_GREETINGS = [
  "몰랐던 브랜드가\n매일 새로 도착해요",
  "당신이 몰랐던\n취향저격 브랜드",
  "머릿속 그 옷,\n마법처럼 찾아드릴게요",
];

// SSE 결과 카드의 caption(HTML-ish)을 ProductCard 의 brand/name/price 로 분해.
// 서버 caption 순서(send_results.py): 브랜드[ · 서브카테고리] / "💰 ₩가격" /
// 상품명 / "🏬 플랫폼". 가격 줄에서 숫자만 뽑아 priceWon 으로(큐레이션 카드와
// 동일하게 가격 태그 노출), 플랫폼 줄은 카드에 안 쓴다.
function parseStreamCaption(caption: string): {
  brand: string;
  name: string;
  priceWon: number;
} {
  const lines = caption
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let brand = "";
  let name = "";
  let priceWon = 0;
  for (const line of lines) {
    if (line.startsWith("💰")) {
      const digits = line.replace(/[^0-9]/g, "");
      if (digits) priceWon = parseInt(digits, 10);
    } else if (line.startsWith("🏬")) {
      // 플랫폼 — 카드엔 미표시
    } else if (!brand) {
      brand = line.split(" · ")[0].trim(); // 브랜드(서브카테고리 앞부분)
    } else if (!name) {
      name = line;
    }
  }
  return { brand, name, priceWon };
}

// 사이드바에서 '이전 채팅 열기'로 진입한 세션 id 들 — 이 세션은 큐레이션을
// 숨긴다. 모듈 레벨이라 PDP·더보기 왕복으로 새 홈 인스턴스가 떠도 유지된다.
const HISTORY_OPENED_SESSIONS = new Set<string>();

const AGENT_INTRO_DEFAULT = "이런 거 어때? · 콕집기로 골라봐";
const AGENT_INTRO_NARROWING = "이런 거 찾았어 · 근데 좀 갈리네";
const EMPTY_FALLBACK = "이 무드는 아직 딱 맞는 걸 못 찾았어. 이렇게 해볼까?";

// Critique chips stay identical whether a product is pinned or not — the
// single source of truth keeps refine actions predictable. The "왜" affordance
// (which only made sense for an anchored item) is dropped on purpose.
const CRITIQUE_CHIPS = [
  { id: "similar", label: "더 비슷하게" },
  { id: "cheaper", label: "더 저렴하게" },
];

const MOCK_NARROWING: Narrowing = {
  question: "기장에서 갈려 — 어디로 좁힐까?",
  options: ["롱 기장", "크롭"],
};

// Pinterest / Instagram 링크는 og:image 해석을 통해 이미지 입력과 동치로 본다
// (ai-server link_resolver 패턴). 텍스트 안 어디에 끼어있어도 잡는다.
const VISION_LINK_RE =
  /https?:\/\/\S*(?:pinterest|pin\.it|instagram|instagr\.am)/i;

function containsVisionLink(text: string | undefined): boolean {
  return !!text && VISION_LINK_RE.test(text);
}

// 스트리밍 카드 safety dedup — 서버 다양화 파이프라인이 근사 중복 (다른
// product_id 지만 동일 이미지/캡션) 을 놓칠 때 프론트에서 최종 방어.
// key 우선순위: product_id → image_url → caption. 하나라도 겹치면 drop.
function appendUniqueProduct(
  existing: ProductRef[] | undefined,
  next: ProductRef,
): ProductRef[] {
  const list = existing ?? [];
  for (const p of list) {
    if (
      next.product_id != null &&
      p.product_id != null &&
      p.product_id === next.product_id
    )
      return list;
    if (p.image_url && p.image_url === next.image_url) return list;
    if (p.caption && next.caption && p.caption === next.caption) return list;
  }
  return [...list, next];
}

const URL_RE = /https?:\/\/[^\s]+/i;

function extractFirstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0] : null;
}

/**
 * Best-effort fetch of the og:image (or twitter:image) for a given URL.
 * Used to render a small thumbnail preview inside the user's chat bubble
 * when they paste a Pinterest / Instagram / generic link. Failures are
 * silent — the bubble just stays text-only.
 */
async function fetchLinkPreviewImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,*/*",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert server message history (chronological) into the home Turn list.
 * Each (user, assistant) pair becomes a single completed SSE-style turn.
 * Trailing user message with no reply (rare) still renders as a turn with
 * empty assistant content so the user input is visible.
 */
function messageItemsToTurns(
  items: import("@/types/api").MessageItem[],
  nextIdRef: { current: number },
): Turn[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const turns: Turn[] = [];
  let i = 0;
  while (i < sorted.length) {
    const userMsg = sorted[i];
    if (userMsg.role !== "user") {
      i++;
      continue;
    }
    const assistantMsg =
      sorted[i + 1]?.role === "assistant" ? sorted[i + 1] : null;
    const { text: parsedText, anchorProductId } = parseAnchorPrefix(
      userMsg.content,
    );
    // 유도 칩은 서버에 검증된 영어 query 로 저장돼 재입장 시 영어로 뜬다.
    // 알려진 칩 query 면 한국어 label 로 되돌려 사용자가 친 대로 보이게 한다.
    const userText = chipLabelForQuery(parsedText) ?? parsedText;
    turns.push({
      id: nextIdRef.current++,
      user: { text: userText, anchorProductId },
      status: "results",
      isStream: true,
      streamText: assistantMsg?.content ?? "",
      streamProducts: assistantMsg?.product_refs ?? [],
      // 서버가 어시스턴트 턴에 결과 세트 search_id 를 실어 보내므로,
      // 재접속 시에도 [더보기] CTA 를 복원 가능.
      streamSearchId: assistantMsg?.search_id ?? undefined,
      streamDone: true,
    });
    i += assistantMsg ? 2 : 1;
  }
  return turns;
}

// Best-effort heuristic for fashion / shopping intent. Used to pick the
// transient bot status copy while waiting for the first text_delta. Not a
// gate on anything else — false negatives just fall back to a generic line.
const FASHION_KEYWORDS =
  /옷|셔츠|티셔츠|블라우스|니트|스웨터|가디건|후드|맨투맨|자켓|재킷|코트|아우터|이너|패딩|점퍼|조끼|베스트|원피스|드레스|스커트|치마|바지|팬츠|진|데님|슬랙스|쇼츠|반바지|신발|스니커즈|운동화|구두|로퍼|샌들|부츠|슬리퍼|가방|백|클러치|토트|크로스백|숄더백|모자|캡|비니|버킷햇|선글라스|안경|벨트|시계|악세사리|악세서리|주얼리|목걸이|반지|귀걸이|팔찌|핏|루즈핏|오버핏|슬림핏|와이드|크롭|롱|숏|컬러|색감|색상|브랜드|코디|룩|스타일|무드|빈티지|미니멀|스트릿|캐주얼|포멀|찾아|추천|입을|입고|사고/i;

function looksLikeFashionQuery(text: string): boolean {
  return FASHION_KEYWORDS.test(text);
}

export default function ChatEntryScreen() {
  const insets = useSafeAreaInsets();
  const {
    session: sessionParam,
    from: fromParam,
    seed: seedParam,
    pin_image: pinImageParam,
    pin_label: pinLabelParam,
    pin_id: pinIdParam,
    pin_name: pinNameParam,
    pin_price: pinPriceParam,
  } = useLocalSearchParams<{
    session?: string;
    from?: string;
    seed?: string;
    pin_image?: string;
    pin_label?: string;
    pin_id?: string;
    pin_name?: string;
    pin_price?: string;
  }>();
  const { value: filter, setValue: setFilter } = useFilter();
  const { isSaved: isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { status: authStatus } = useAuth();
  const {
    active: activeBanner,
    show: showBanner,
    clear: clearBanner,
  } = useBanner();
  const [text, setText] = useState("");
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  // Metadata needed for POST /v1/uploads — set whenever pickedImage is set,
  // cleared in lockstep. Lives in a ref because rendering doesn't use it.
  // Filename is the only piece we need to capture at pick time — uploadImage
  // reads the file itself to derive size_bytes (avoids the iOS fileSize gap).
  const pickedAssetRef = useRef<{ filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // 빈 상태(큐레이션 구좌)에서 + 핀한 상품 — 결과 리스트의 pinnedId 모델은
  // lastTurn.results 를 조회하는데 큐레이션 상품은 거기 없으므로 별도 보관.
  // 컴포저 첨부(pinnedAttachment)로 흘러 들어가고, 전송은 비로그인 게이트가
  // 로그인 시트로 보낸다 (handleSend).
  const [pinnedCurationProduct, setPinnedCurationProduct] =
    useState<Product | null>(null);
  // true = 히스토리에서 연 과거 채팅(채팅 내용만, 큐레이션 숨김).
  const [resumedFromHistory, setResumedFromHistory] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const nextIdRef = useRef(1);
  const sessionIdRef = useRef<string | null>(null);
  // 스레드 내 유저 쿼리 카운터 — 앰플리튜드 search_query 이벤트에 함께
  // 실어보내 성공률/이탈 지점을 세그먼트 별로 볼 수 있게 한다. 새 세션
  // 시작 시 0 으로 리셋.
  const queryIndexRef = useRef(0);
  // 이번 앱 라이프사이클에서 첫 번째 스레드인지 여부를 대략 판단하는 플래그.
  // 세션 로딩 시 활성 세션이 하나도 없었으면 true. thread_start 이벤트의
  // is_new_user 프로퍼티로 실어 이후 코호트 세그멘테이션에 사용.
  const threadStartFiredRef = useRef(false);
  const streamRef = useRef<ChatStreamController | null>(null);
  // 스트림이 마지막 이벤트 이후 아무 응답도 없이 오래 걸리면 스피너가 무한
  // 히 도는 케이스가 있어, 클라이언트에서 강제 타임아웃을 건다. 이벤트가
  // 올 때마다 리셋 → 타임아웃 발동 시 스트림 취소 + 실패 처리 + 배너.
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stall timeout — 이벤트 없이 조용하면 스트림 취소.
  //   텍스트만: 10s (검색 RPC + diversify 만)
  //   이미지/URL: 20s (link_resolver → vision LLM → search → diversify)
  // URL/이미지 케이스는 서버가 vision 단계에서 몇 초 조용해질 수 있어 여유
  // 필요. 두 값은 아래 runStreamingTurn 에서 attachment/URL 유무로 골라씀.
  const STREAM_STALL_MS_TEXT = 10_000;
  const STREAM_STALL_MS_MEDIA = 20_000;
  const URL_RE = /https?:\/\/\S+/i;
  // Latest daily-cap meta from the most recent `session` event. Kept around
  // 캡 상태는 CapProvider 에 위임 (홈/기존 채팅방 모두 공유). locked 는
  // 어떤 화면에서 소진 이벤트를 받았든 앱 전체에 즉시 반영된다.
  const {
    locked: capLocked,
    applyMeta: applyCapMeta,
    markReached: markCapReached,
  } = useCap();

  useEffect(
    () => () => {
      streamRef.current?.cancel();
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    },
    [],
  );

  // 메인 진입 이벤트 — 마운트당 1회 (기획 2026-07-23: 기존엔 온보딩 직후에만
  // 발사돼 일반 진입이 전부 미기록 → 큐레이션 화면 로그 공백의 원인 1).
  // entry_source 로 온보딩 퍼널(#9 최종 전환)은 계속 구분 가능 —
  // 온보딩 분석은 entry_source='onboarding' 필터로 동일하게 조회된다.
  // 빈 deps 로 마운트 시점 fromParam 만 보므로 재발사 없음.
  useEffect(() => {
    trackOnboarding("main_screen_viewed", {
      entry_source: fromParam === "onboarding" ? "onboarding" : "direct",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 그리팅/타이핑 머신 제거 (7/14) — 빈 상태가 큐레이션 시트로 바뀌면서
  // display_name fetch·typewriter reveal 로직도 함께 정리. 히어로 카피
  // 자산은 curation-lab.tsx(HERO_GREETINGS)에 보존.

  // Sticky flag — set when the current send originated from a critique chip
  // so the busy hints can swap to the critique-specific pool. Cleared on
  // next non-critique send or when the stream ends.
  const lastSendFromCritiqueRef = useRef(false);

  // Load a past session into the home turn list (sidebar tap routes here
  // with ?session=<uuid> so the chat continues on the same surface).
  //
  // Skip the server round-trip when we already have in-memory turns for the
  // SAME session. Rebuilding from GET /messages loses per-turn state that
  // the server doesn't yet surface (e.g. streamSearchId → "더보기" CTA):
  // navigating home → PDP → back would otherwise clear the CTA.
  useEffect(() => {
    // 큐레이션은 '메인 홈'에만. 히스토리/사이드바에서 연 과거 채팅
    // (?session=)이면 채팅 내용만 보이게 이 플래그로 큐레이션을 숨긴다.
    // 메인 홈에서 검색해 세션이 생긴 뒤 PDP 크리틱으로 ?session 이 붙어
    // 돌아오는 경우는(같은 세션 in-memory) 아래 early-return 이라 플래그를
    // 건드리지 않아 큐레이션이 유지된다.
    if (!sessionParam) {
      setResumedFromHistory(false);
      return;
    }
    // '이전 채팅 열기'(사이드바)만 큐레이션 숨김. from=history 로 온 세션 id 를
    // 모듈 레벨 set 에 기억해 둔다. PDP·더보기로 새 홈 인스턴스가 떠도(그때는
    // from 파라미터가 없다) set 조회로 같은 판정이 유지된다 — 홈에서 시작한
    // 세션은 채팅방을 나가 다른 이전 채팅을 열기 전까지 계속 큐레이션 유지.
    if (fromParam === "history") HISTORY_OPENED_SESSIONS.add(sessionParam);
    setResumedFromHistory(HISTORY_OPENED_SESSIONS.has(sessionParam));
    if (sessionIdRef.current === sessionParam && messages.length > 0) return;
    let cancelled = false;
    sessionIdRef.current = sessionParam;
    setAnalyticsSessionId(sessionParam);
    (async () => {
      try {
        const res = await getMessages(sessionParam, { limit: 50 });
        if (cancelled) return;
        const turns = messageItemsToTurns(res.messages, nextIdRef);
        // 덮어쓰기 대신 병합 — seed 핸드오프(/list·PDP→홈)로 방금 시작된
        // 스트리밍 턴이 prev 에 있을 수 있는데, getMessages 는 그 턴을 아직
        // 모르므로(전송 직전 상태) setMessages(turns) 로 덮으면 새 응답이
        // 통째로 날아간다. 로드한 히스토리를 앞에, 진행 중 턴을 뒤에 둔다.
        setMessages((prev) => [...turns, ...prev]);
        // 서버 히스토리엔 링크 미리보기 이미지가 저장돼 있지 않아, 재입장
        // 시 유저 버블에서 og:image 썸네일이 사라진다. 텍스트에 URL 이
        // 포함된 유저 턴은 여기서 다시 fetch 해서 imageUri 를 복원한다.
        for (const t of turns) {
          if (!t.user.text) continue;
          const url = extractFirstUrl(t.user.text);
          if (!url || t.user.imageUri) continue;
          void fetchLinkPreviewImage(url).then((imageUrl) => {
            if (!imageUrl || cancelled) return;
            setMessages((prev) =>
              prev.map((x) =>
                x.id === t.id
                  ? { ...x, user: { ...x.user, imageUri: imageUrl } }
                  : x,
              ),
            );
          });
        }
        // 핀 상품 앵커(#id)가 있던 유저 턴은 상품 이미지를 다시 받아 버블에
        // 썸네일로 복원 — "[#577005]" 텍스트 대신 "뭐였는지" 사진으로 보이게.
        for (const t of turns) {
          const pid = t.user.anchorProductId;
          if (!pid || t.user.imageUri) continue;
          void getProduct(pid)
            .then((detail) => {
              if (cancelled || !detail.image_url) return;
              setMessages((prev) =>
                prev.map((x) =>
                  x.id === t.id
                    ? { ...x, user: { ...x.user, imageUri: detail.image_url } }
                    : x,
                ),
              );
            })
            .catch(() => {
              // 상품이 사라졌거나 조회 실패 — 텍스트만 유지
            });
        }
      } catch {
        // ignore — empty state will show
      }
    })();
    return () => {
      cancelled = true;
    };
    // messages excluded intentionally — this effect only runs on session change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionParam, fromParam]);

  // Pick up a seed message handed off from another screen (PDP critique chip
  // or composer). Fires once per seed value.
  const handledSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!seedParam) return;
    if (handledSeedRef.current === seedParam) return;
    handledSeedRef.current = seedParam;
    const attachment = pinLabelParam
      ? {
          imageUrl: pinImageParam,
          label: pinLabelParam,
          productId: pinIdParam,
          productName: pinNameParam,
          productPrice: pinPriceParam,
        }
      : undefined;
    // Defer slightly so the session effect can stamp sessionIdRef first.
    setTimeout(
      () => runStreamingTurn(seedParam, attachment, undefined, undefined, "seed"),
      50,
    );
  }, [
    seedParam,
    pinImageParam,
    pinLabelParam,
    pinIdParam,
    pinNameParam,
    pinPriceParam,
  ]);

  const lastTurn = messages[messages.length - 1] ?? null;
  const lastStatus = lastTurn?.status ?? null;
  const hasConversation = messages.length > 0;
  const isStreaming =
    lastTurn?.isStream === true && lastTurn.streamDone !== true;
  const isBusy =
    lastStatus === "searching" ||
    lastStatus === "analyzing" ||
    isStreaming ||
    uploading;
  const hasResults = lastStatus === "results";
  const isEmpty = lastStatus === "empty";
  const canSend =
    !isBusy && !capLocked && (text.trim().length > 0 || pickedImage !== null);
  // Unified pinned attachment: works for both mock products and SSE products.
  // SSE pins use a composite id "<turnId>:<index>" so we look up by parsing it.
  const pinnedAttachment: {
    thumbColor?: string;
    imageUrl?: string;
    label: string;
    productId?: string;
    productName?: string;
    productPrice?: string;
  } | null = (() => {
    // 큐레이션 핀 우선 — 빈 상태에서 온 상품은 messages 밖에 있다.
    if (pinnedCurationProduct) {
      return {
        thumbColor: pinnedCurationProduct.colorHint,
        imageUrl: pinnedCurationProduct.imageUri,
        label: pinnedCurationProduct.brand,
        productId: pinnedCurationProduct.id,
        productName: pinnedCurationProduct.name,
      };
    }
    if (!pinnedId) return null;
    const mockHit = lastTurn?.results?.find((p) => p.id === pinnedId);
    if (mockHit) {
      return { thumbColor: mockHit.colorHint, label: mockHit.brand };
    }
    const [maybeTurnId, maybeIdx] = pinnedId.split(":");
    if (maybeTurnId && maybeIdx) {
      const turn = messages.find((t) => String(t.id) === maybeTurnId);
      const sse = turn?.streamProducts?.[Number(maybeIdx)];
      if (sse) {
        // caption is HTML-ish; the brand line is usually the bold prefix.
        const stripped = sse.caption.replace(/<[^>]+>/g, "").trim();
        const label = stripped.split("\n")[0] || "선택한 상품";
        // Carry the product_id so the ReAct agent can deep-link via `#id`
        // instead of inferring from the label (which it then misreads as a
        // request for the product page and refuses).
        return {
          imageUrl: sse.image_url,
          label: label.slice(0, 20),
          productId: sse.product_id != null ? String(sse.product_id) : undefined,
        };
      }
    }
    return null;
  })();
  // Legacy name kept for the few mock-only branches still using `.colorHint`.
  const pinnedProduct =
    pinnedCurationProduct ??
    (pinnedId ? (lastTurn?.results?.find((p) => p.id === pinnedId) ?? null) : null);
  const critiqueChips = CRITIQUE_CHIPS;

  // 골든셋 유도 칩 (빈 상태 전용) — 온보딩에서 받은 성별로 분기.
  // GET /v1/curation 이 구좌(CurationSheet)와 칩을 함께 공급한다. 서버 칩이
  // 없으면(오프라인, men 골든셋 등록 전 빈 배열) 로컬 상수 폴백 —
  // 여성 = 문형 채택 셋 / 남성 = 화이트리스트 셋 (src/state/suggestion-chips.ts).
  const [onboardGender, setOnboardGender] = useState<OnboardingGender | null>(
    null,
  );
  useEffect(() => {
    void readOnboardingGender().then(setOnboardGender);
  }, []);
  // 성별이 없으면(온보딩 안 한 기존 로그인 유저 등) 'women' 기본값으로 요청.
  // 서버는 프로필 성별을 우선하므로(있으면 그걸 씀) 안전하고, 프로필 성별도
  // 없는 유저의 422(→ 스켈레톤 무한 로딩)를 막는다. useCuration·더보기 양쪽 공용.
  const curationGender: OnboardingGender = onboardGender ?? "women";
  const {
    sections: curationSections,
    chips: curationChips,
    loading: curationLoading,
  } = useCuration(curationGender);
  const suggestionChips = curationChips ?? chipsForGender(onboardGender);

  // 빈 상태 히어로 표제 — 마운트당 1회 랜덤 (curation-lab Hero3 관례 동일).
  const heroGreeting = useMemo(
    () => HERO_GREETINGS[Math.floor(Math.random() * HERO_GREETINGS.length)],
    [],
  );

  // Composer placeholder — one random pick per state context. Recomputes
  // only when the relevant state combo changes (busy ↔ idle, results ↔ empty),
  // so the user doesn't see it jitter mid-typing.
  const composerPlaceholder = useMemo(() => {
    if (capLocked) return "오늘 사용량이 다 소진됐어요";
    if (isBusy) {
      const pool = lastSendFromCritiqueRef.current
        ? BUSY_CRITIQUE_HINTS
        : BUSY_GENERAL_HINTS;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    if (pinnedProduct) return "또는 직접 입력...";
    const pool = hasResults ? IDLE_AFTER_RESULTS_HINTS : IDLE_INITIAL_HINTS;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [capLocked, isBusy, hasResults, pinnedProduct]);

  const kbHeight = useKeyboardHeight();

  // Auto-scroll to bottom whenever messages, status, or keyboard change.
  // 대화가 있을 때만 — 대화 없는(큐레이션만) 상태에서 scrollToEnd 하면
  // 큐레이션이 위로 밀려 올라가므로, 최초 진입은 최상단(큐레이션)을 유지한다.
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(t);
  }, [messages, kbHeight]);

  // 컴포저 위 플로팅 '큐레이션' 버튼 — 최상단 큐레이션으로 복귀.
  const scrollToCuration = () => {
    Haptic.light();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // 큐레이션 블록이 화면에 5% 미만 남았을 때만 헤더 '큐레이션' 버튼 노출.
  // 큐레이션 블록의 위치(y)·높이를 onLayout 으로 재고, 스크롤 시 뷰포트와
  // 겹치는 양(overlap)을 화면 높이 대비로 판정한다. 최상단(다 보임)엔 안 뜨고,
  // 스크롤을 내려 큐레이션이 거의 화면 밖으로 나가면 뜬다.
  const curationLayoutRef = useRef({ y: 0, height: 0 });
  const [showJumpTop, setShowJumpTop] = useState(false);
  const handleHomeScroll = (e: {
    nativeEvent: {
      contentOffset: { y: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    const { y: cTop, height: cH } = curationLayoutRef.current;
    if (cH <= 0) return;
    const scrollY = e.nativeEvent.contentOffset.y;
    const vpH = e.nativeEvent.layoutMeasurement.height;
    // 큐레이션 블록[cTop, cTop+cH] 과 뷰포트[scrollY, scrollY+vpH] 의 겹침.
    const overlap = Math.max(
      0,
      Math.min(scrollY + vpH, cTop + cH) - Math.max(scrollY, cTop),
    );
    const next = overlap < vpH * 0.05;
    setShowJumpTop((prev) => (prev === next ? prev : next));
  };

  const updateTurn = (id: number, patch: Partial<Turn>) => {
    setMessages((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const runFinalSearch = (turnId: number) => {
    updateTurn(turnId, { status: "searching" });
    setTimeout(() => {
      const wouldBeEmpty = filter.priceMax < 100;
      if (wouldBeEmpty) {
        Haptic.warning();
        updateTurn(turnId, {
          status: "empty",
          results: [],
          narrowing: null,
        });
      } else {
        Haptic.success();
        updateTurn(turnId, {
          status: "results",
          results: MOCK_PRODUCTS,
          narrowing: MOCK_NARROWING,
        });
      }
    }, 2200);
  };

  const startTurn = (msg: UserMessage) => {
    const turnId = nextIdRef.current++;
    const hasImageInput =
      !!(msg.imageUri || msg.colorHint) || containsVisionLink(msg.text);
    const turn: Turn = {
      id: turnId,
      user: msg,
      status: hasImageInput ? "analyzing" : "searching",
    };
    setMessages((prev) => [...prev, turn]);
    setText("");
    setPickedImage(null);
    pickedAssetRef.current = null;
    clearPin();

    if (hasImageInput) {
      setTimeout(() => {
        updateTurn(turnId, {
          status: "picking",
          visionItems: MOCK_VISION_ITEMS,
        });
        Haptic.light();
      }, 1300);
    } else {
      // Status already 'searching' — kick off result resolution.
      setTimeout(() => runFinalSearch(turnId), 0);
    }
  };

  const handlePickPhoto = async () => {
    if (isBusy) return;
    Haptic.light();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Haptic.error();
      Alert.alert(
        "권한 필요",
        "갤러리 접근 권한이 필요해요. 설정에서 허용해줘.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedImage(asset.uri);
      // Best-effort fallbacks; the server validates again.
      const filename =
        asset.fileName ||
        asset.uri.split("/").pop()?.split("?")[0] ||
        `image-${Date.now()}.jpg`;
      pickedAssetRef.current = { filename };
    }
  };

  const handleOpenFilter = () => {
    if (isBusy) return;
    Haptic.light();
    router.push("/filter");
  };

  const handlePickItem = (turnId: number, item: VisionItem) => {
    Haptic.medium();
    updateTurn(turnId, { pickedItem: item });
    runFinalSearch(turnId);
  };

  const handleLoosen = () => {
    Haptic.medium();
    setFilter({ ...filter, priceMax: PRICE_MAX });
    if (lastTurn) startTurn(lastTurn.user);
  };

  const handleSimilarMood = () => {
    Haptic.medium();
    if (lastTurn) startTurn(lastTurn.user);
  };

  const handleNarrowingPick = (opt: string) => {
    if (isBusy) return;
    Haptic.medium();
    startTurn({ text: opt });
  };

  const dismissNarrowing = (turnId: number) => {
    Haptic.light();
    updateTurn(turnId, { narrowing: null });
  };

  const handleSend = async () => {
    if (!canSend || uploading) return;
    // 게스트: 사용자 말풍선만 먼저 렌더링해서 "보냈다"는 체감을 준 뒤,
    // 짧은 딜레이 후 로그인 바텀시트 유도 (Kimi 방식).
    if (authStatus !== "authenticated") {
      const trimmedGuest = text.trim();
      const localUri = pickedImage;
      Haptic.medium();
      const turnId = nextIdRef.current++;
      const guestTurn: Turn = {
        id: turnId,
        user: {
          text: trimmedGuest,
          imageUri: localUri ?? undefined,
        },
        // "results" + 빈 results 배열 → 봇 사이드는 아무것도 렌더하지 않음.
        status: "results",
        isStream: false,
        streamText: "",
        streamProducts: [],
        streamDone: true,
        results: [],
      };
      setMessages((prev) => [...prev, guestTurn]);
      setText("");
      setPickedImage(null);
      pickedAssetRef.current = null;
      // 기획 7/23: 게이트 노출 이벤트 — 퍼널이 어디서 끊기는지 관측.
      trackEvent("login_gate_shown", {
        trigger: "composer",
        session_id: sessionIdRef.current,
      });
      setTimeout(() => router.push("/login"), 450);
      return;
    }
    const trimmed = text.trim();
    const hasImage = pickedImage !== null;
    Haptic.medium();
    lastSendFromCritiqueRef.current = false;
    // search_query 트래킹은 runStreamingTurn(모든 검색 경로의 합류점)에서
    // 1회 발사 — 기존엔 여기(typed 경로)만 찍혀 칩/재시도/시드 검색이
    // 전부 미기록이었다 (기획 2026-07-23).

    // If the user attached a photo, materialize it via POST /v1/uploads
    // before opening the SSE turn so the server can anchor on a stable
    // image_url instead of a transient local URI.
    let serverImageUrl: string | undefined;
    const localUri = pickedImage;
    if (hasImage && localUri && pickedAssetRef.current) {
      setUploading(true);
      try {
        serverImageUrl = await uploadImage(
          localUri,
          pickedAssetRef.current.filename,
        );
      } catch (e) {
        Haptic.error();
        setUploading(false);
        // Surface the actual reason — 413 (too large) deserves a different
        // hint than a generic network failure.
        const detail = e instanceof ApiError ? e.detail : '';
        const isTooLarge = detail.includes('upload_too_large');
        showBanner({
          id: "upload-failure",
          priority: "error",
          title: isTooLarge ? "이미지가 너무 커요" : "이미지 업로드 실패",
          subtitle: isTooLarge
            ? "10MB 이하로 줄여서 다시 시도해주세요."
            : "잠시 후 다시 시도해주세요.",
          autoDismissMs: 4000,
        });
        return;
      }
      setUploading(false);
    }

    setText("");
    setPickedImage(null);
    pickedAssetRef.current = null;
    runStreamingTurn(trimmed, undefined, {
      localImageUri: localUri ?? undefined,
      serverImageUrl,
    });
  };

  const runStreamingTurn = (
    trimmed: string,
    overrideAttachment?: {
      imageUrl?: string;
      thumbColor?: string;
      label: string;
      productId?: string;
      productName?: string;
      productPrice?: string;
    },
    imagePayload?: {
      /** Local file URI used for instant bubble preview. */
      localImageUri?: string;
      /** Final CloudFront URL from /v1/uploads — sent to chat as attached_image_url. */
      serverImageUrl?: string;
    },
    /**
     * 골든셋 유도 칩 경로 — 버블에는 `trimmed`(한국어 label)를 그대로 보여
     * 주되, 서버 전송 텍스트만 검증된 영어 쿼리로 바꿔치기한다. 임베딩에
     * 한국어 label 이 흘러가면 골든셋 검증이 무효가 되기 때문 (칩 계약).
     */
    serverQueryOverride?: string,
    /** 검색 진입 경로 (기획 7/23) — 디깅 시작 방식 분류.
     *  typed=컴포저 직접 입력 / chip=골든셋 유도 칩 / critique=보정 칩 /
     *  seed=PDP·그리드 핸드오프 / retry=실패 재시도. */
    entryPoint: "typed" | "chip" | "critique" | "seed" | "retry" = "typed",
  ) => {
    // 비로그인 상태에선 어떤 경로로 들어오든 (composer send / seedParam /
    // critique / retry) 로그인 화면으로 유도. Apple 5.1.1(v) 대응 —
    // 계정 없이도 홈 진입은 가능하되 실제 검색은 로그인 후 실행.
    if (authStatus !== "authenticated") {
      trackEvent("login_gate_shown", {
        trigger: "composer",
        entry_point: entryPoint,
        session_id: sessionIdRef.current,
      });
      router.push("/login");
      return;
    }
    // 캡 잠금 상태에선 어떤 경로로 들어오든 (composer send / seedParam /
    // critique / retry) 서버 호출 금지. 새 채팅에서 seed 로 들어오는 케이스
    // 도 여기 방어선 하나로 막힌다.
    if (capLocked) return;
    clearBanner("request-failure");
    // Explicit override wins (e.g. handoff from PDP). Otherwise use the
    // currently-pinned product from the composer.
    const attachment = overrideAttachment ?? pinnedAttachment;
    // 기획 스펙: search_query — session_id, query, user_id, ts 필수
    // (user_id + ts 는 analytics 헬퍼 자동 첨부). 모든 실검색 경로가 이
    // 함수로 합류하므로 여기서 1회 발사 (guard 통과 = 실제 실행된 검색만).
    // pinned_product_id 는 앵커 디깅(케이스 ⑤) 조인 키 (기획 7/23).
    queryIndexRef.current += 1;
    trackEvent("search_query", {
      session_id: sessionIdRef.current,
      query: trimmed,
      query_index: queryIndexRef.current,
      has_image: Boolean(
        imagePayload?.serverImageUrl || imagePayload?.localImageUri,
      ),
      has_pinned_product: attachment != null,
      pinned_product_id: attachment?.productId ?? null,
      entry_point: entryPoint,
      char_len: trimmed.length,
      gender_filter: filter.gender,
    });
    // 서버가 vision + link_resolve 를 거치는 케이스는 첫 이벤트까지 10s
    // 넘게 걸릴 수 있어 stall 임계치를 20s 로 늘린다. 순수 텍스트 검색은
    // 10s 유지 (embedding + search RPC 만).
    const hasMediaOrUrl =
      Boolean(imagePayload?.serverImageUrl) ||
      Boolean(imagePayload?.localImageUri) ||
      Boolean(attachment?.imageUrl) ||
      URL_RE.test(trimmed);
    const stallMs = hasMediaOrUrl
      ? STREAM_STALL_MS_MEDIA
      : STREAM_STALL_MS_TEXT;
    const turnId = nextIdRef.current++;
    const turn: Turn = {
      id: turnId,
      user: {
        text: trimmed,
        imageUri: attachment?.imageUrl ?? imagePayload?.localImageUri,
        colorHint:
          !attachment?.imageUrl &&
          !imagePayload?.localImageUri &&
          attachment?.thumbColor
            ? attachment.thumbColor
            : undefined,
      },
      status: "searching",
      isStream: true,
      streamText: "",
      streamProducts: [],
      streamDone: false,
      streamPlaceholder: (() => {
        // Image attached → vision phase reads the picture first; pin the
        // matching hint. Critique chip ("더 비슷하게"/"더 저렴하게") swaps
        // into the refine pool. Everything else rolls the general pool.
        if (imagePayload?.localImageUri || attachment?.imageUrl) {
          return "이미지에서 핏 · 색 · 무드를 읽는 중…";
        }
        const pool = lastSendFromCritiqueRef.current
          ? BUSY_CRITIQUE_HINTS
          : BUSY_GENERAL_HINTS;
        return pool[Math.floor(Math.random() * pool.length)];
      })(),
    };
    setMessages((prev) => [...prev, turn]);
    if (attachment) clearPin();
    // Server takes plain text; if a product is pinned, prefix the message so
    // the ReAct loop anchors to it.
    // Build a context-rich prefix the server's ReAct agent can anchor on.
    // We try product_id first (deterministic lookup), then brand + name + price
    // for human-readable fallback. The user only sees `trimmed` in the bubble.
    //
    // Image-only send (no typed text) hits the server's `message cannot be
    // empty` 422 guard. Substitute a sensible default for the server payload
    // while leaving the user bubble blank — the photo alone speaks for the
    // user, and we don't want a system-generated string to look like theirs.
    const hasAttachedImage = Boolean(
      attachment?.imageUrl || imagePayload?.localImageUri,
    );
    const baseText =
      trimmed.length === 0 && hasAttachedImage
        ? '이 사진이랑 비슷한 거 찾아줘'
        : trimmed;
    // 칩 경로는 override 가 전부 — attachment prefix 도 타지 않는다 (칩은
    // 항상 상품 핀 없이 발사되는 통제된 입력).
    let serverText = serverQueryOverride ?? baseText;
    if (!serverQueryOverride && attachment) {
      const parts: string[] = [];
      const pid = (attachment as { productId?: string }).productId;
      const pname = (attachment as { productName?: string }).productName;
      const pprice = (attachment as { productPrice?: string }).productPrice;
      if (pid) parts.push(`#${pid}`);
      parts.push(attachment.label);
      if (pname) parts.push(pname);
      if (pprice) parts.push(`₩${Number(pprice).toLocaleString("ko-KR")}`);
      serverText = `[${parts.join(" · ")}] ${baseText}`;
    }

    const patch = (mut: (t: Turn) => Partial<Turn>) =>
      setMessages((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, ...mut(t) } : t)),
      );

    // If the user message contains a URL and we don't already have an
    // attachment image, try to grab the og:image for a chat-bubble preview.
    if (!attachment?.imageUrl) {
      const url = extractFirstUrl(trimmed);
      if (url) {
        void fetchLinkPreviewImage(url).then((imageUrl) => {
          if (!imageUrl) return;
          patch((t) => ({ user: { ...t.user, imageUri: imageUrl } }));
        });
      }
    }

    // 이 턴에서 이미 캡 소진 이벤트를 봤는지. 이 플래그가 켜져 있으면
    // 이후 onError 는 침묵 — 서버가 cap_reached 이벤트 뒤에 스트림을 닫으며
    // 클라이언트에서 파싱 에러로 이어질 때 "요청을 처리하지 못했어요" 배너
    // 가 캡 소진 배너를 덮어버리는 걸 방지.
    let capHitThisTurn = false;
    // 타임아웃 관리 — 이벤트 도착 시마다 리셋, 정적으로 오래 걸리면 발동.
    const killTimeout = () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = null;
      }
    };
    const fireStall = () => {
      streamRef.current?.cancel();
      streamRef.current = null;
      killTimeout();
      // 낙관적 어시스턴트 스피너 제거 + 유저 버블도 함께 정리.
      setMessages((prev) => prev.filter((t) => t.id !== turnId));
      // 캡 소진 배너가 이미 떠 있는 상황이면 에러 배너로 덮지 않음.
      if (capHitThisTurn) return;
      Haptic.error();
      showBanner({
        id: "request-failure",
        priority: "error",
        title: "응답이 늦어져 요청을 취소했어요",
        subtitle: "다시 시도해주세요",
        action: {
          label: "다시 시도",
          onPress: () =>
            runStreamingTurn(trimmed, undefined, undefined, undefined, "retry"),
        },
      });
    };
    const bumpTimeout = () => {
      killTimeout();
      streamTimeoutRef.current = setTimeout(fireStall, stallMs);
    };

    const handlers = {
      onSession: (sessionId: string, cap?: CapMeta) => {
        bumpTimeout();
        const wasNewThread = sessionIdRef.current !== sessionId;
        sessionIdRef.current = sessionId;
        setAnalyticsSessionId(sessionId);
        if (wasNewThread && !threadStartFiredRef.current) {
          // 이번 로그인 후 첫 스레드면 is_new_user=true 로 태그.
          const isNewUser = messages.length === 0;
          threadStartFiredRef.current = true;
          queryIndexRef.current = 0;
          trackEvent("thread_start", {
            session_id: sessionId,
            is_new_user: isNewUser,
          });
        } else if (wasNewThread) {
          // 두 번째 이후 스레드도 카운터 리셋.
          queryIndexRef.current = 0;
          trackEvent("thread_start", {
            session_id: sessionId,
            is_new_user: false,
          });
        }
        if (cap) {
          applyCapMeta(cap);
          if (isCapExhausted(cap)) {
            // 이미 소진 상태로 세션 시작 (이전 세션이 캡을 다 썼거나,
            // 앱 재시작 후 처음 붙었을 때). 90% 안내는 정리하고 소진 배너
            // 를 띄워 유저가 컴포저 잠긴 이유를 즉시 볼 수 있게 한다.
            capHitThisTurn = true;
            clearBanner("chat-cap-warn");
            showBanner({
              id: "chat-cap-reached",
              priority: "billing",
              kicker: "DAILY CAP",
              title: "오늘 무료 사용량을 다 썼어요",
              subtitle: "오늘 자정 이후 다시 시작돼요",
            });
          } else {
            // 잔여 크레딧이 있음 → 이전에 남아 있던 소진 배너 제거.
            clearBanner("chat-cap-reached");
            // 90% 임계치 경고
            const used = cap.cap_used ?? 0;
            const total = cap.daily_cap ?? 0;
            const ratio = total > 0 ? used / total : 0;
            if (ratio >= 0.9) {
              showBanner({
                id: "chat-cap-warn",
                priority: "notice",
                kicker: "DAILY CAP",
                title: "일일 사용량의 90%를 사용했어요",
                subtitle: "오늘 자정 이후 다시 시작돼요",
              });
            } else {
              clearBanner("chat-cap-warn");
            }
          }
        }
      },
      onTextDelta: (delta: string) => {
        bumpTimeout();
        patch((t) => ({ streamText: (t.streamText ?? "") + delta }));
      },
      onProgress: () => {
        // Silent heartbeat — server is still alive, just crunching (e.g. Vision).
        bumpTimeout();
      },
      onProduct: (product: ProductRef) => {
        bumpTimeout();
        patch((t) => ({
          streamProducts: appendUniqueProduct(t.streamProducts, product),
        }));
      },
      onSearch: (searchId: string, total?: number) => {
        bumpTimeout();
        patch(() => ({
          streamSearchId: searchId,
          streamSearchTotal: total,
        }));
      },
      onClarify: (payload: ClarifyPayload) => {
        // Inline-keyboard prompt (pick_item carousel / gender ask /
        // category pick / ...). Render as buttons in the assistant bubble;
        // handleClarifyPick resumes the turn via POST /callback.
        bumpTimeout();
        patch(() => ({ streamClarify: payload }));
      },
      onCapReached: (info: CapReachedInfo) => {
        // Server skipped the graph run for this turn; just end the streaming
        // state cleanly (no assistant reply) and surface a billing banner.
        // 업그레이드 CTA 는 IAP 도입 전까지 비활성 — 안내만 표시.
        killTimeout();
        capHitThisTurn = true;
        patch(() => ({ streamDone: true, status: "results" as const }));
        streamRef.current = null;
        Haptic.warning();
        // 기획 스펙: cap_banner_shown — cum_success_sessions, total_threads,
        // free_limit_version 필수. cum_success_sessions 는 서버 cap.used 로,
        // total_threads 는 유저 전체 스레드 수 (프론트가 정확히 몰라 서버
        // 이벤트 payload 로 대체 — 추후 서버 확장).
        trackEvent("cap_banner_shown", {
          user_tier: info.user_tier,
          cum_success_sessions: info.used,
          total_threads: info.used,
          free_limit_version: FREE_LIMIT_VERSION,
        });
        // 앱 전역 캡 상태 잠금 (context 가 reset_at 까지 unlock 타이머도 관리).
        markCapReached(info);
        // 90% 안내 배너가 떠 있었다면 정식 소진 배너가 이를 덮도록 정리.
        clearBanner("chat-cap-warn");
        showBanner({
          id: "chat-cap-reached",
          priority: "billing",
          kicker: "DAILY CAP",
          title: "오늘 무료 사용량을 다 썼어요",
          subtitle: "오늘 자정 이후 다시 시작돼요",
          // autoDismiss 없음 — 유저가 컴포저 잠금 이유를 계속 볼 수 있어야 함.
          // action 비활성: IAP 들어오면 다시 활성화
          // action: {
          //   label: "업그레이드",
          //   onPress: () => router.push("/billing"),
          // },
        });
      },
      onDone: () => {
        killTimeout();
        patch(() => ({ streamDone: true, status: "results" as const }));
        streamRef.current = null;
      },
      onError: () => {
        killTimeout();
        streamRef.current = null;
        // 캡 소진으로 스트림이 닫힌 케이스면 캡 배너가 이미 떠 있어야 함.
        // 여기서 "요청을 처리하지 못했어요" 를 추가로 띄우면 우선순위상 그
        // 배너가 캡 배너를 덮어 유저가 진짜 원인을 못 봄. 조용히 종료.
        if (capHitThisTurn) {
          setMessages((prev) => prev.filter((t) => t.id !== turnId));
          return;
        }
        Haptic.error();
        setMessages((prev) => prev.filter((t) => t.id !== turnId));
        showBanner({
          id: "request-failure",
          priority: "error",
          title: "요청을 처리하지 못했어요",
          action: {
            label: "다시 시도",
            onPress: () =>
            runStreamingTurn(trimmed, undefined, undefined, undefined, "retry"),
          },
        });
      },
    };

    // Filter values from the composer chip. '공용' = 성별 제한 없이 → 서버에
    // undefined 로 보내야 taste_profile.gender pin 이 반영되고, pin 이 없으면
    // gender card 로 물어볼 수 있다 (SPEC-GENDER-PIN-001). 'women'/'men' 은
    // 유저가 명시한 선택이므로 그대로 전달. priceMax 는 슬라이더 최대치에서
    // 상한 없음. 서버는 KRW 원 단위 기대.
    const filterOpts = {
      gender: filter.gender === "unisex" ? undefined : filter.gender,
      priceMaxKrw:
        filter.priceMax >= PRICE_MAX ? undefined : filter.priceMax * 10_000,
      // 유저가 직접 업로드한 이미지가 최우선. 없으면 pin 된 상품(리스트탭 /
       // SSE product pin) 의 공개 이미지 URL 을 서버에 함께 넘겨서 비전 단계에
       // 서 실제 사진을 볼 수 있게 한다. 안 넘기면 "#id 라벨" 텍스트만 남아서
       // 서버가 "사진이 안 보인다" 고 응답함.
      attachedImageUrl:
        imagePayload?.serverImageUrl ?? attachment?.imageUrl ?? undefined,
    };

    // 첫 이벤트가 오기 전 서버가 조용히 멈춰버리는 케이스 대비 즉시 착수.
    bumpTimeout();
    streamRef.current = sessionIdRef.current
      ? sendMessageStream(
          sessionIdRef.current,
          serverText,
          handlers,
          filterOpts,
        )
      : createSessionStream(serverText, handlers, filterOpts);
    void streamRef.current.promise.catch(() => {});
  };

  /**
   * User tapped a `clarify` event option (pick_item card, gender pill, ...).
   * Clears the prior turn's buttons (a decision was made) and SPAWNS A NEW
   * TURN whose user bubble shows the tapped `label` — this mirrors the
   * server, which persists `label` as a user chat turn. The resumed callback
   * stream fills the new turn's assistant portion.
   */
  const handleClarifyPick = (
    priorTurnId: number,
    callback: string,
    label: string,
  ) => {
    if (capLocked) return; // 캡 잠금 시 clarify 콜백도 서버 호출 금지
    const sid = sessionIdRef.current;
    if (!sid) return;
    Haptic.medium();

    // Append this option to the prior turn's "already searched" set. Other
    // options stay interactive so the user can scroll back and try another
    // item from the same detection.
    setMessages((prev) =>
      prev.map((t) => {
        if (t.id !== priorTurnId) return t;
        const prevPicks = t.streamClarifyPicks ?? [];
        if (prevPicks.includes(callback)) return t;
        return { ...t, streamClarifyPicks: [...prevPicks, callback] };
      }),
    );

    // Spawn a new turn whose user bubble echoes what the user "said" by
    // tapping. The stream that follows fills its assistant portion.
    const newTurnId = nextIdRef.current++;
    const newTurn: Turn = {
      id: newTurnId,
      user: { text: label },
      status: "searching",
      isStream: true,
      streamText: "",
      streamProducts: [],
      streamDone: false,
      streamPlaceholder:
        BUSY_GENERAL_HINTS[
          Math.floor(Math.random() * BUSY_GENERAL_HINTS.length)
        ],
    };
    setMessages((prev) => [...prev, newTurn]);

    const patch = (mut: (t: Turn) => Partial<Turn>) =>
      setMessages((prev) =>
        prev.map((t) => (t.id === newTurnId ? { ...t, ...mut(t) } : t)),
      );

    // 콜백 스트림도 홈 스트림과 동일한 stall 타임아웃 관리.
    let capHitThisCb = false;
    const killCbTimeout = () => {
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = null;
      }
    };
    const fireCbStall = () => {
      streamRef.current?.cancel();
      streamRef.current = null;
      killCbTimeout();
      setMessages((prev) => prev.filter((t) => t.id !== newTurnId));
      if (capHitThisCb) return;
      Haptic.error();
      showBanner({
        id: "request-failure",
        priority: "error",
        title: "응답이 늦어져 요청을 취소했어요",
        subtitle: "다시 시도해주세요",
        action: {
          label: "다시 시도",
          onPress: () => handleClarifyPick(priorTurnId, callback, label),
        },
      });
    };
    const bumpCbTimeout = () => {
      killCbTimeout();
      // callback 스트림은 이전 턴 컨텍스트 재개라 vision 이 다시 돌지는 않지만,
      // agent 가 refine_search 등으로 서너 초 걸릴 수 있어 넉넉한 20s 로 통일.
      streamTimeoutRef.current = setTimeout(
        fireCbStall,
        STREAM_STALL_MS_MEDIA,
      );
    };
    bumpCbTimeout();

    streamRef.current = sendCallbackStream(sid, callback, label, {
      onSession: (_sid, cap) => {
        bumpCbTimeout();
        if (!cap) return;
        applyCapMeta(cap);
        if (isCapExhausted(cap)) {
          capHitThisCb = true;
          clearBanner("chat-cap-warn");
          showBanner({
            id: "chat-cap-reached",
            priority: "billing",
            kicker: "DAILY CAP",
            title: "오늘 무료 사용량을 다 썼어요",
            subtitle: "오늘 자정 이후 다시 시작돼요",
          });
        }
      },
      onTextDelta: (delta) => {
        bumpCbTimeout();
        patch((t) => ({ streamText: (t.streamText ?? "") + delta }));
      },
      onProgress: () => {
        bumpCbTimeout();
      },
      onProduct: (product) => {
        bumpCbTimeout();
        patch((t) => ({
          streamProducts: appendUniqueProduct(t.streamProducts, product),
        }));
      },
      onSearch: (searchId, total) => {
        bumpCbTimeout();
        patch(() => ({
          streamSearchId: searchId,
          streamSearchTotal: total,
        }));
      },
      onClarify: (payload) => {
        bumpCbTimeout();
        patch(() => ({ streamClarify: payload }));
      },
      onCapReached: (info) => {
        killCbTimeout();
        capHitThisCb = true;
        patch(() => ({ streamDone: true, status: "results" as const }));
        streamRef.current = null;
        Haptic.warning();
        markCapReached(info);
        clearBanner("chat-cap-warn");
        showBanner({
          id: "chat-cap-reached",
          priority: "billing",
          kicker: "DAILY CAP",
          title: "오늘 무료 사용량을 다 썼어요",
          subtitle: "오늘 자정 이후 다시 시작돼요",
        });
      },
      onDone: () => {
        killCbTimeout();
        patch(() => ({ streamDone: true, status: "results" as const }));
        streamRef.current = null;
      },
      onError: () => {
        killCbTimeout();
        streamRef.current = null;
        setMessages((prev) => prev.filter((t) => t.id !== newTurnId));
        if (capHitThisCb) return; // 캡 배너가 이미 떠 있음 — 에러 배너 억제
        Haptic.error();
        showBanner({
          id: "request-failure",
          priority: "error",
          title: "요청을 처리하지 못했어요",
          action: {
            label: "다시 시도",
            onPress: () => handleClarifyPick(priorTurnId, callback, label),
          },
        });
      },
    });
    void streamRef.current.promise.catch(() => {});
  };

  const handleCritique = (id: string) => {
    if (isBusy) return;
    const chip = CRITIQUE_CHIPS.find((c) => c.id === id);
    const label = chip?.label;
    if (!label) return;
    Haptic.medium();
    lastSendFromCritiqueRef.current = true;
    // For real SSE turns, send the chip label as the next user message —
    // server's ReAct loop handles the refine intent. The pinned-product
    // anchor pattern stays available for the mock pipeline if needed.
    if (sessionIdRef.current) {
      runStreamingTurn(label, undefined, undefined, undefined, "critique");
      return;
    }
    if (pinnedProduct) {
      startTurn({ text: label, colorHint: pinnedProduct.colorHint });
    } else {
      startTurn({ text: label });
    }
  };

  const handlePin = (p: Product, searchId?: string | null) => {
    if (capLocked) return;
    // 핀 ON 시에만 발사 — 앵커 디깅(케이스 ⑤)의 시작점 기록 (기획 7/23).
    if (pinnedId !== p.id) {
      trackEvent("product_pin", {
        product_id: String(p.id),
        source: "search",
        search_id: searchId ?? null,
        session_id: sessionIdRef.current,
      });
    }
    setPinnedId((prev) => (prev === p.id ? null : p.id));
  };

  // 컴포저 핀 해제 — 결과 핀(pinnedId)과 큐레이션 핀(pinnedCurationProduct)
  // 어느 쪽이든 한 번에 비운다.
  const clearPin = () => {
    setPinnedId(null);
    setPinnedCurationProduct(null);
  };

  // 큐레이션 카드 + 핀 토글 — 같은 상품을 다시 누르면 해제. 컴포저 위에
  // 상품 칩이 뜨고, 전송 시 handleSend 의 비로그인 게이트가 로그인 시트로
  // 보낸다 (로그인 상태면 정상 검색 앵커로 사용).
  const handlePinCuration = (p: Product, sectionKey?: string) => {
    if (capLocked) return;
    // 핀 ON 시에만 발사 — 큐레이션 발 앵커 디깅의 시작점 (기획 7/23:
    // "큐레이션 구경 → 첫 디깅 전환" 퍼널의 두 번째 스텝).
    if (pinnedCurationProduct?.id !== p.id) {
      trackEvent("product_pin", {
        product_id: String(p.id),
        source: "curation",
        section_id: sectionKey ?? null,
        session_id: sessionIdRef.current,
      });
    }
    setPinnedId(null);
    setPinnedCurationProduct((prev) => (prev?.id === p.id ? null : p));
  };

  // 큐레이션 상품 탭 — 비로그인도 PDP 진입 가능(서버 GET /v1/products/{id}
  // optional-auth 배포 완료, 2026-07-17). 찜·전송 같은 액션만 로그인 게이트.
  // source/section_id 를 PDP 에 넘겨 product_view·outbound_click 의 발화
  // 문맥(큐레이션 vs 검색)을 보존한다 (기획 7/23).
  const handleCurationPress = (p: Product, sectionKey?: string) => {
    const q = sectionKey
      ? `?source=curation&section_id=${encodeURIComponent(sectionKey)}`
      : "?source=curation";
    router.push(`/product/${p.id}${q}`);
  };

  // 큐레이션 상품 찜 — 로그인 상태면 위시리스트 토글, 아니면 로그인 시트.
  const handleCurationSave = (p: Product, sectionKey?: string) => {
    if (authStatus !== "authenticated") {
      trackEvent("login_gate_shown", {
        trigger: "wishlist",
        source: "curation",
        section_id: sectionKey ?? null,
        product_id: String(p.id),
      });
      router.push("/login");
      return;
    }
    void toggleWishlist(String(p.id));
  };

  const handleRemovePreview = () => {
    Haptic.light();
    setPickedImage(null);
    pickedAssetRef.current = null;
  };

  const topPad = insets.top + 52;

  return (
    <View style={styles.root}>
      {/* 홈 = 단일 스크롤. 큐레이션(발견 구좌)이 항상 최상단에 있고, 사용자가
          요청을 보내면 그 아래로 대화가 이어붙는다. 최초 진입은 최상단
          유지(auto-scroll 가드), 대화 후엔 헤더 '큐레이션' 버튼으로 복귀. */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: topPad + 16,
          paddingBottom: insets.bottom + 180 + kbHeight,
        }}
        keyboardShouldPersistTaps="handled"
        // 스크롤(드래그) 시작하는 순간 키보드 내려감. 흔한 iOS 메시징 앱 UX.
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScroll={handleHomeScroll}
        scrollEventThrottle={16}
      >
        {/* 히어로 표제 + 큐레이션 구좌 — '메인 홈'에서만. 히스토리에서 연
            과거 채팅(resumedFromHistory)에는 채팅 내용만 보인다. */}
        {!resumedFromHistory && (
          <View
            style={styles.curationBlock}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              curationLayoutRef.current = { y, height };
            }}
          >
            <Text style={styles.emptyHeroTitle} numberOfLines={2}>
              {heroGreeting}
            </Text>
            <CurationSheet
              sections={curationSections}
              loading={curationLoading}
              pinnedProductId={pinnedCurationProduct?.id ?? null}
              onPressProduct={handleCurationPress}
              onPinProduct={handlePinCuration}
              onSaveProduct={handleCurationSave}
              onSeeMore={(section) => {
                const q = [
                  `title=${encodeURIComponent(section.title)}`,
                  `gender=${curationGender}`,
                ];
                router.push(`/curation/${section.key}?${q.join("&")}`);
              }}
              isSaved={(id) => isWishlisted(id)}
            />
          </View>
        )}

        {hasConversation && (
          <View
            style={[
              styles.conversationBlock,
              // 큐레이션이 위에 있을 때만 구분선/여백. 과거 채팅(큐레이션
              // 없음)은 화면 최상단이라 구분선 없이 바로 시작.
              !resumedFromHistory && styles.conversationDivider,
            ]}
          >
          {messages.map((turn) => {
            const isLast = turn.id === lastTurn?.id;
            const agentText = turn.narrowing
              ? AGENT_INTRO_NARROWING
              : AGENT_INTRO_DEFAULT;

            return (
              <View key={turn.id} style={styles.turn}>
                {/* User message — combined bubble when image + text travel together
                    (e.g. anchored critique on a pinned product). */}
                {(() => {
                  const hasImg = !!(turn.user.imageUri || turn.user.colorHint);
                  const hasTxt = !!turn.user.text;
                  if (!hasImg && !hasTxt) return null;

                  if (hasImg && hasTxt) {
                    // Split: small faded thumbnail on top, text bubble below.
                    return (
                      <>
                        <View style={styles.userImageRow}>
                          {turn.user.imageUri ? (
                            <Image
                              source={{ uri: turn.user.imageUri }}
                              style={styles.userImageSmall}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[
                                styles.userImageSmall,
                                { backgroundColor: turn.user.colorHint },
                              ]}
                            />
                          )}
                        </View>
                        <View style={styles.userTextRow}>
                          <View style={styles.userBubble}>
                            <Text style={styles.userBubbleText}>
                              {turn.user.text}
                            </Text>
                          </View>
                        </View>
                      </>
                    );
                  }

                  if (hasImg) {
                    return (
                      <View style={styles.userImageRow}>
                        {turn.user.imageUri ? (
                          <Image
                            source={{ uri: turn.user.imageUri }}
                            style={styles.userImage}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.userImage,
                              { backgroundColor: turn.user.colorHint },
                            ]}
                          />
                        )}
                      </View>
                    );
                  }

                  return (
                    <View style={styles.userTextRow}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userBubbleText}>
                          {turn.user.text}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Analyzing */}
                {turn.status === "analyzing" && (
                  <View style={styles.botStatusRow}>
                    <PixelSpinner pixelSize={4} />
                    <ShimmerText style={styles.botStatusText}>
                      {ANALYZE_HINT}
                    </ShimmerText>
                  </View>
                )}

                {/* Picker — kept visible after pick so users can scroll back
                    and re-tap. On the active picking turn the tap pins the
                    item to that turn; elsewhere it kicks off a fresh search. */}
                {turn.visionItems && (
                  <View style={styles.pickerBlock}>
                    <Text style={styles.pickerPrompt}>
                      {PICK_PROMPT(turn.visionItems.length)}
                    </Text>
                    <View style={styles.pickerGrid}>
                      {turn.visionItems.map((it) => {
                        const isPicked = turn.pickedItem?.id === it.id;
                        const onTap = () => {
                          if (isBusy) return;
                          if (isLast && turn.status === "picking") {
                            handlePickItem(turn.id, it);
                          } else {
                            Haptic.medium();
                            startTurn({ text: it.label });
                          }
                        };
                        return (
                          <Pressable
                            key={it.id}
                            style={[
                              styles.pickerBtn,
                              isPicked && styles.pickerBtnPicked,
                            ]}
                            onPress={onTap}
                          >
                            <Text style={styles.pickerEmoji}>{it.emoji}</Text>
                            <Text
                              style={[
                                styles.pickerLabel,
                                isPicked && styles.pickerLabelPicked,
                              ]}
                              numberOfLines={1}
                            >
                              {it.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Pick echoed */}
                {turn.pickedItem && (
                  <View style={styles.userTextRow}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>
                        {turn.pickedItem.label}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Searching (mock pipeline only) */}
                {turn.status === "searching" && !turn.isStream && (
                  <View style={styles.botStatusRow}>
                    <PixelSpinner pixelSize={4} />
                    <ShimmerText style={styles.botStatusText}>
                      {SEARCH_HINT}
                    </ShimmerText>
                  </View>
                )}

                {/* SSE streaming assistant — real /v1/chat */}
                {turn.isStream && (
                  <View style={styles.streamBlock}>
                    {turn.streamText &&
                      // 긴 응답이 하나의 커다란 버블로 몰리지 않도록 문단
                      // (연속된 개행) 단위로 쪼갠다. 스트리밍 중 마지막
                      // 세그먼트는 계속 자라나며 재렌더됨.
                      turn.streamText
                        .split(/\n{2,}/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((segment, i) => (
                          <View key={i} style={styles.botBubbleRow}>
                            <View style={styles.botBubble}>
                              <Text style={styles.botBubbleText}>
                                {segment}
                              </Text>
                            </View>
                          </View>
                        ))}
                    {/* Keep the searching indicator alive until the first
                        product card arrives — the assistant's prose lands
                        well before the search RPC returns, so the bubble
                        alone makes it look like the turn is finished. */}
                    {!turn.streamDone &&
                      (!turn.streamProducts ||
                        turn.streamProducts.length === 0) && (
                        <View style={styles.botStatusRow}>
                          <PixelSpinner pixelSize={4} />
                          <ShimmerText style={styles.botStatusText}>
                            {turn.streamPlaceholder ?? '비슷한 거 찾는 중…'}
                          </ShimmerText>
                        </View>
                      )}
                    {turn.streamProducts && turn.streamProducts.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.cardRow}
                      >
                        {turn.streamProducts.map((p, i) => {
                          const key = `${turn.id}:${i}`;
                          const pinned = pinnedId === key;
                          const productId = p.product_id;
                          const goPdp = () => {
                            if (productId == null) return;
                            Haptic.light();
                            const sid = sessionIdRef.current;
                            const search = turn.streamSearchId;
                            const params = [
                              sid ? `session=${encodeURIComponent(sid)}` : "",
                              search
                                ? `search_id=${encodeURIComponent(search)}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join("&");
                            const url = params
                              ? `/product/${productId}?${params}`
                              : `/product/${productId}`;
                            router.push(url as never);
                          };
                          const { brand, name, priceWon } =
                            parseStreamCaption(p.caption);
                          return (
                            <ProductCard
                              key={key}
                              product={{
                                id: key,
                                brand,
                                name,
                                priceWon,
                                colorHint: IOSColors.systemGray5,
                                imageUri: p.image_url,
                              }}
                              pinned={pinned}
                              saved={
                                productId != null &&
                                isWishlisted(String(productId))
                              }
                              onPress={goPdp}
                              onPin={
                                productId == null
                                  ? undefined
                                  : () => {
                                      if (capLocked) return;
                                      // 핀 ON 시에만 발사 — 앵커 디깅 시작점
                                      // (기획 7/23: has_pinned_product 는 결과
                                      // 플래그라 "선택 후 미검색" 이탈을 못 봄).
                                      if (!pinned) {
                                        trackEvent("product_pin", {
                                          product_id: String(productId),
                                          source: "search",
                                          search_id:
                                            turn.streamSearchId ?? null,
                                          session_id: sessionIdRef.current,
                                        });
                                      }
                                      setPinnedId((prev) =>
                                        prev === key ? null : key,
                                      );
                                    }
                              }
                              onSave={
                                productId == null
                                  ? undefined
                                  : () => void toggleWishlist(String(productId))
                              }
                            />
                          );
                        })}
                      </ScrollView>
                    )}
                    {/* "더보기" CTA — opens the full ranked result-set grid.
                        Rendered only when:
                          1. search_id 도착 (라우팅 가능)
                          2. 현재 뜬 카드보다 실제 결과가 더 있음
                        서버가 total 을 안 주거나 total ≤ 카드 수면 숨김 —
                        모두 이미 보이는데 CTA 만 노출되는 걸 방지. */}
                    {turn.streamProducts &&
                      turn.streamProducts.length > 0 &&
                      turn.streamSearchId &&
                      typeof turn.streamSearchTotal === "number" &&
                      turn.streamSearchTotal > turn.streamProducts.length && (
                        <Pressable
                          style={styles.seeMoreCta}
                          onPress={() => {
                            Haptic.light();
                            const sid = sessionIdRef.current;
                            const qs = [
                              `search=${encodeURIComponent(
                                turn.streamSearchId as string,
                              )}`,
                              sid ? `session=${encodeURIComponent(sid)}` : "",
                            ]
                              .filter(Boolean)
                              .join("&");
                            router.push(`/list?${qs}` as never);
                          }}
                        >
                          <Text style={styles.seeMoreText}>
                            {`더보기 (${turn.streamSearchTotal})`}
                          </Text>
                          <SymbolView
                            name="chevron.right"
                            size={13}
                            tintColor={IOSColors.secondaryLabel}
                            weight="semibold"
                          />
                        </Pressable>
                      )}
                    {/* Inline-keyboard prompt (pick_item / gender / ...).
                        Server sent SSE `clarify`; render as tappable pills.
                        After a pick, buttons freeze — the picked one is
                        highlighted, the rest fade — so chat history
                        preserves what was chosen. */}
                    {turn.streamClarify && turn.streamClarify.options.length > 0 && (
                      <View style={styles.clarifyBlock}>
                        {turn.streamClarify.options.map((opt) => {
                          const isPicked =
                            turn.streamClarifyPicks?.includes(opt.callback) ??
                            false;
                          return (
                            <Pressable
                              key={opt.callback}
                              disabled={isPicked}
                              style={[
                                styles.clarifyOption,
                                isPicked && styles.clarifyOptionPicked,
                              ]}
                              onPress={() =>
                                handleClarifyPick(turn.id, opt.callback, opt.label)
                              }
                            >
                              <Text
                                style={[
                                  styles.clarifyOptionText,
                                  isPicked && styles.clarifyOptionTextPicked,
                                ]}
                                numberOfLines={2}
                              >
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    {turn.streamDone && !turn.streamClarify && (
                      <View style={styles.feedbackTriggerRow}>
                        <FeedbackTrigger
                          turnKey={`stream:${turn.id}`}
                          searchId={turn.streamSearchId}
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Empty fallback */}
                {turn.status === "empty" && (
                  <View style={styles.fallbackBlock}>
                    <Text style={styles.fallbackText}>{EMPTY_FALLBACK}</Text>
                    {isLast && (
                      <>
                        <Pressable
                          style={styles.fallbackAction}
                          onPress={handleLoosen}
                        >
                          <Text style={styles.fallbackActionText}>
                            조건 풀어서 다시 보기
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.fallbackAction}
                          onPress={handleSimilarMood}
                        >
                          <Text style={styles.fallbackActionText}>
                            비슷한 무드로 보여줘
                          </Text>
                        </Pressable>
                      </>
                    )}
                    <View style={styles.feedbackTriggerRow}>
                      <FeedbackTrigger turnKey={`fallback:${turn.id}`} />
                    </View>
                  </View>
                )}

                {/* Results */}
                {turn.status === "results" &&
                  turn.results &&
                  turn.results.length > 0 && (
                    <View style={styles.resultsBlock}>
                      <Text style={styles.agentText}>{agentText}</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.cardRow}
                        snapToInterval={PRODUCT_CARD_WIDTH + 12}
                        decelerationRate="fast"
                      >
                        {turn.results.slice(0, 5).map((p, idx) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            pinned={isLast && pinnedId === p.id}
                            onPress={() => router.push(`/product/${p.id}`)}
                            onPin={() =>
                              isLast && handlePin(p, turn.streamSearchId ?? null)
                            }
                            searchId={turn.streamSearchId ?? null}
                            position={idx}
                            source="search"
                          />
                        ))}
                      </ScrollView>
                      <Pressable
                        style={styles.moreLink}
                        onPress={() => {
                          Haptic.light();
                          router.push("/list");
                        }}
                      >
                        <Text style={styles.moreLinkText}>
                          더보기 (이 세트 {turn.results.length}개)
                        </Text>
                        <SymbolView
                          name="chevron.right"
                          size={12}
                          tintColor={IOSColors.label}
                          weight="semibold"
                        />
                      </Pressable>

                      <View style={styles.feedbackTriggerRow}>
                        <FeedbackTrigger turnKey={`search:${turn.id}`} />
                      </View>

                      {turn.narrowing && (
                        <View style={styles.narrowingBlock}>
                          <Text style={styles.narrowingQ}>
                            {turn.narrowing.question}
                          </Text>
                          <View style={styles.narrowingChipRow}>
                            {turn.narrowing.options.map((opt) => (
                              <Pressable
                                key={opt}
                                disabled={!isLast || isBusy}
                                onPress={() => handleNarrowingPick(opt)}
                              >
                                <View style={styles.narrowChip}>
                                  <Text style={styles.narrowChipText}>
                                    {opt}
                                  </Text>
                                </View>
                              </Pressable>
                            ))}
                            {isLast && (
                              <Pressable
                                onPress={() => dismissNarrowing(turn.id)}
                              >
                                <View style={styles.narrowDismiss}>
                                  <Text style={styles.narrowDismissText}>
                                    상관없어
                                  </Text>
                                </View>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
              </View>
            );
          })}
          </View>
        )}
      </ScrollView>

      {/* Composer — floats over content so chips/input show real glass with
          the result cards scrolling underneath. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={styles.composerFloat}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.composerWrap,
            { paddingBottom: insets.bottom + 12 },
            isBusy && styles.composerBusy,
          ]}
        >
          {pinnedAttachment && !capLocked && (
            <View style={styles.attachmentRow}>
              <View style={styles.attachmentChip}>
                {pinnedAttachment.imageUrl ? (
                  <ExpoImage
                    source={pinnedAttachment.imageUrl}
                    style={styles.attachmentThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.attachmentThumb,
                      {
                        backgroundColor:
                          pinnedAttachment.thumbColor ??
                          IOSColors.tertiarySystemBackground,
                      },
                    ]}
                  />
                )}
                <Text style={styles.attachmentBrand} numberOfLines={1}>
                  {pinnedAttachment.label}
                </Text>
                <Pressable hitSlop={6} onPress={clearPin}>
                  <SymbolView
                    name="xmark.circle.fill"
                    size={18}
                    tintColor={IOSColors.tertiaryLabel}
                  />
                </Pressable>
              </View>
            </View>
          )}

          <Banner />

          {!activeBanner && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Pressable onPress={handleOpenFilter} disabled={isBusy}>
                <GlassSurface
                  variant="pill"
                  isInteractive
                  style={styles.filterChip}
                >
                  <Text style={styles.filterChipText}>
                    {buildFilterLabel(filter)}
                  </Text>
                  <SymbolView
                    name="chevron.up"
                    size={11}
                    tintColor={IOSColors.secondaryLabel}
                    weight="semibold"
                  />
                </GlassSurface>
              </Pressable>
              {hasResults &&
                critiqueChips.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => handleCritique(c.id)}
                    disabled={isBusy}
                  >
                    <GlassSurface
                      variant="pill"
                      isInteractive
                      style={styles.critiqueChip}
                    >
                      <Text style={styles.critiqueChipText}>{c.label}</Text>
                    </GlassSurface>
                  </Pressable>
                ))}
              {/* 골든셋 유도 칩 — 첫 턴 이전(빈 상태)에만. 버블엔 한국어
                  label, 서버엔 검증된 영어 query (serverQueryOverride). */}
              {!hasResults &&
                suggestionChips.map((chip: SuggestionChip) => (
                  <Pressable
                    key={chip.id}
                    disabled={isBusy}
                    onPress={() => {
                      Haptic.selection();
                      // 기획 7/23: 칩 탭 자체를 기록 — search_query 와는
                      // entry_point='chip' 으로 페어 (이중 카운트 아님).
                      trackEvent("chip_tap", {
                        chip_id: chip.id,
                        label_ko: chip.label,
                        query_en: chip.query,
                        session_id: sessionIdRef.current,
                      });
                      runStreamingTurn(
                        chip.label,
                        undefined,
                        undefined,
                        chip.query,
                        "chip",
                      );
                    }}
                  >
                    <GlassSurface
                      variant="pill"
                      isInteractive
                      style={styles.critiqueChip}
                    >
                      <Text style={styles.critiqueChipText}>{chip.label}</Text>
                    </GlassSurface>
                  </Pressable>
                ))}
            </ScrollView>
          )}

          {pickedImage && (
            <View style={styles.previewRow}>
              <View style={styles.previewWrap}>
                <Image
                  source={{ uri: pickedImage }}
                  style={styles.preview}
                  contentFit="cover"
                />
                <Pressable
                  style={styles.previewClose}
                  hitSlop={8}
                  onPress={handleRemovePreview}
                >
                  <SymbolView
                    name="xmark"
                    size={11}
                    tintColor="#FFFFFF"
                    weight="bold"
                  />
                </Pressable>
              </View>
            </View>
          )}

          <GlassSurface variant="composer" style={styles.composer}>
            <Pressable
              hitSlop={6}
              style={styles.composerIcon}
              onPress={handlePickPhoto}
              disabled={isBusy || capLocked}
            >
              <SymbolView
                name="plus"
                size={20}
                tintColor={IOSColors.secondaryLabel}
                weight="medium"
              />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={composerPlaceholder}
              placeholderTextColor={IOSColors.placeholderText}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!isBusy && !capLocked}
            />
            <Pressable
              hitSlop={6}
              disabled={!canSend}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSend}
            >
              <SymbolView
                name="arrow.up"
                size={18}
                tintColor={IOSColors.systemBackground}
                weight="bold"
              />
            </Pressable>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>

      {/* Floating top bar — sits above the scroll so glass pills can show
          the chat content drifting underneath. Otherwise the pills only
          have the solid root color behind them and look opaque. */}
      <View style={styles.topBarFloat} pointerEvents="box-none">
        <TopBar
          onOpenMenu={() => {
            const sid = sessionIdRef.current;
            router.push(sid ? `/sidebar?current=${sid}` : "/sidebar");
          }}
          showCuration={showJumpTop && !resumedFromHistory}
          onOpenCuration={scrollToCuration}
          onOpenList={() => {
            const sid = sessionIdRef.current;
            router.push(sid ? `/history?session=${sid}` : "/history");
          }}
          onOpenWishlist={() => router.push("/wishlist")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.secondarySystemBackground,
  },
  topBarFloat: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  composerFloat: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  // 큐레이션(발견) 블록 — 항상 최상단. CurationSheet rowScroll 의 -16
  // 인셋과 짝을 맞춰 좌우 16. (구 emptyScroll/emptyScrollContent 는 단일
  // 스크롤 병합으로 제거 — 대화·큐레이션이 한 ScrollView 를 공유한다.)
  curationBlock: {
    paddingHorizontal: 16,
  },
  // 대화 블록 — 큐레이션 아래로 이어붙는다. 대화 버블은 좌우 20(기존
  // chatContent 값). 큐레이션과 시각적으로 떨어지게 상단 여백 + 헤어라인.
  conversationBlock: {
    paddingHorizontal: 20,
    gap: 22, // 기존 chatContent 의 턴 간격 — 병합 후에도 유지
  },
  // 큐레이션 아래로 이어붙을 때만 구분선/여백 (메인 홈). 과거 채팅엔 미적용.
  conversationDivider: {
    marginTop: 8,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  // 히어로 표제 — curation-lab heroTitleManifesto 확정 튜닝값 그대로
  // (title1 기반, 아이폰 14 과대·과볼드 피드백 반영 semibold + 넉넉한 행간).
  // 좌측 paddingHorizontal 은 emptyScrollContent 의 16 을 물려받아 구좌
  // 섹션 타이틀과 같은 기준선 공유. 아래 여백은 hero3 의 paddingBottom(32).
  emptyHeroTitle: {
    ...IOSText.title1,
    fontSize: 27,
    lineHeight: 38,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: "left",
    paddingBottom: 32,
  },
  // Conversation
  turn: {
    gap: 14,
  },
  userImageRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  userImage: {
    width: 96,
    height: 96,
    borderRadius: Radius.lg,
  },
  userTextRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  userBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.xl,
    borderTopRightRadius: 6,
    backgroundColor: IOSColors.label,
  },
  userBubbleText: {
    ...IOSText.body,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  userImageSmall: {
    width: 76,
    height: 76,
    borderRadius: Radius.lg,
    opacity: Opacity.softened,
  },
  pickerBlock: {
    paddingHorizontal: 4,
    paddingTop: 4,
    gap: 12,
  },
  pickerPrompt: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  pickerBtnPicked: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
  },
  pickerEmoji: {
    fontSize: 16,
  },
  pickerLabel: {
    ...IOSText.subhead,
    fontWeight: "600",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  pickerLabelPicked: {
    color: IOSColors.systemBackground,
  },
  botStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  botStatusText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },

  // Result feed
  resultsBlock: {
    marginTop: 4,
    gap: 14,
  },
  streamBlock: {
    marginTop: 4,
    gap: 14,
  },
  botBubbleRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
  },
  botBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.xl,
    borderTopLeftRadius: 6,
    backgroundColor: IOSColors.systemBackground,
  },
  botBubbleText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    lineHeight: 22,
  },
  // (스트림 결과 카드는 ProductCard 로 통일 — 구 streamProductCard/actions
  //  스타일 제거. 큐레이션 카드와 동일 디자인.)
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 4,
  },
  feedbackTriggerRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    marginTop: -8,
  },
  seeMoreCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  seeMoreText: {
    ...IOSText.subhead,
    fontWeight: "600",
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  clarifyBlock: {
    paddingHorizontal: 4,
    marginTop: 4,
    gap: 8,
  },
  clarifyOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    backgroundColor: IOSColors.tertiarySystemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  clarifyOptionText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // Already-searched option: subtle gray fill (systemGray5 auto-adapts to
  // dark mode via IOSColors palette lookup) + muted secondary-label text.
  // Non-picked options stay in their default appearance so the user can
  // scroll back and tap another item they didn't try yet.
  clarifyOptionPicked: {
    backgroundColor: IOSColors.systemGray5,
    borderColor: IOSColors.systemGray5,
  },
  clarifyOptionTextPicked: {
    color: IOSColors.secondaryLabel,
  },
  agentText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    flexShrink: 1,
  },
  cardRow: {
    paddingRight: 20,
    gap: 12,
  },
  moreLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  moreLinkText: {
    ...IOSText.subhead,
    fontWeight: "700",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  // Narrowing block — soft muted greyscale, no hard B/W contrast.
  narrowingBlock: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: Radius.xl,
    backgroundColor: IOSColors.systemFill,
    gap: 12,
  },
  narrowingQ: {
    ...IOSText.subhead,
    fontWeight: "600",
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  narrowingChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  narrowChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  narrowChipText: {
    ...IOSText.subhead,
    fontWeight: "600",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  narrowDismiss: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: "transparent",
  },
  narrowDismissText: {
    ...IOSText.subhead,
    fontWeight: "500",
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },

  // Composer
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  composerBusy: {
    opacity: Opacity.muted,
  },
  chipRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  filterChipText: {
    ...IOSText.subhead,
    fontWeight: "500",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  critiqueChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  critiqueChipText: {
    ...IOSText.subhead,
    fontWeight: "500",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  // Attachment chip
  attachmentRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
  },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  attachmentThumb: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
  },
  attachmentBrand: {
    ...IOSText.footnote,
    fontWeight: "700",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  // Empty fallback
  fallbackBlock: {
    paddingHorizontal: 4,
    paddingTop: 8,
    gap: 12,
  },
  fallbackText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginBottom: 4,
  },
  fallbackAction: {
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    backgroundColor: IOSColors.systemBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackActionText: {
    ...IOSText.body,
    fontWeight: "500",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  previewRow: {
    flexDirection: "row",
    paddingHorizontal: 4,
  },
  previewWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  previewClose: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    backgroundColor: withAlpha('#000000', Scrim.heavy),
    justifyContent: "center",
    alignItems: "center",
  },

  composer: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: Radius.xxl,
    paddingLeft: 8,
    paddingRight: 6,
    overflow: "hidden",
  },
  composerIcon: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    ...IOSText.body,
    color: IOSColors.label,
    paddingHorizontal: 6,
    fontFamily: IOSFont.sans,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: Opacity.faint,
  },
});
