/**
 * 검색 컴포저 — 하단 고정 입력창(제안 칩 없음). 홈 컴포저의 글래스 룩을 그대로
 * 쓰되 text 상태를 이 컴포넌트가 소유해, 타이핑이 부모 화면을 리렌더하지 않는다.
 * 편집샵 등 "여기서 바로 검색 시작" 표면에서 재사용. 전송 시 onSubmit(text) 호출.
 *
 * 미포커싱(idle) 상태에서는 컴포저 뒤에 흰 페이드(KeyboardScrim)를 깔아 스크롤
 * 콘텐츠가 글래스 아래로 비치는 걸 막는다(홈 랜딩과 동일 문법).
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { GlassSurface } from '@/components/glass-surface';
import { KeyboardScrim } from '@/components/keyboard-scrim';
import {
  Elevation,
  IOSColors,
  IOSFont,
  IOSText,
  Opacity,
  Radius,
} from '@/theme';

export function SearchComposer({
  placeholder = '무엇이든 물어보세요',
  scopeLabel,
  onSubmit,
}: {
  placeholder?: string;
  /** 검색 범위 표시 칩 라벨(예: 편집샵 이름). 있으면 컴포저 위에 상시 노출 —
   *  "여기(이 표면)에서 검색됨"을 사용자에게 알린다. */
  scopeLabel?: string;
  /** 전송 — 공백 제거된 텍스트 + 스코프 유지 여부(칩 ✕ 안 눌렀으면 true). */
  onSubmit: (text: string, scoped: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [composerH, setComposerH] = useState(0);
  // 스코프 유지 여부 — scopeLabel 이 있으면 기본 on. 칩 ✕ 로 해제하면 이 컴포저
  // 에서의 검색이 전체 대상으로 나간다.
  const [scoped, setScoped] = useState(true);

  const canSend = text.trim().length > 0;
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t, !!scopeLabel && scoped);
    setText('');
  };

  return (
    <>
      {/* idle(비포커싱) 컴포저 뒤 흰 페이드 — 위로 갈수록 더 투명한 그라데이션.
          홈 랜딩과 동일 비율(solid 최소 + fade 지배). */}
      {!focused && composerH > 0 && (
        <KeyboardScrim
          solidHeight={composerH * 0.15}
          fadeHeight={composerH * 0.55}
          peak={0.55}
          rightDrop={0}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.float}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.wrap,
            // 포커스(키보드 오픈) 시엔 홈 인디케이터 인셋이 키보드에 가려 불필요 →
            // 8 로 좁혀 컴포저-키보드 갭 제거. 닫힘 땐 안전영역 확보(홈 컴포저 동일).
            { paddingBottom: focused ? 8 : insets.bottom + 12 },
          ]}
          onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}
        >
          {/* 검색 범위 칩 — 이 편집샵에서 검색됨을 표시. ✕ 로 해제하면 전체 검색.
              해제 시 툭 사라지지 않게 페이드 아웃(비터치 요소라 timing). */}
          {scopeLabel && scoped ? (
            <Animated.View
              style={styles.scopeRow}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(220)}
            >
              <Pressable
                style={styles.scopeChip}
                onPress={() => setScoped(false)}
                accessibilityRole="button"
                accessibilityLabel={`${scopeLabel} 검색 범위 해제`}
              >
                <Text style={styles.scopeChipText} numberOfLines={1}>
                  {scopeLabel}
                </Text>
                <SymbolView
                  name="xmark.circle.fill"
                  size={16}
                  tintColor={IOSColors.tertiaryLabel}
                />
              </Pressable>
            </Animated.View>
          ) : null}
          <View style={styles.shadow}>
            <GlassSurface
              variant="composer"
              tintColor={IOSColors.systemBackground}
              style={styles.composer}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={placeholder}
                placeholderTextColor={IOSColors.placeholderText}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={send}
              />
              <Pressable
                hitSlop={6}
                disabled={!canSend}
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={send}
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
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  scopeRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.tertiarySystemBackground,
    maxWidth: '85%',
  },
  scopeChipText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    flexShrink: 1,
  },
  shadow: {
    borderRadius: Radius.xxl,
    ...Elevation.lifted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: Radius.xxl,
    paddingLeft: 16,
    paddingRight: 6,
    overflow: 'hidden',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: Opacity.faint,
  },
});
