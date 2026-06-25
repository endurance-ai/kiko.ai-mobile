import { SymbolView } from 'expo-symbols';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { formatKoreanDate, useSubscription } from '@/state/subscription';

const BENEFITS = [
  {
    title: '무제한 디깅',
    hint: '하루 검색 · 보정 제한 없이',
  },
  {
    title: '취향 기억 + 트리거 알림',
    hint: '"찜한 거랑 비슷한 신상 떴어"',
  },
  {
    title: '희소 브랜드 우선 접근',
    hint: 'K-디자이너 · 인디 인벤토리',
  },
];

export default function BillingScreen() {
  const { subscription, activate } = useSubscription();

  if (!subscription.active) return <PitchView onActivate={activate} />;
  return <ManageView />;
}

// ── ⓐ Pitch (not subscribed) ─────────────────────────────────────────────

function PitchView({ onActivate }: { onActivate: () => void }) {
  const insets = useSafeAreaInsets();
  const handleSubscribe = () => {
    Haptic.medium();
    // TODO: StoreKit2 → POST /iap/verify (Server Notifications v2 reconciles state).
    onActivate();
    Haptic.success();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.pitchBody,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotBox}>
          <Text style={styles.mascotEmoji}>🐱</Text>
        </View>

        <Text style={styles.pitchH1}>당신의 취향을{'\n'}아는 디깅 고양이</Text>
        <Text style={styles.pitchSub}>
          찜과 검색을 기억하고, 새 무드가 들어오면{'\n'}먼저 찾아다 주는 개인 쇼퍼.
        </Text>

        <View style={styles.benefitList}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.checkBox}>
                <SymbolView
                  name="checkmark"
                  size={14}
                  tintColor={IOSColors.label}
                  weight="bold"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitHint}>{b.hint}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.pitchFooter}>
        <Text style={styles.priceLine}>
          월 <Text style={styles.priceAmount}>₩7,900</Text> · 7일 무료 체험
        </Text>
        <Pressable style={styles.subscribeBtn} onPress={handleSubscribe}>
          <SymbolView
            name="applelogo"
            size={16}
            tintColor="#FFFFFF"
            weight="medium"
          />
          <Text style={styles.subscribeText}>App Store로 구독</Text>
        </Pressable>
        <Text style={styles.disclaimer}>
          결제는 App Store 계정으로 진행돼요. 언제든 해지할 수 있어요.{'\n'}
          <Text style={styles.link}>이용약관</Text> ·{' '}
          <Text style={styles.link}>개인정보 처리방침</Text>
        </Text>
      </SafeAreaView>

      <FloatingHeader title="Kiko 멤버십" />
    </View>
  );
}

// ── ⓑ Manage (subscribed) ────────────────────────────────────────────────

function ManageView() {
  const insets = useSafeAreaInsets();
  const { subscription } = useSubscription();

  const handleManage = () => {
    Haptic.light();
    // TODO: Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')
    Alert.alert(
      'App Store 구독 관리',
      '실제 앱에서는 App Store 의 구독 관리 화면으로 이동해요.',
      [{ text: '확인', style: 'default' }],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.manageBody,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan card */}
        <View style={styles.planCard}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>구독 중</Text>
          </View>
          <Text style={styles.planTitle}>Kiko 멤버십</Text>
          <Text style={styles.planSub}>월 ₩7,900 · 자동 갱신</Text>
        </View>

        {/* Info table */}
        <View style={styles.infoCard}>
          <InfoRow label="상태" valueColor={IOSColors.systemGreen} value="활성" />
          <InfoRow
            label="다음 결제일"
            value={formatKoreanDate(subscription.nextBillingAt)}
          />
          <InfoRow label="결제 수단" value="App Store" />
          <InfoRow
            label="가입일"
            value={formatKoreanDate(subscription.startedAt)}
            last
          />
        </View>

        {/* Manage button */}
        <Pressable style={styles.manageBtn} onPress={handleManage}>
          <Text style={styles.manageText}>App Store에서 구독 관리</Text>
          <SymbolView
            name="chevron.right"
            size={14}
            tintColor={IOSColors.label}
            weight="semibold"
          />
        </Pressable>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            구독 해지 · 결제 수단 변경은 App Store 구독 관리에서 진행돼요. 해지해도
            결제 기간 끝까지 멤버십이 유지돼요.
          </Text>
        </View>
      </ScrollView>

      <FloatingHeader title="결제" />
    </View>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
  last,
}: {
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },

  // ── Pitch ──
  pitchBody: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  mascotBox: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: IOSColors.tertiarySystemBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  mascotEmoji: { fontSize: 44 },

  pitchH1: {
    ...IOSText.title1,
    fontWeight: '700',
    color: IOSColors.label,
    textAlign: 'center',
    fontFamily: IOSFont.rounded,
    lineHeight: 38,
  },
  pitchSub: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 22,
    fontFamily: IOSFont.rounded,
  },

  benefitList: {
    width: '100%',
    gap: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IOSColors.tertiarySystemBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  benefitTitle: {
    ...IOSText.body,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  benefitHint: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },

  pitchFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
    backgroundColor: IOSColors.secondarySystemBackground,
  },
  priceLine: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    fontFamily: IOSFont.rounded,
  },
  priceAmount: {
    ...IOSText.title3,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 999,
    backgroundColor: IOSColors.label,
  },
  subscribeText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
  disclaimer: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: IOSFont.rounded,
  },
  link: {
    color: IOSColors.secondaryLabel,
    textDecorationLine: 'underline',
  },

  // ── Manage ──
  manageBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  planCard: {
    padding: 22,
    borderRadius: 20,
    backgroundColor: IOSColors.label,
    gap: 8,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: 4,
  },
  statusPillText: {
    ...IOSText.caption1,
    fontWeight: '700',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
  planTitle: {
    ...IOSText.title2,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
  planSub: {
    ...IOSText.subhead,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: IOSFont.rounded,
  },

  infoCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  infoLabel: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  infoValue: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  manageText: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  noticeCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  noticeText: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    lineHeight: 18,
    fontFamily: IOSFont.rounded,
  },
});
