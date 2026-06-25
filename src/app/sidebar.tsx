import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';

const SCREEN_W = Dimensions.get('window').width;
const PANEL_W = Math.min(SCREEN_W * 0.82, 360);

type Thread = { id: string; title: string; meta: string; current?: boolean };

const HISTORY: Thread[] = [
  { id: 't1', title: '크림톤 오버셔츠', meta: '방금', current: true },
  { id: 't2', title: '와이드 데님 빈티지', meta: '어제' },
  { id: 't3', title: '가을 트렌치 무드', meta: '3일 전' },
  { id: 't4', title: '미니멀 골드 주얼리', meta: '지난주' },
  { id: 't5', title: '실크 블라우스 · 미니멀', meta: '지난주' },
  { id: 't6', title: '워크웨어 아우터', meta: '2주 전' },
];

const OPEN_MS = 260;
const CLOSE_MS = 200;

export default function SidebarScreen() {
  const [search, setSearch] = useState('');
  const visible = HISTORY.filter((h) =>
    search.trim() ? h.title.includes(search.trim()) : true,
  );

  const slide = useRef(new Animated.Value(-PANEL_W)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dim, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [slide, dim]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: -PANEL_W,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dim, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => router.back());
  };

  return (
    <View style={styles.root}>
      {/* Right dimmed backdrop — sits behind panel so panel renders on top */}
      <Animated.View style={[styles.backdrop, { opacity: dim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Drawer panel — slides from left */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateX: slide }] }]}
      >
        <SafeAreaView edges={['top']} style={styles.panelInner}>
          <View style={styles.body}>
            <Text style={styles.brand}>Kiko.</Text>

            <Pressable
              style={styles.newChatBtn}
              onPress={() => {
                Haptic.medium();
                close();
                // TODO: reset chat state when wired
              }}
            >
              <SymbolView
                name="plus"
                size={16}
                tintColor={IOSColors.systemBackground}
                weight="bold"
              />
              <Text style={styles.newChatText}>새 채팅 만들기</Text>
            </Pressable>

            <View style={styles.searchBox}>
              <SymbolView
                name="magnifyingglass"
                size={14}
                tintColor={IOSColors.tertiaryLabel}
                weight="medium"
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="검색"
                placeholderTextColor={IOSColors.placeholderText}
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.sectionLabel}>히스토리</Text>
            <ScrollView
              contentContainerStyle={styles.historyList}
              showsVerticalScrollIndicator={false}
            >
              {visible.map((h) => (
                <Pressable
                  key={h.id}
                  style={[styles.historyRow, h.current && styles.historyRowActive]}
                  onPress={() => {
                    Haptic.light();
                    close();
                  }}
                >
                  <Text
                    style={[
                      styles.historyTitle,
                      h.current && styles.historyTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {h.title}
                  </Text>
                  <Text style={styles.historyMeta}>{h.meta}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Bottom profile + settings */}
          <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>현</Text>
              </View>
              <Text style={styles.profileLabel}>프로필 설정</Text>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  Haptic.light();
                  // Run sidebar close animation, THEN push the settings sheet —
                  // `router.replace` from a transparentModal into a formSheet
                  // skips the dismissal animation and leaves the formSheet
                  // without its native header chrome.
                  Animated.parallel([
                    Animated.timing(slide, {
                      toValue: -PANEL_W,
                      duration: CLOSE_MS,
                      easing: Easing.in(Easing.cubic),
                      useNativeDriver: true,
                    }),
                    Animated.timing(dim, {
                      toValue: 0,
                      duration: CLOSE_MS,
                      easing: Easing.in(Easing.cubic),
                      useNativeDriver: true,
                    }),
                  ]).start(() => {
                    router.back();
                    setTimeout(() => router.push('/settings'), 30);
                  });
                }}
              >
                <SymbolView
                  name="gearshape"
                  size={22}
                  tintColor={IOSColors.label}
                  weight="medium"
                />
              </Pressable>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_W,
    backgroundColor: IOSColors.secondarySystemBackground,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
  },
  panelInner: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  brand: {
    ...IOSText.title1,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 18,
  },

  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 999,
    backgroundColor: IOSColors.label,
  },
  newChatText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  sectionLabel: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    marginTop: 20,
    marginBottom: 8,
    fontFamily: IOSFont.rounded,
  },

  historyList: {
    paddingBottom: 16,
  },
  historyRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  historyRowActive: {
    backgroundColor: IOSColors.systemGray5,
  },
  historyTitle: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  historyTitleActive: {
    fontWeight: '600',
  },
  historyMeta: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },

  bottomSafe: {
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...IOSText.footnote,
    fontWeight: '700',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
  profileLabel: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    flex: 1,
    fontFamily: IOSFont.rounded,
  },
});
