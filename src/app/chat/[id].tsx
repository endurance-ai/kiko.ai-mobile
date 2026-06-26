import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { getMessages } from '@/lib/chat';
import type { MessageItem, ProductRef } from '@/types/api';

const PAGE_SIZE = 30;

function ProductCard({ ref: product }: { ref: ProductRef }) {
  return (
    <View style={styles.productCard}>
      <Image source={product.image_url} style={styles.productImage} contentFit="cover" />
      <Text style={styles.productCaption} numberOfLines={3}>
        {/* caption may contain HTML — strip simple tags for now */}
        {product.caption.replace(/<[^>]+>/g, '')}
      </Text>
    </View>
  );
}

function MessageRow({ item }: { item: MessageItem }) {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.msg, isUser ? styles.msgUser : styles.msgAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
          ]}
        >
          {item.content}
        </Text>
      </View>
      {item.product_refs && item.product_refs.length > 0 && (
        <View style={styles.productsRow}>
          {item.product_refs.map((p, i) => (
            <ProductCard key={`${item.message_id}:${i}`} ref={p} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<MessageItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadInitial = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await getMessages(id, { limit: PAGE_SIZE });
      setMessages(res.messages);
      setNextCursor(res.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
      setMessages([]);
    }
  }, [id]);

  const loadOlder = useCallback(async () => {
    if (!id || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getMessages(id, { cursor: nextCursor, limit: PAGE_SIZE });
      setMessages((prev) => [...(prev ?? []), ...res.messages]);
      setNextCursor(res.next_cursor);
    } catch {
      // ignore — user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  }, [id, nextCursor, loadingMore]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const isLoading = messages === null && !error;
  const isEmpty = messages !== null && messages.length === 0 && !error;

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

      {isEmpty && (
        <View style={styles.center}>
          <Text style={styles.muted}>메시지가 없어요</Text>
        </View>
      )}

      {messages && messages.length > 0 && (
        <FlatList
          data={messages}
          keyExtractor={(m) => m.message_id}
          renderItem={MessageRow}
          contentContainerStyle={{
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            paddingBottom: insets.bottom + 24,
          }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ paddingVertical: 16 }} /> : null
          }
        />
      )}

      <FloatingHeader title="대화" backLabel="히스토리" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
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
  msg: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  msgUser: {
    alignItems: 'flex-end',
  },
  msgAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#0A84FF',
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: IOSColors.systemBackground,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    ...IOSText.body,
    fontFamily: IOSFont.rounded,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  bubbleTextAssistant: {
    color: IOSColors.label,
  },
  productsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  productCard: {
    width: 120,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: 120,
    height: 150,
  },
  productCaption: {
    ...IOSText.caption1,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    padding: 8,
  },
});
