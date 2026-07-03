import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Banner } from "@/components/banner";
import { GlassSurface } from "@/components/glass-surface";
import {
  FLOATING_HEADER_OFFSET,
  FloatingHeader,
} from "@/components/floating-header";
import { Haptic, IOSColors, IOSFont, IOSText } from "@/constants/ios";
import { getMessages, sendMessageStream } from "@/lib/chat";
import {
  isCapExhausted,
  type CapMeta,
  type CapReachedInfo,
  type ChatStreamController,
} from "@/lib/sse";
import { useBanner } from "@/state/banner";
import { useCap } from "@/state/cap";
import type { MessageItem, ProductRef } from "@/types/api";

const PAGE_SIZE = 30;

function ProductCardSmall({ product }: { product: ProductRef }) {
  return (
    <View style={styles.productCard}>
      <Image
        source={product.image_url}
        style={styles.productImage}
        contentFit="cover"
      />
      <Text style={styles.productCaption} numberOfLines={3}>
        {product.caption.replace(/<[^>]+>/g, "")}
      </Text>
    </View>
  );
}

function MessageRow({ item }: { item: MessageItem }) {
  const isUser = item.role === "user";
  // 어시스턴트 응답이 길어질 때 하나의 거대 버블 대신 문단 단위로 나눔.
  // 유저 메시지는 원문 유지 (짧고, 나누면 의도가 왜곡될 수 있음).
  const segments = isUser
    ? [item.content]
    : (item.content ?? "")
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);
  const displaySegments = segments.length > 0 ? segments : [""];
  return (
    <View style={[styles.msg, isUser ? styles.msgUser : styles.msgAssistant]}>
      {displaySegments.map((seg, i) => (
        <View
          key={i}
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            i > 0 && { marginTop: 6 },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}
          >
            {seg}
          </Text>
        </View>
      ))}
      {item.product_refs && item.product_refs.length > 0 && (
        <View style={styles.productsRow}>
          {item.product_refs.map((p, i) => (
            <ProductCardSmall key={`${item.message_id}:${i}`} product={p} />
          ))}
        </View>
      )}
    </View>
  );
}

