/**
 * [v1.2 시안] Chat — 대화 화면 (드릴다운). 2026-08-04 IA 확정본.
 *
 * Chat 은 동급 표면이 아니라 "메인에서 파고드는" 드릴다운 — 좌상단 ‹ 하나
 * (☰ 없음). 진입 3경로 모두 동일 크롬: ① Explore 컴포저/칩(새 스레드 +
 * 탐색 맥락 승계) ② 사이드바 [새 채팅](새 스레드, 빈 컨텍스트) ③ 사이드바
 * 최근 항목(기존 스레드). 나가면 직전 화면, 대화는 스레드로 기록.
 *
 * 파라미터: useLocalSearchParams { display(노출 KO), query(EN — 실연동 시
 * 검색 API body) }. 턴 구조 = 유저 버블(우측 글래스) + 에이전트 응답 +
 * 상품 Row. 컴포저 56 + 전송 44.
 *
 * dev-only. 규칙: docs/design-system.md — 토큰만, 반투명은 GlassSurface.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { ProductCard } from '@/components/product-card';
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Radius, RadiusRole } from '@/theme';
import { MOCK_PRODUCTS, type Product } from '@/state/products';

// 구 Spacing 토큰 값 (main Phase 2 dead-code 제거로 theme에서 삭제됨) —
// 프로토타입 로컬로 유지 (curation-lab 과 동일 관례).
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

const AGENT_REPLY_TEXT = '이런 거 어때? 골라봐';
const CANNED_FOLLOWUP = '조금 더 캐주얼한 것도 보여줘';
const PRODUCTS_PER_TURN = 4;
const COMPOSER_CLEARANCE = 120;

type Turn = { id: string; display: string };

// 턴 인덱스로 mock 카탈로그를 회전시켜 매 턴 다른 4개를 결정적으로 뽑는다.
function pickTurnProducts(turnIndex: number): Product[] {
  const start = (turnIndex * PRODUCTS_PER_TURN) % MOCK_PRODUCTS.length;
  return Array.from(
    { length: PRODUCTS_PER_TURN },
    (_, i) => MOCK_PRODUCTS[(start + i) % MOCK_PRODUCTS.length],
  );
}

export default function ChatLabScreen() {
  const insets = useSafeAreaInsets();
  // 웹 미리보기는 safe-area 인셋이 0 → 다이나믹 아일랜드와 겹침. 실기기
  // 상태바 인셋(59)을 웹에서만 심는다 (다른 lab 화면과 동일 처리).
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  // 핸드오프 파라미터 — display(노출 KO)만 화면에 쓰고, query(EN)는 실연동 시
  // 검색 API body 가 된다 (SendPayload 분리 계약과 동일).
  const params = useLocalSearchParams<{ display?: string; query?: string }>();
  const initialDisplay =
    typeof params.display === 'string' && params.display.length > 0
      ? params.display
      : '베이지 니트 조끼 찾아줘';

  const [turns, setTurns] = useState<Turn[]>([{ id: 'turn-0', display: initialDisplay }]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  // 새 턴이 붙으면 최신 턴이 보이게 맨 아래로.
  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [turns.length]);

  const togglePin = (id: string) => {
    Haptic.selection();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFollowup = () => {
    Haptic.medium();
    setTurns((prev) => [...prev, { id: `turn-${prev.length}`, display: CANNED_FOLLOWUP }]);
  };

  // ‹ = 모든 진입 경로 공통 (2026-08-03 확정 — 컴포저/새 채팅/스레드 어디로
  // 열려도 좌상단은 ‹ 하나. Chat 은 드릴다운, 나가면 직전 화면 + 스레드 기록).
  const handleBack = () => {
    Haptic.light();
    router.back();
  };

  const catalogNote = useMemo(() => turns.map((_, i) => pickTurnProducts(i)), [turns]);

  return (
    <View style={styles.root}>
      {/* 상단 바 — ‹ 하나 (드릴다운 문법: Chat 은 메인에서 파고드는 화면). */}
      <View style={[styles.topBar, { top: topInset + Spacing.one }]}>
        <Pressable
          hitSlop={8}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <GlassSurface {...Glass.chip} isInteractive style={styles.backPill}>
            {Platform.OS === 'web' ? (
              <Text style={styles.backGlyph}>‹</Text>
            ) : (
              <SymbolView name="chevron.left" size={17} tintColor={IOSColors.label} weight="medium" />
            )}
          </GlassSurface>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + 56, paddingBottom: COMPOSER_CLEARANCE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {turns.map((turn, index) => (
          <View key={turn.id} style={styles.turnBlock}>
            <View style={styles.userBubbleRow}>
              <GlassSurface {...Glass.chip} style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{turn.display}</Text>
              </GlassSurface>
            </View>
            <Text style={styles.agentReplyText}>{AGENT_REPLY_TEXT}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.rowScroll}
              contentContainerStyle={styles.rowScrollContent}
            >
              {catalogNote[index].map((product) => (
                <ProductCard
                  key={`${turn.id}-${product.id}`}
                  product={product}
                  pinned={pinnedIds.has(product.id)}
                  onPress={() => Haptic.selection()} // mock — PDP 는 실데이터 연동 후 (mock ID 로 push 시 크래시)
                  onPin={() => togglePin(product.id)}
                />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* 하단 컴포저 — Chat 에서는 "이어서 묻기"가 기본 동작. */}
      <View style={[styles.composerArea, { paddingBottom: insets.bottom + Spacing.three }]}>
        <GlassSurface {...Glass.composer} style={styles.composer}>
          <Text style={styles.composerPlaceholder} numberOfLines={1}>
            이어서 물어보세요
          </Text>
          <Pressable hitSlop={6} onPress={handleFollowup} style={styles.sendBtn}>
            {Platform.OS === 'web' ? (
              <Text style={styles.sendGlyph}>↑</Text>
            ) : (
              <SymbolView name="arrow.up" size={16} tintColor={IOSColors.systemBackground} weight="bold" />
            )}
          </Pressable>
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.systemBackground,
  },
  topBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: RadiusRole.chip,
    overflow: 'hidden',
  },
  backPillText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  backGlyph: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // 햄버거 — 툴바 심볼 버튼 36×36 캡슐 (blueprints) + hitSlop 6.
  hamburgerPill: {
    width: 36,
    height: 36,
    borderRadius: RadiusRole.chip,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  hamburgerGlyph: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.five,
  },
  turnBlock: {
    gap: Spacing.two,
  },
  userBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: RadiusRole.chip,
    overflow: 'hidden',
  },
  userBubbleText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  agentReplyText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.one,
  },
  rowScroll: {
    marginHorizontal: -Spacing.three,
  },
  rowScrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  composerArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: RadiusRole.chip,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    overflow: 'hidden',
  },
  composerPlaceholder: {
    ...IOSText.body,
    flex: 1,
    color: IOSColors.placeholderText,
    fontFamily: IOSFont.sans,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendGlyph: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
    color: IOSColors.systemBackground,
  },
});
