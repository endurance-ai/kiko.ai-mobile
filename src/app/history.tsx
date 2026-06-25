import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { ApiError } from '@/lib/api';
import { deleteSession, listSessions, renameSession } from '@/lib/chat';
import type { SessionSummary } from '@/types/api';

const SCREEN_W = Dimensions.get('window').width;
const GAP = 3;
const ROW_HEIGHT = (SCREEN_W - GAP * 3) / 3;

const PALETTE = [
  '#3A3A3C', '#2C2C2E', '#9C8568', '#D8D2C5', '#BFAA8B',
  '#A4946F', '#C0BBB1', '#D2C9B8', '#9C9A96', '#CDC5B5',
  '#5F5D5B', '#A09A8E', '#A99570', '#BFBDB9', '#A5996F',
];

function colorFor(seed: string, offset = 0): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[(h + offset) % PALETTE.length];
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listSessions();
      setSessions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const go = (sessionId: string) => {
    Haptic.light();
    router.push(`/chat/${sessionId}` as never);
  };

  const promptRename = useCallback((session: SessionSummary) => {
    const current = session.title || '';
    Alert.prompt(
      '제목 변경',
      undefined,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '저장',
          onPress: async (input?: string) => {
            const next = (input ?? '').trim();
            if (!next || next === current) return;
            // Optimistic local update
            setSessions((prev) =>
              prev
                ? prev.map((s) =>
                    s.session_id === session.session_id ? { ...s, title: next } : s,
                  )
                : prev,
            );
            try {
              await renameSession(session.session_id, next);
              Haptic.success();
            } catch (e) {
              // Roll back
              setSessions((prev) =>
                prev
                  ? prev.map((s) =>
                      s.session_id === session.session_id
                        ? { ...s, title: session.title }
                        : s,
                    )
                  : prev,
              );
              Haptic.error();
              Alert.alert(
                '이름 변경 실패',
                e instanceof ApiError ? e.detail : '잠시 후 다시 시도해주세요.',
              );
            }
          },
        },
      ],
      'plain-text',
      current,
    );
  }, []);

  const confirmDelete = useCallback((session: SessionSummary) => {
    Haptic.warning();
    Alert.alert(
      '대화 삭제',
      '이 대화와 모든 메시지가 영구히 지워져요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            // Optimistic remove
            const snapshot = sessions;
            setSessions((prev) =>
              prev ? prev.filter((s) => s.session_id !== session.session_id) : prev,
            );
            try {
              await deleteSession(session.session_id);
              Haptic.success();
            } catch (e) {
              setSessions(snapshot);
              Haptic.error();
              Alert.alert(
                '삭제 실패',
                e instanceof ApiError ? e.detail : '잠시 후 다시 시도해주세요.',
              );
            }
          },
        },
      ],
    );
  }, [sessions]);

  const openActions = useCallback(
    (session: SessionSummary) => {
      Haptic.medium();
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: session.title || '제목 없음',
            options: ['취소', '제목 변경', '삭제'],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 0,
          },
          (idx) => {
            if (idx === 1) promptRename(session);
            else if (idx === 2) confirmDelete(session);
          },
        );
      } else {
        Alert.alert(session.title || '제목 없음', undefined, [
          { text: '취소', style: 'cancel' },
          { text: '제목 변경', onPress: () => promptRename(session) },
          { text: '삭제', style: 'destructive', onPress: () => confirmDelete(session) },
        ]);
      }
    },
    [promptRename, confirmDelete],
  );

  const isLoading = sessions === null && !error;
  const isEmpty = sessions !== null && sessions.length === 0 && !error;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
        }
      >
        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.muted}>대화 목록을 불러오지 못했어요.</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        )}

        {isEmpty && (
          <View style={styles.center}>
            <Text style={styles.muted}>아직 대화가 없어요</Text>
            <Text style={styles.mutedSmall}>홈에서 새로운 채팅을 시작해보세요</Text>
          </View>
        )}

        {sessions?.map((s) => (
          <Pressable
            key={s.session_id}
            onPress={() => go(s.session_id)}
            onLongPress={() => openActions(s)}
            delayLongPress={350}
            style={styles.row}
          >
            <View style={styles.thumbStrip}>
              <View style={[styles.thumb, { backgroundColor: colorFor(s.session_id, 0) }]} />
              <View style={[styles.thumb, { backgroundColor: colorFor(s.session_id, 1) }]} />
              <View style={[styles.thumb, { backgroundColor: colorFor(s.session_id, 2) }]} />
            </View>
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={1}>
                {s.title || '제목 없음'}
              </Text>
              <Text style={styles.time}>{formatTime(s.last_message_at)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <FloatingHeader title="히스토리" backLabel="채팅" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  body: {
    gap: GAP,
  },
  row: {
    width: SCREEN_W,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: IOSColors.systemBackground,
  },
  thumbStrip: {
    flexDirection: 'row',
    gap: 2,
  },
  thumb: {
    width: ROW_HEIGHT * 0.28,
    height: ROW_HEIGHT * 0.28,
    borderRadius: 6,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    fontWeight: '600',
  },
  time: {
    ...IOSText.caption1,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 8,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  mutedSmall: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },
  retry: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  retryText: {
    ...IOSText.callout,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
});
