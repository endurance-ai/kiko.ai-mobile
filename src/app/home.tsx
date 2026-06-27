import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image as ExpoImage } from 'expo-image';

import { Banner } from '@/components/banner';
import { FeedbackTrigger } from '@/components/feedback-trigger';
import { PRODUCT_CARD_WIDTH, ProductCard } from '@/components/product-card';
import { TopBar } from '@/components/top-bar';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { createSessionStream, getMessages, sendMessageStream } from '@/lib/chat';
import type { ChatStreamController } from '@/lib/sse';
import { useBanner } from '@/state/banner';
import { buildFilterLabel, PRICE_MAX, useFilter } from '@/state/filter';
import { MOCK_PRODUCTS, type Product } from '@/state/products';
import type { ProductRef } from '@/types/api';

type TurnStatus = 'analyzing' | 'picking' | 'searching' | 'results' | 'empty';

type VisionItem = {
  id: string;
  label: string;
  emoji: string;
};

const MOCK_VISION_ITEMS: VisionItem[] = [
  { id: 'shirt', label: '코튼 오버셔츠', emoji: '👔' },
  { id: 'jeans', label: '와이드 데님', emoji: '👖' },
  { id: 'shoes', label: '레더 스니커즈', emoji: '👟' },
  { id: 'watch', label: '미니멀 시계', emoji: '⌚' },
];

type UserMessage = {
  text?: string;
  imageUri?: string;
  colorHint?: string;
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
};

const SAMPLE_MOODS: { id: string; color: string }[] = [
  { id: 'm1', color: '#D8D6D2' },
  { id: 'm2', color: '#BFBDB9' },
  { id: 'm3', color: '#9C9A96' },
];

const SEARCH_HINT = '인디 · 빈티지 2,900+ 브랜드에서 찾는 중…';
const ANALYZE_HINT = '사진 분석 중… 아이템 추출하고 있어';
const PICK_PROMPT = (n: number) => `이 사진에서 ${n}개 아이템 찾았어. 어떤 거 찾아줄까?`;
const AGENT_INTRO_DEFAULT = '이런 거 어때? · 콕집기로 골라봐';
const AGENT_INTRO_NARROWING = '이런 거 찾았어 · 근데 좀 갈리네';
const EMPTY_FALLBACK = '이 무드는 아직 딱 맞는 걸 못 찾았어. 이렇게 해볼까?';

// Critique chips stay identical whether a product is pinned or not — the
// single source of truth keeps refine actions predictable. The "왜" affordance
// (which only made sense for an anchored item) is dropped on purpose.
const CRITIQUE_CHIPS = [
  { id: 'similar', label: '더 비슷하게' },
  { id: 'cheaper', label: '더 저렴하게' },
];

const MOCK_NARROWING: Narrowing = {
  question: '기장에서 갈려 — 어디로 좁힐까?',
  options: ['롱 기장', '크롭'],
};

// Pinterest / Instagram 링크는 og:image 해석을 통해 이미지 입력과 동치로 본다
// (ai-server link_resolver 패턴). 텍스트 안 어디에 끼어있어도 잡는다.
const VISION_LINK_RE =
  /https?:\/\/\S*(?:pinterest|pin\.it|instagram|instagr\.am)/i;

function containsVisionLink(text: string | undefined): boolean {
  return !!text && VISION_LINK_RE.test(text);
}

/**
 * Convert server message history (chronological) into the home Turn list.
 * Each (user, assistant) pair becomes a single completed SSE-style turn.
 * Trailing user message with no reply (rare) still renders as a turn with
 * empty assistant content so the user input is visible.
 */
function messageItemsToTurns(
  items: import('@/types/api').MessageItem[],
  nextIdRef: { current: number },
): Turn[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const turns: Turn[] = [];
  let i = 0;
  while (i < sorted.length) {
    const userMsg = sorted[i];
    if (userMsg.role !== 'user') {
      i++;
      continue;
    }
    const assistantMsg =
      sorted[i + 1]?.role === 'assistant' ? sorted[i + 1] : null;
    turns.push({
      id: nextIdRef.current++,
      user: { text: userMsg.content },
      status: 'results',
      isStream: true,
      streamText: assistantMsg?.content ?? '',
      streamProducts: assistantMsg?.product_refs ?? [],
      streamDone: true,
    });
    i += assistantMsg ? 2 : 1;
  }
  return turns;
}

