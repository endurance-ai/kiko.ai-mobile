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
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
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
  /** 이미지 위 상대 위치·크기(0~100 %). top/left=중심 배치, width/height=썸네일
   *  정확 크롭용 바운딩 박스. */
  position?: { top: number; left: number; width?: number; height?: number };
};

const BLUR_STRONG = 30;

// 항목 버튼 세로 위치 하향 보정(%). cover 크롭에서 버튼이 살짝 위로 뜨는 걸 내림.
const POSITION_Y_SHIFT = 10;

// 항목 썸네일(동그라미) 크기(px).
const THUMB_SIZE = 34;

// 비전 bbox 중심이 살짝 위로 잡히는 편향 보정(%, 아래로 +).
const CROP_Y_BIAS = 4;
// bbox 를 살짝 넉넉히 잡아 중심 추정 오차에 덜 예민하게.
const BBOX_PAD = 1.2;

// 바운딩 박스(중심 top/left + width/height %)로 원본을 THUMB_SIZE 정사각에 크롭
// 하는 Image 스타일. 종횡비(aspect=가로/세로)를 보존한 채(cover) 박스가 정사각을
// 덮도록 확대하고, 박스 중심을 정사각 중앙에 맞춘 뒤 overflow 로 잘라낸다.
// width/height 나 aspect 없으면 null(호출부가 폴백).
function bboxCropStyle(
  pos: { top: number; left: number; width?: number; height?: number },
  aspect: number,
) {
  const bw = (pos.width ?? 0) * BBOX_PAD;
  const bh = (pos.height ?? 0) * BBOX_PAD;
  if (bw <= 0 || bh <= 0 || !aspect) return null;
  const cx = pos.left;
  const cy = pos.top + CROP_Y_BIAS; // 중심 살짝 아래로 보정
  // 종횡비 보존: 박스 가로/세로 각각을 THUMB 로 채우는 두 배율 중 큰 쪽(cover).
  const dwByWidth = (THUMB_SIZE * 100) / bw;
  const dwByHeight = ((THUMB_SIZE * 100) / bh) * aspect;
  const Dw = Math.max(dwByWidth, dwByHeight);
  const Dh = Dw / aspect;
  return {
    position: 'absolute' as const,
    width: Dw,
    height: Dh,
    left: THUMB_SIZE / 2 - (cx / 100) * Dw,
    top: THUMB_SIZE / 2 - (cy / 100) * Dh,
  };
}

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
  // 원본 이미지 종횡비(가로/세로) — 썸네일 크롭을 비율 왜곡 없이 하려면 필요.
  const [imgAspect, setImgAspect] = useState<number | null>(null);

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
      {/* 이미지 영역 — 상단 카드(모서리 라운드). 아래는 검정 존(캡션/칩·컴포저). */}
      <View style={[styles.imageRegion, { marginTop: insets.top + 6 }]}>
      {/* 원본(선명) */}
      <Image
        source={{ uri: imageUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onLoad={(e) => {
          const s = e.source;
          if (s?.width && s?.height) setImgAspect(s.width / s.height);
        }}
      />
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
        style={[styles.closeBtn, { top: 10 }]}
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
          // bbox + 원본 종횡비 있으면 그 영역만 비율 보존 크롭, 없으면 폴백.
          const thumbCrop =
            it.position && imgAspect ? bboxCropStyle(it.position, imgAspect) : null;
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
                      thumbCrop ? (
                        // bbox 영역만 비율 보존 크롭 — 확대·이동 후 overflow 로 자름.
                        <Image
                          source={{ uri: it.cropUri }}
                          style={thumbCrop}
                          contentFit="cover"
                        />
                      ) : (
                        // 폴백: bbox 없을 때 좌표로 초점(줌).
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
                      )
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

      {/* 분석 중 — 이미지 아래 검정 밴드에 세리프 캡션 (이미지는 상단 영역만). */}
      {analyzing && (
        <View style={[styles.readingArea, { paddingBottom: insets.bottom + 44 }]}>
          <Text style={styles.readingText}>이미지를 읽고 있어요</Text>
        </View>
      )}

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
  // 분석 중 이미지 아래 검정 밴드 — done 상태의 칩+컴포저 존과 비슷한 높이만
  // 차지(이미지 상단 영역은 done 과 동일하게 유지). 세리프 캡션 중앙.
  readingArea: {
    alignItems: 'center',
    paddingTop: 44,
  },
  readingText: {
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
    marginHorizontal: 12,
    borderRadius: 28,
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
