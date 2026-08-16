/**
 * 이미지 인풋 스테이징 화면 — 사진을 고른 뒤 '전송 전' 풀블리드 분석 화면.
 *
 * 두 상태:
 *  1) analyzing  — 이미지가 강한 블러로 깔리고 하단에 "이미지를 읽고 있어요".
 *     (블러 오버레이 opacity 를 1→0 으로 페이드해 강블러→약블러→원본 연출)
 *  2) done       — 원본 이미지 위에 항목별 리퀴드 글래스 버튼(GlassSurface)이
 *     세로로 배치되고, 하단 스타일 칩 + 컴포저. 버튼 탭 = '이 제품 기준' 토글.
 *
 * NOTE: 항목(items)·글래스 버튼 크롭은 아직 목업이며 좌표(bbox)가 없어 순서대로
 * 근사 배치한다. 백엔드 검출이 붙으면 items 에 crop URL·좌표를 실어 교체.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText, Radius, withAlpha } from '@/theme';

/** 스테이징이 다루는 최소 항목 형태 — home 의 VisionItem 과 구조 호환. */
export type StagingItem = {
  id: string;
  label: string;
  emoji: string;
  /** 항목 크롭 썸네일 (백엔드 검출 후). 없으면 emoji 아이콘으로 대체. */
  cropUri?: string;
  /** 이 항목만으로 비슷한 상품을 찾는 검색 쿼리 (버튼 탭 → 전송 시 사용). */
  searchQuery?: string;
  /** 이미지 위 상대 위치(0~1). 있으면 실제 좌표 배치, 없으면 지그재그 근사. */
  position?: { top: number; left: number };
};

const BLUR_STRONG = 30;

// 항목 버튼 세로 위치 하향 보정(%). cover 크롭에서 버튼이 살짝 위로 뜨는 걸 내림.
const POSITION_Y_SHIFT = 10;