// Best-effort heuristic for fashion / shopping intent. Used to pick the
// transient bot status copy while waiting for the first text_delta. Not a
// gate on anything else — false negatives just fall back to a generic line.
const FASHION_KEYWORDS = /옷|셔츠|티셔츠|블라우스|니트|스웨터|가디건|후드|맨투맨|자켓|재킷|코트|아우터|이너|패딩|점퍼|조끼|베스트|원피스|드레스|스커트|치마|바지|팬츠|진|데님|슬랙스|쇼츠|반바지|신발|스니커즈|운동화|구두|로퍼|샌들|부츠|슬리퍼|가방|백|클러치|토트|크로스백|숄더백|모자|캡|비니|버킷햇|선글라스|안경|벨트|시계|악세사리|악세서리|주얼리|목걸이|반지|귀걸이|팔찌|핏|루즈핏|오버핏|슬림핏|와이드|크롭|롱|숏|컬러|색감|색상|브랜드|코디|룩|스타일|무드|빈티지|미니멀|스트릿|캐주얼|포멀|찾아|추천|입을|입고|사고/i;

function looksLikeFashionQuery(text: string): boolean {
  return FASHION_KEYWORDS.test(text);
}

export default function ChatEntryScreen() {
  const insets = useSafeAreaInsets();
  const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();
  const { value: filter, setValue: setFilter } = useFilter();
  const { active: activeBanner, show: showBanner, clear: clearBanner } = useBanner();
  const [text, setText] = useState('');
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const nextIdRef = useRef(1);
  const sessionIdRef = useRef<string | null>(null);
  const streamRef = useRef<ChatStreamController | null>(null);

  useEffect(() => () => streamRef.current?.cancel(), []);

  // Load a past session into the home turn list (sidebar tap routes here
  // with ?session=<uuid> so the chat continues on the same surface).
  useEffect(() => {
    if (!sessionParam) return;
    let cancelled = false;
    sessionIdRef.current = sessionParam;
    (async () => {
      try {
        const res = await getMessages(sessionParam, { limit: 50 });
        if (cancelled) return;
        const turns = messageItemsToTurns(res.messages, nextIdRef);
        setMessages(turns);
      } catch {
        // ignore — empty state will show
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionParam]);

  const lastTurn = messages[messages.length - 1] ?? null;
  const lastStatus = lastTurn?.status ?? null;
  const hasConversation = messages.length > 0;
  const isStreaming =
    lastTurn?.isStream === true && lastTurn.streamDone !== true;
  const isBusy =
    lastStatus === 'searching' || lastStatus === 'analyzing' || isStreaming;
  const hasResults = lastStatus === 'results';
  const isEmpty = lastStatus === 'empty';
  const canSend = !isBusy && (text.trim().length > 0 || pickedImage !== null);
  // Unified pinned attachment: works for both mock products and SSE products.
  // SSE pins use a composite id "<turnId>:<index>" so we look up by parsing it.
  const pinnedAttachment: {
    thumbColor?: string;
    imageUrl?: string;
    label: string;
  } | null = (() => {
    if (!pinnedId) return null;
    const mockHit = lastTurn?.results?.find((p) => p.id === pinnedId);
    if (mockHit) {
      return { thumbColor: mockHit.colorHint, label: mockHit.brand };
    }
    const [maybeTurnId, maybeIdx] = pinnedId.split(':');
    if (maybeTurnId && maybeIdx) {
      const turn = messages.find((t) => String(t.id) === maybeTurnId);
      const sse = turn?.streamProducts?.[Number(maybeIdx)];
      if (sse) {
        // caption is HTML-ish; the brand line is usually the bold prefix.
        const stripped = sse.caption.replace(/<[^>]+>/g, '').trim();
        const label = stripped.split('\n')[0] || '선택한 상품';
        return { imageUrl: sse.image_url, label: label.slice(0, 20) };
      }
    }
    return null;
  })();
  // Legacy name kept for the few mock-only branches still using `.colorHint`.
  const pinnedProduct = pinnedId
    ? lastTurn?.results?.find((p) => p.id === pinnedId) ?? null
    : null;
  const critiqueChips = CRITIQUE_CHIPS;

  // Auto-scroll to bottom whenever messages or status change.
  useEffect(() => {
    if (!scrollRef.current) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages]);

  const updateTurn = (id: number, patch: Partial<Turn>) => {
    setMessages((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const runFinalSearch = (turnId: number) => {
    updateTurn(turnId, { status: 'searching' });
    setTimeout(() => {
      const wouldBeEmpty = filter.priceMax < 100;
      if (wouldBeEmpty) {
        Haptic.warning();
        updateTurn(turnId, {
          status: 'empty',
          results: [],
          narrowing: null,
        });
      } else {
        Haptic.success();
        updateTurn(turnId, {
          status: 'results',
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
      status: hasImageInput ? 'analyzing' : 'searching',
    };
    setMessages((prev) => [...prev, turn]);
    setText('');
    setPickedImage(null);
    setPinnedId(null);

    if (hasImageInput) {
      setTimeout(() => {
        updateTurn(turnId, {
          status: 'picking',
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
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요해요. 설정에서 허용해줘.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImage(result.assets[0].uri);
    }
  };

  const handleOpenFilter = () => {
    if (isBusy) return;
    Haptic.light();
    router.push('/filter');
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
    if (!canSend) return;
    const trimmed = text.trim();
    const hasImage = pickedImage !== null;
    Haptic.medium();

    // Gallery uploads still need /v1/uploads (not deployed yet) — keep the
    // mock pipeline for now. Plain text (including Pinterest / Instagram
    // links) is forwarded to /v1/chat — the server's ReAct agent has its
    // own link_resolver tool to fetch og:image and route to vision.
    if (hasImage || !trimmed) {
      startTurn({
        text: trimmed || undefined,
        imageUri: pickedImage ?? undefined,
      });
      return;
    }

    setText('');
    runStreamingTurn(trimmed);
  };

  const runStreamingTurn = (trimmed: string) => {
    clearBanner('request-failure');
    const attachment = pinnedAttachment; // snapshot before we clear it
    const turnId = nextIdRef.current++;
    const turn: Turn = {
      id: turnId,
      user: {
        text: trimmed,
        imageUri: attachment?.imageUrl,
        colorHint:
          !attachment?.imageUrl && attachment?.thumbColor
            ? attachment.thumbColor
            : undefined,
      },
      status: 'searching',
      isStream: true,
      streamText: '',
      streamProducts: [],
      streamDone: false,
      streamPlaceholder: looksLikeFashionQuery(trimmed)
        ? '카탈로그에서 찾는 중…'
        : '키코가 생각 중…',
    };
    setMessages((prev) => [...prev, turn]);
    if (attachment) setPinnedId(null);
    // Server takes plain text; if a product is pinned, prefix the message so
    // the ReAct loop anchors to it.
    const serverText = attachment ? `[${attachment.label}] ${trimmed}` : trimmed;

    const patch = (mut: (t: Turn) => Partial<Turn>) =>
      setMessages((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, ...mut(t) } : t)),
      );

    const handlers = {
      onSession: (sessionId: string) => {
        sessionIdRef.current = sessionId;
      },
      onTextDelta: (delta: string) => {
        patch((t) => ({ streamText: (t.streamText ?? '') + delta }));
      },
      onProduct: (product: ProductRef) => {
        patch((t) => ({
          streamProducts: [...(t.streamProducts ?? []), product],
        }));
      },
      onDone: () => {
        patch(() => ({ streamDone: true, status: 'results' as const }));
        streamRef.current = null;
      },
      onError: () => {
        Haptic.error();
        setMessages((prev) => prev.filter((t) => t.id !== turnId));
        streamRef.current = null;
        showBanner({
          id: 'request-failure',
          priority: 'error',
          title: '요청을 처리하지 못했어요',
          action: {
            label: '다시 시도',
            onPress: () => runStreamingTurn(trimmed),
          },
        });
      },
    };

    streamRef.current = sessionIdRef.current
      ? sendMessageStream(sessionIdRef.current, serverText, handlers)
      : createSessionStream(serverText, handlers);
    void streamRef.current.promise.catch(() => {});
  };

  const handleSampleMood = (color: string) => {
    Haptic.medium();
    startTurn({ colorHint: color });
  };

  const handleCritique = (id: string) => {
    if (isBusy) return;
    const chip = CRITIQUE_CHIPS.find((c) => c.id === id);
    const label = chip?.label;
    if (!label) return;
    Haptic.medium();
    // For real SSE turns, send the chip label as the next user message —
    // server's ReAct loop handles the refine intent. The pinned-product
    // anchor pattern stays available for the mock pipeline if needed.
    if (sessionIdRef.current) {
      runStreamingTurn(label);
      return;
    }
    if (pinnedProduct) {
      startTurn({ text: label, colorHint: pinnedProduct.colorHint });
    } else {
      startTurn({ text: label });
    }
  };

  const handlePin = (p: Product) => {
    setPinnedId((prev) => (prev === p.id ? null : p.id));
  };

  const handleRemovePreview = () => {
    Haptic.light();
    setPickedImage(null);
  };

  const topPad = insets.top + 52;

  return (
    <View style={styles.root}>
      {hasConversation ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.chatContent,
            { paddingTop: topPad, paddingBottom: insets.bottom + 180 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((turn) => {
            const isLast = turn.id === lastTurn?.id;
            const agentText = turn.narrowing ? AGENT_INTRO_NARROWING : AGENT_INTRO_DEFAULT;

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
                        <Text style={styles.userBubbleText}>{turn.user.text}</Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Analyzing */}
                {turn.status === 'analyzing' && (
                  <View style={styles.botStatusRow}>
                    <ActivityIndicator size="small" color={IOSColors.secondaryLabel} />
                    <Text style={styles.botStatusText}>{ANALYZE_HINT}</Text>
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
                          if (isLast && turn.status === 'picking') {
                            handlePickItem(turn.id, it);
                          } else {
                            Haptic.medium();
                            startTurn({ text: it.label });
                          }
                        };
                        return (
                          <Pressable
                            key={it.id}
                            style={[styles.pickerBtn, isPicked && styles.pickerBtnPicked]}
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
                {turn.status === 'searching' && !turn.isStream && (
                  <View style={styles.botStatusRow}>
                    <ActivityIndicator size="small" color={IOSColors.secondaryLabel} />
                    <Text style={styles.botStatusText}>{SEARCH_HINT}</Text>
                  </View>
                )}

                {/* SSE streaming assistant — real /v1/chat */}
                {turn.isStream && (
                  <View style={styles.streamBlock}>
                    {turn.streamText ? (
                      <View style={styles.botBubbleRow}>
                        <View style={styles.botBubble}>
                          <Text style={styles.botBubbleText}>
                            {turn.streamText}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      !turn.streamDone && (
                        <View style={styles.botStatusRow}>
                          <ActivityIndicator
                            size="small"
                            color={IOSColors.secondaryLabel}
                          />
                          {turn.streamPlaceholder && (
                            <Text style={styles.botStatusText}>
                              {turn.streamPlaceholder}
                            </Text>
                          )}
                        </View>
                      )
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
                          return (
                            <View key={key} style={styles.streamProductCard}>
                              <View style={styles.streamProductImageWrap}>
                                <ExpoImage
                                  source={p.image_url}
                                  style={styles.streamProductImage}
                                  contentFit="cover"
                                />
                                <Pressable
                                  hitSlop={8}
                                  style={styles.streamPinBtn}
                                  onPress={() => {
                                    Haptic.selection();
                                    setPinnedId((prev) =>
                                      prev === key ? null : key,
                                    );
                                  }}
                                >
                                  <SymbolView
                                    name={pinned ? 'checkmark' : 'plus'}
                                    size={14}
                                    tintColor="#1C1C1E"
                                    weight="bold"
                                  />
                                </Pressable>
                              </View>
                              <Text
                                style={styles.streamProductCaption}
                                numberOfLines={3}
                              >
                                {p.caption.replace(/<[^>]+>/g, '')}
                              </Text>
                            </View>
                          );
                        })}
                      </ScrollView>
                    )}
                    {turn.streamDone && (
                      <View style={styles.feedbackTriggerRow}>
                        <FeedbackTrigger turnKey={`stream:${turn.id}`} />
                      </View>
                    )}
                  </View>
                )}

                {/* Empty fallback */}
                {turn.status === 'empty' && (
                  <View style={styles.fallbackBlock}>
                    <Text style={styles.fallbackText}>{EMPTY_FALLBACK}</Text>
                    {isLast && (
                      <>
                        <Pressable style={styles.fallbackAction} onPress={handleLoosen}>
                          <Text style={styles.fallbackActionText}>조건 풀어서 다시 보기</Text>
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
                {turn.status === 'results' && turn.results && turn.results.length > 0 && (
                  <View style={styles.resultsBlock}>
                    <Text style={styles.agentText}>{agentText}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.cardRow}
                      snapToInterval={PRODUCT_CARD_WIDTH + 12}
                      decelerationRate="fast"
                    >
                      {turn.results.slice(0, 5).map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          pinned={isLast && pinnedId === p.id}
                          onPress={() => router.push(`/product/${p.id}`)}
                          onPin={() => isLast && handlePin(p)}
                        />
                      ))}
                    </ScrollView>
                    <Pressable
                      style={styles.moreLink}
                      onPress={() => {
                        Haptic.light();
                        router.push('/list');
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
                        <Text style={styles.narrowingQ}>{turn.narrowing.question}</Text>
                        <View style={styles.narrowingChipRow}>
                          {turn.narrowing.options.map((opt) => (
                            <Pressable
                              key={opt}
                              disabled={!isLast || isBusy}
                              onPress={() => handleNarrowingPick(opt)}
                            >
                              <View style={styles.narrowChip}>
                                <Text style={styles.narrowChipText}>{opt}</Text>
                              </View>
                            </Pressable>
                          ))}
                          {isLast && (
                            <Pressable onPress={() => dismissNarrowing(turn.id)}>
                              <View style={styles.narrowDismiss}>
                                <Text style={styles.narrowDismissText}>상관없어</Text>
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
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <View style={styles.emptyCard}>
            <View style={styles.mascot} />
            <Text style={styles.emptyTitle}>무드 이미지를 올려봐</Text>
            <Text style={styles.emptySubtitle}>그 느낌의 살 수 있는 옷을 찾아줄게</Text>
          </View>

          <View style={styles.thumbnailRow}>
            {SAMPLE_MOODS.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.thumbnail, { backgroundColor: m.color }]}
                onPress={() => handleSampleMood(m.color)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Composer — floats over content so chips/input show real glass with
          the result cards scrolling underneath. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          {pinnedAttachment && (
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
                      { backgroundColor: pinnedAttachment.thumbColor ?? IOSColors.tertiarySystemBackground },
                    ]}
                  />
                )}
                <Text style={styles.attachmentBrand} numberOfLines={1}>
                  {pinnedAttachment.label}
                </Text>
                <Pressable hitSlop={6} onPress={() => setPinnedId(null)}>
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
              <GlassView glassEffectStyle="clear" style={styles.filterChip}>
                <Text style={styles.filterChipText}>{buildFilterLabel(filter)}</Text>
                <SymbolView
                  name="chevron.up"
                  size={11}
                  tintColor={IOSColors.secondaryLabel}
                  weight="semibold"
                />
              </GlassView>
            </Pressable>
            {hasResults &&
              critiqueChips.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => handleCritique(c.id)}
                  disabled={isBusy}
                >
                  <GlassView glassEffectStyle="clear" style={styles.critiqueChip}>
                    <Text style={styles.critiqueChipText}>{c.label}</Text>
                  </GlassView>
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

          <GlassView glassEffectStyle="clear" style={styles.composer}>
            <Pressable
              hitSlop={6}
              style={styles.composerIcon}
              onPress={handlePickPhoto}
              disabled={isBusy}
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
              placeholder={
                isBusy
                  ? '키코가 찾는 중...'
                  : pinnedProduct
                  ? '또는 직접 입력...'
                  : isEmpty
                  ? '다르게 설명해볼래…'
                  : hasResults
                  ? '이거랑 비슷한데 더 저렴하게…'
                  : '이미지 올리기 · 링크 붙여넣기'
              }
              placeholderTextColor={IOSColors.placeholderText}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!isBusy}
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
          </GlassView>
        </View>
      </KeyboardAvoidingView>

      {/* Floating top bar — sits above the scroll so glass pills can show
          the chat content drifting underneath. Otherwise the pills only
          have the solid root color behind them and look opaque. */}
      <View style={styles.topBarFloat} pointerEvents="box-none">
        <TopBar
          onOpenMenu={() => router.push('/sidebar')}
          onOpenList={() => router.push('/history')}
          onOpenWishlist={() => router.push('/wishlist')}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  composerFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },

  // Empty state
  center: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 28,
  },
  emptyCard: {
    borderWidth: 1.5,
    borderColor: IOSColors.separator,
    borderStyle: 'dashed',
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  mascot: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: 20,
  },
  emptyTitle: {
    ...IOSText.title2,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  emptySubtitle: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    marginTop: 8,
    fontFamily: IOSFont.rounded,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },

  // Conversation
  chatContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 22,
  },
  turn: {
    gap: 14,
  },
  userImageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userImage: {
    width: 96,
    height: 96,
    borderRadius: 16,
  },
  userTextRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: IOSColors.label,
  },
  userBubbleText: {
    ...IOSText.body,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
  userImageSmall: {
    width: 76,
    height: 76,
    borderRadius: 14,
    opacity: 0.65,
  },
  pickerBlock: {
    paddingHorizontal: 4,
    paddingTop: 4,
    gap: 12,
  },
  pickerPrompt: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
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
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  pickerLabelPicked: {
    color: IOSColors.systemBackground,
  },
  botStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  botStatusText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
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
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  botBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    backgroundColor: IOSColors.systemBackground,
  },
  botBubbleText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    lineHeight: 22,
  },
  streamProductCard: {
    width: 140,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: 14,
    overflow: 'hidden',
  },
  streamProductImageWrap: {
    width: 140,
    height: 180,
    position: 'relative',
  },
  streamProductImage: {
    width: '100%',
    height: '100%',
  },
  streamProductCaption: {
    ...IOSText.caption1,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    padding: 8,
  },
  streamPinBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 4,
  },
  feedbackTriggerRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  agentText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    flexShrink: 1,
  },
  cardRow: {
    paddingRight: 20,
    gap: 12,
  },
  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  moreLinkText: {
    ...IOSText.subhead,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  // Narrowing block — soft muted greyscale, no hard B/W contrast.
  narrowingBlock: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: IOSColors.systemFill,
    gap: 12,
  },
  narrowingQ: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  narrowingChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  narrowChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  narrowChipText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  narrowDismiss: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  narrowDismissText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },

  // Composer
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  composerBusy: {
    opacity: 0.55,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  filterChipText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  critiqueChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  critiqueChipText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  // Attachment chip
  attachmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  attachmentThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  attachmentBrand: {
    ...IOSText.footnote,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
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
    fontFamily: IOSFont.rounded,
    marginBottom: 4,
  },
  fallbackAction: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    backgroundColor: IOSColors.systemBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackActionText: {
    ...IOSText.body,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  previewRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  previewWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  previewClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    paddingLeft: 8,
    paddingRight: 6,
    overflow: 'hidden',
  },
  composerIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    ...IOSText.body,
    color: IOSColors.label,
    paddingHorizontal: 6,
    fontFamily: IOSFont.rounded,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
