import { router } from 'expo-router';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';

// One history group = one chat turn's worth of activity. The user can have
// landed here from a fresh mood image (→ result list), from drilling into a
// product detail, or from tapping into a saved list. Each group renders as a
// mosaic block with a count chip on the lead tile; tapping anywhere routes
// the user back into the canonical list view (`/list`).

type Pattern = 'A' | 'B' | 'C';

type HistoryGroup = {
  id: string;
  count: number;
  // Color hints for the mosaic tiles — replaced by actual product / mood
  // image URLs once the backend hands us real thumbs.
  thumbs: string[];
  pattern: Pattern;
};

const SCREEN_W = Dimensions.get('window').width;
const GAP = 3;

// Mock palette stays grayscale / warm beige to honour the project's neutral
// concept; backend will provide real CDN image URLs.
const MOCK_HISTORY: HistoryGroup[] = [
  {
    id: 'h1',
    count: 24,
    pattern: 'A',
    thumbs: ['#3A3A3C', '#2C2C2E', '#9C8568', '#D8D2C5', '#BFAA8B'],
  },
  {
    id: 'h2',
    count: 8,
    pattern: 'B',
    thumbs: ['#2A2A2C', '#A4946F', '#3D3D3F', '#C0BBB1', '#D2C9B8'],
  },
  {
    id: 'h3',
    count: 14,
    pattern: 'A',
    thumbs: ['#9C9A96', '#CDC5B5', '#3F3F41', '#5F5D5B', '#A09A8E'],
  },
  {
    id: 'h4',
    count: 6,
    pattern: 'C',
    thumbs: ['#A99570', '#7C7B7A', '#BFBDB9'],
  },
  {
    id: 'h5',
    count: 11,
    pattern: 'C',
    thumbs: ['#3F3F41', '#A5996F', '#2E2E30'],
  },
];

const BIG = (SCREEN_W - GAP * 3) * 0.66;
const SMALL_HALF = (SCREEN_W - GAP * 3) * 0.34 / 2;
const ROW_TALL = BIG; // matched height for the big tile
const ROW_SHORT = (SCREEN_W - GAP * 3) / 3;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();

  const go = (id: string) => {
    Haptic.light();
    // Placeholder — eventually `/list?session=${id}` once the list page accepts
    // a session filter. For now route to the canonical mock list.
    router.push('/list');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_HISTORY.map((g) => (
          <Pressable key={g.id} onPress={() => go(g.id)} style={styles.group}>
            {g.pattern === 'A' && <PatternA group={g} />}
            {g.pattern === 'B' && <PatternB group={g} />}
            {g.pattern === 'C' && <PatternC group={g} />}
          </Pressable>
        ))}
      </ScrollView>

      <FloatingHeader title="히스토리" backLabel="채팅" />
    </View>
  );
}

function CountChip({ count }: { count: number }) {
  return (
    <View style={styles.countChip} pointerEvents="none">
      <Text style={styles.countText}>{count}</Text>
    </View>
  );
}

function Tile({
  color,
  style,
  withCount,
}: {
  color: string;
  style?: object;
  withCount?: number;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: color }, style]}>
      {withCount !== undefined && <CountChip count={withCount} />}
    </View>
  );
}

// Big tile left + 2×2 small cluster right (count chip on top-right small tile)
function PatternA({ group }: { group: HistoryGroup }) {
  const [a, b, c, d, e] = group.thumbs;
  return (
    <View style={styles.rowAB}>
      <Tile color={a} style={{ width: BIG, height: ROW_TALL }} />
      <View style={{ marginLeft: GAP, gap: GAP }}>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Tile color={b} style={{ width: SMALL_HALF, height: SMALL_HALF }} />
          <Tile
            color={c}
            style={{ width: SMALL_HALF, height: SMALL_HALF }}
            withCount={group.count}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Tile color={d} style={{ width: SMALL_HALF, height: SMALL_HALF }} />
          <Tile color={e} style={{ width: SMALL_HALF, height: SMALL_HALF }} />
        </View>
      </View>
    </View>
  );
}

// 2×2 cluster left + big tile right (count chip on top-right small)
function PatternB({ group }: { group: HistoryGroup }) {
  const [a, b, c, d, e] = group.thumbs;
  return (
    <View style={styles.rowAB}>
      <View style={{ gap: GAP }}>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Tile color={a} style={{ width: SMALL_HALF, height: SMALL_HALF }} />
          <Tile
            color={b}
            style={{ width: SMALL_HALF, height: SMALL_HALF }}
            withCount={group.count}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Tile color={c} style={{ width: SMALL_HALF, height: SMALL_HALF }} />
          <Tile color={d} style={{ width: SMALL_HALF, height: SMALL_HALF }} />
        </View>
      </View>
      <Tile color={e} style={{ width: BIG, height: ROW_TALL, marginLeft: GAP }} />
    </View>
  );
}

// 3 equal tiles in a row
function PatternC({ group }: { group: HistoryGroup }) {
  const [a, b, c] = group.thumbs;
  return (
    <View style={styles.rowC}>
      <Tile color={a} style={{ width: ROW_SHORT, height: ROW_SHORT }} />
      <Tile
        color={b}
        style={{ width: ROW_SHORT, height: ROW_SHORT }}
        withCount={group.count}
      />
      <Tile color={c} style={{ width: ROW_SHORT, height: ROW_SHORT }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  body: {
    gap: GAP,
  },
  group: {
    width: SCREEN_W,
  },
  rowAB: {
    flexDirection: 'row',
    width: SCREEN_W,
  },
  rowC: {
    flexDirection: 'row',
    gap: GAP,
    width: SCREEN_W,
  },
  tile: {
    overflow: 'hidden',
    position: 'relative',
  },
  countChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(28,28,30,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    ...IOSText.caption1,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: IOSFont.rounded,
  },
});