export function ImageStagingView({
  imageUri,
  analyzing,
  items,
  styleChips,
  pickedItemId,
  text,
  canSend,
  busy,
  onChangeText,
  onPickItem,
  onTapChip,
  onSend,
  onClose,
}: {
  imageUri: string;
  /** true = 블러 + "읽고 있어요", false = 원본 + 글래스 버튼/칩. */
  analyzing: boolean;
  items: StagingItem[];
  styleChips: string[];
  /** '이 제품 기준'으로 선택된 항목 id. */
  pickedItemId: string | null;
  text: string;
  canSend: boolean;
  busy?: boolean;
  onChangeText: (t: string) => void;
  onPickItem: (item: StagingItem) => void;
  onTapChip: (chip: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  // 블러 오버레이 opacity — 분석 중엔 강(1)↔약(0.4)으로 계속 숨쉬듯 반복해
  // "읽는 중" 느낌을 주고, 완료되면 0 으로 풀려 선명해진다.
  const blur = useSharedValue(1);
  useEffect(() => {
    if (analyzing) {
      blur.value = 1;
      blur.value = withRepeat(
        withTiming(0.4, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        -1,
        true, // reverse — 0.4 까지 갔다가 다시 1 로, 무한 반복
      );
    } else {
      cancelAnimation(blur);
      blur.value = withTiming(0, { duration: 900 });
    }
  }, [analyzing, blur]);
  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value }));

  return (
    <View style={styles.root}>
      {/* 이미지 영역 — 상단을 채우고, 칩·컴포저는 그 아래 검정 존으로. 분석 중엔
          하단 존이 없어 이 영역이 전체를 채운다(flex:1). */}
      <View style={styles.imageRegion}>
      {/* 원본(선명) */}
      <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      {/* 블러 오버레이 — 같은 이미지에 blurRadius, opacity 페이드로 강→약→원본. */}
      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={BLUR_STRONG}
        />
      </Animated.View>

      {/* 닫기(X) — 좌상단 */}
      <Pressable
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        hitSlop={8}
        onPress={() => {
          Haptic.light();
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel="이미지 닫기"
      >
        <GlassSurface variant="pill" isInteractive style={styles.closePill}>
          <SymbolView name="xmark" size={16} tintColor={IOSColors.label} weight="semibold" />
        </GlassSurface>
      </Pressable>

      {/* 분석 중 — 하단 스크림 + 세리프 캡션 */}
      {analyzing && (
        <>
          <LinearGradient
            colors={['transparent', withAlpha('#000000', 0.75)]}
            style={styles.readingScrim}
            pointerEvents="none"
          />
          <Text style={[styles.readingText, { bottom: insets.bottom + 48 }]}>
            이미지를 읽고 있어요
          </Text>
        </>
      )}

      {/* 분석 완료 — 항목별 글래스 버튼 (좌표 없어 순서대로 지그재그 근사 배치) */}
      {!analyzing &&
        items.map((it, i) => {
          const isPicked = pickedItemId === it.id;
          // position 은 0~100 퍼센트 스케일. top 은 상단 여백~하단 칩/컴포저와
          // 겹치지 않게 클램프. 가로는 좌표(left)로 좌/중앙/우 정렬.
          const fallbackTop = 24 + (items.length > 1 ? (i * 46) / (items.length - 1) : 0);
          // 하향 오프셋 — cover 크롭 상 버튼이 살짝 위에 뜨는 걸 아래로 보정.
          const topPct = Math.min(
            84,
            Math.max(10, (it.position ? it.position.top : fallbackTop) + POSITION_Y_SHIFT),
          );
          const leftVal = it.position ? it.position.left : i % 2 === 0 ? 28 : 72;
          const align =
            leftVal < 40 ? 'flex-start' : leftVal > 60 ? 'flex-end' : 'center';
          return (
            <Animated.View
              key={it.id}
              entering={FadeIn.duration(260).delay(i * 90)}
              style={[styles.itemRow, { top: `${topPct}%`, alignItems: align }]}
            >
              <Pressable
                onPress={() => {
                  Haptic.selection();
                  onPickItem(it);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${it.label}${isPicked ? ', 선택됨' : ''}`}
              >
                <GlassSurface
                  variant="pill"
                  isInteractive
                  style={[styles.itemPill, isPicked && styles.itemPillPicked]}
                >
                  <View style={styles.itemThumb}>
                    {it.cropUri ? (
                      // 원본을 항목 좌표로 초점(줌) — 백엔드 크롭 URL 없어 근사.
                      <Image
                        source={{ uri: it.cropUri }}
                        style={styles.itemThumbImg}
                        contentFit="cover"
                        contentPosition={
                          it.position
                            ? { top: `${it.position.top}%`, left: `${it.position.left}%` }
                            : 'center'
                        }
                      />
                    ) : (
                      <Text style={styles.itemEmoji}>{it.emoji}</Text>
                    )}
                  </View>
                  <Text
                    style={[styles.itemLabel, isPicked && styles.itemLabelPicked]}
                    numberOfLines={1}
                  >
                    {it.label}
                  </Text>
                </GlassSurface>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* 하단 스택 — 스타일 칩 + 컴포저 (분석 완료 시). 이미지 아래 검정 존. */}
      {!analyzing && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.bottomStack}
        >
          {/* 안쪽 뷰에 세이프에어리어 패딩 — KAV(behavior padding)가 자기 하단
              패딩을 키보드에 맞춰 덮어쓰므로, 고정 여백은 여기서 준다. */}
          <View style={[styles.bottomInner, { paddingBottom: insets.bottom + 12 }]}>
          {styleChips.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              keyboardShouldPersistTaps="handled"
            >
              {styleChips.map((chip) => (
                <Pressable
                  key={chip}
                  disabled={busy}
                  onPress={() => {
                    Haptic.selection();
                    onTapChip(chip);
                  }}
                >
                  <GlassSurface variant="pill" isInteractive style={styles.chip}>
                    <Text style={styles.chipText}>{chip}</Text>
                  </GlassSurface>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <GlassSurface variant="composer" style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={onChangeText}
              placeholder="더 자세히 알려줄래요?"
              placeholderTextColor={IOSColors.placeholderText}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => canSend && onSend()}
              editable={!busy}
            />
            <Pressable
              hitSlop={6}
              disabled={!canSend}
              onPress={onSend}
              style={!canSend && styles.sendBtnDisabled}
            >
              <GlassSurface variant="pill" isInteractive style={styles.sendBtn}>
                <SymbolView
                  name="arrow.up"
                  size={18}
                  tintColor={IOSColors.label}
                  weight="bold"
                />
              </GlassSurface>
            </Pressable>
          </GlassSurface>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 100,
  },
  closeBtn: { position: 'absolute', left: 16, zIndex: 10 },
  closePill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // ── 분석 중 ──
  readingScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '28%' },
  readingText: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    ...IOSText.title3,
    color: '#FFFFFF',
    fontFamily: IOSFont.serif,
  },

  // ── 항목 글래스 버튼 ──
  // 좌우 전체폭 행 — top 으로 세로 배치, alignItems 로 좌/중앙/우 배치.
  itemRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  itemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 5,
    paddingRight: 14,
    height: 44,
    maxWidth: '86%',
    borderRadius: 22,
    overflow: 'hidden',
  },
  // 선택 상태 — 리퀴드 글래스 유지한 채 흰 링으로만 강조(솔리드 채우기 지양).
  itemPillPicked: { borderWidth: 2, borderColor: '#FFFFFF' },
  itemThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: withAlpha('#FFFFFF', 0.9),
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // 좌표(contentPosition) 지점을 중심으로 확대 크롭 — 상의/하의 부위가 더 크게
  // 잡혀 항목마다 썸네일이 구분되도록. (bbox 없어 점 기준 근사 줌.)
  itemThumbImg: { width: '100%', height: '100%', transform: [{ scale: 2.2 }] },
  itemEmoji: { fontSize: 17 },
  itemLabel: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
  },
  itemLabelPicked: { color: '#FFFFFF' },

  // ── 하단 스택 ──
  imageRegion: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  bottomStack: {
    // 이미지 아래 검정 존(root 배경) — 일반 흐름 배치라 이미지와 겹치지 않음.
    paddingTop: 14,
  },
  bottomInner: {
    gap: 12,
  },
  chipsRow: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  chipText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
  },
  composer: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.xl,
    paddingLeft: 16,
    paddingRight: 6,
    height: 52,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    paddingVertical: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