function makeLocalMessage(
  role: "user" | "assistant",
  content: string,
  productRefs: ProductRef[] | null = null,
): MessageItem {
  return {
    message_id: `local:${role}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    product_refs: productRefs,
    created_at: new Date().toISOString(),
  };
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { show: showBanner, clear: clearBanner } = useBanner();
  const {
    locked: capLocked,
    applyMeta: applyCapMeta,
    markReached: markCapReached,
  } = useCap();
  const [messages, setMessages] = useState<MessageItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<MessageItem> | null>(null);

  const loadInitial = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await getMessages(id, { limit: PAGE_SIZE });
      setMessages(res.messages);
      setNextCursor(res.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
      setMessages([]);
    }
  }, [id]);

  const loadOlder = useCallback(async () => {
    if (!id || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getMessages(id, {
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setMessages((prev) => [...(prev ?? []), ...res.messages]);
      setNextCursor(res.next_cursor);
    } catch {
      // ignore — pull to refresh would be the recovery
    } finally {
      setLoadingMore(false);
    }
  }, [id, nextCursor, loadingMore]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  const streamRef = useRef<ChatStreamController | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stall timeout — 이벤트 없이 조용하면 스트림 취소.
  //   텍스트만: 10s (검색 RPC + diversify 만)
  //   URL 포함: 20s (link_resolver → vision LLM → search → diversify)
  const STREAM_STALL_MS_TEXT = 10_000;
  const STREAM_STALL_MS_MEDIA = 20_000;
  const URL_RE = /https?:\/\/\S+/i;

  useEffect(() => {
    return () => {
      streamRef.current?.cancel();
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    };
  }, []);

  const sendText = useCallback(
    (trimmed: string) => {
      if (!id) return;
      if (capLocked) return; // 캡 잠금 시 재시도/새 전송 모두 차단
      clearBanner("request-failure");
      setSending(true);

      const userMsg = makeLocalMessage("user", trimmed);
      const assistantMsg = makeLocalMessage("assistant", "");
      setMessages((prev) => [...(prev ?? []), userMsg, assistantMsg]);
      scrollToEnd();

      const updateAssistant = (mut: (m: MessageItem) => MessageItem) => {
        setMessages((prev) =>
          (prev ?? []).map((m) =>
            m.message_id === assistantMsg.message_id ? mut(m) : m,
          ),
        );
      };

      // 캡 소진 이벤트를 봤는지 플래그. fireStall / onError 에서 이걸 참조해
      // 에러 배너가 캡 배너를 덮는 걸 방지한다.
      let capHitThisTurn = false;
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
        setMessages((prev) =>
          (prev ?? []).filter(
            (m) =>
              m.message_id !== userMsg.message_id &&
              m.message_id !== assistantMsg.message_id,
          ),
        );
        setSending(false);
        // 캡 소진 배너가 이미 떠 있으면 에러 배너로 덮지 않음.
        if (capHitThisTurn) return;
        Haptic.error();
        showBanner({
          id: "request-failure",
          priority: "error",
          title: "응답이 늦어져 요청을 취소했어요",
          subtitle: "다시 시도해주세요",
          action: {
            label: "다시 시도",
            onPress: () => sendText(trimmed),
          },
        });
      };
      const stallMs = URL_RE.test(trimmed)
        ? STREAM_STALL_MS_MEDIA
        : STREAM_STALL_MS_TEXT;
      const bumpTimeout = () => {
        killTimeout();
        streamTimeoutRef.current = setTimeout(fireStall, stallMs);
      };
      bumpTimeout();

      streamRef.current = sendMessageStream(id, trimmed, {
        onSession: (_sessionId: string, cap?: CapMeta) => {
          bumpTimeout();
          if (!cap) return;
          applyCapMeta(cap);
          if (isCapExhausted(cap)) {
            // 이 세션 시점에 이미 캡 소진 (다른 세션에서 다 썼을 가능성).
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
            clearBanner("chat-cap-reached");
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
        },
        onTextDelta: (delta) => {
          bumpTimeout();
          updateAssistant((m) => ({ ...m, content: m.content + delta }));
          scrollToEnd();
        },
        onProduct: (product) => {
          bumpTimeout();
          updateAssistant((m) => ({
            ...m,
            product_refs: [...(m.product_refs ?? []), product],
          }));
          scrollToEnd();
        },
        onCapReached: (info: CapReachedInfo) => {
          killTimeout();
          capHitThisTurn = true;
          // 이 화면의 낙관적 assistant/user 버블 제거 후 캡 잠금.
          setMessages((prev) =>
            (prev ?? []).filter(
              (m) =>
                m.message_id !== userMsg.message_id &&
                m.message_id !== assistantMsg.message_id,
            ),
          );
          setSending(false);
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
          killTimeout();
          setSending(false);
          streamRef.current = null;
        },
        onError: () => {
          killTimeout();
          setMessages((prev) =>
            (prev ?? []).filter(
              (m) =>
                m.message_id !== userMsg.message_id &&
                m.message_id !== assistantMsg.message_id,
            ),
          );
          setSending(false);
          streamRef.current = null;
          // 캡 소진으로 스트림이 닫힌 케이스면 캡 배너가 이미 떠 있어야 함.
          if (capHitThisTurn) return;
          Haptic.error();
          showBanner({
            id: "request-failure",
            priority: "error",
            title: "요청을 처리하지 못했어요",
            action: {
              label: "다시 시도",
              onPress: () => sendText(trimmed),
            },
          });
        },
      });
    },
    [
      id,
      scrollToEnd,
      showBanner,
      clearBanner,
      applyCapMeta,
      markCapReached,
      capLocked,
    ],
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || sending || capLocked) return;
    Haptic.medium();
    setText("");
    sendText(trimmed);
  }, [text, sending, capLocked, sendText]);

  const canSend = !sending && !capLocked && text.trim().length > 0;
  const isLoading = messages === null && !error;
  const isEmpty = messages !== null && messages.length === 0 && !error;

  const composerBottom = useMemo(() => insets.bottom + 12, [insets.bottom]);

  return (
    <View style={styles.root}>
      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.muted}>대화를 불러오지 못했어요.</Text>
          <Pressable onPress={() => void loadInitial()} style={styles.retry}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {messages && (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.message_id}
          renderItem={({ item }) => <MessageRow item={item} />}
          contentContainerStyle={{
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            paddingBottom: composerBottom + 80,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={loadOlder}
          onEndReachedThreshold={0.5}
          onContentSizeChange={() => {
            if (messages.length > 0 && !loadingMore) {
              // best-effort: keep view pinned to bottom when new messages stream in
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          ListEmptyComponent={
            isEmpty ? (
              <View style={styles.center}>
                <Text style={styles.muted}>
                  메시지를 입력해 대화를 시작해보세요
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ paddingVertical: 16 }} />
            ) : null
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.composerFloat}
        pointerEvents="box-none"
      >
        <View style={[styles.composerWrap, { paddingBottom: composerBottom }]}>
          <Banner />
          <GlassSurface variant="composer" style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                capLocked
                  ? "오늘 사용량이 다 소진됐어요"
                  : sending
                    ? "키코가 답하는 중..."
                    : "메시지를 입력하세요"
              }
              placeholderTextColor={IOSColors.placeholderText}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!sending && !capLocked}
              multiline
            />
            <Pressable
              hitSlop={6}
              disabled={!canSend}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSend}
            >
              {sending ? (
                <ActivityIndicator
                  size="small"
                  color={IOSColors.systemBackground}
                />
              ) : (
                <SymbolView
                  name="arrow.up"
                  size={18}
                  tintColor={IOSColors.systemBackground}
                  weight="bold"
                />
              )}
            </Pressable>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>

      <FloatingHeader title="대화" backLabel="히스토리" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 8,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
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
    fontFamily: IOSFont.sans,
  },
  msg: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  msgUser: {
    alignItems: "flex-end",
  },
  msgAssistant: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: IOSColors.label,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: IOSColors.systemBackground,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    ...IOSText.body,
    fontFamily: IOSFont.sans,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: IOSColors.systemBackground,
  },
  bubbleTextAssistant: {
    color: IOSColors.label,
  },
  productsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  productCard: {
    width: 120,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: 12,
    overflow: "hidden",
  },
  productImage: {
    width: 120,
    height: 150,
  },
  productCaption: {
    ...IOSText.caption1,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    padding: 8,
  },
  composerFloat: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 52,
    borderRadius: 26,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    paddingVertical: 8,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: IOSColors.label,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
