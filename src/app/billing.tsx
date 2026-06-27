import { SymbolView } from 'expo-symbols';
import {
  Alert,
  Linking,
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

const PRO_ACCENT = '#4F46E5';

type FeatureRow = {
  label: string;
  free: 'check' | 'dash';
  pro: 'check' | 'dash';
};

const FEATURES: FeatureRow[] = [
  { label: '코어 디깅 모델', free: 'check', pro: 'check' },
  { label: '더 많은 메시지', free: 'dash', pro: 'check' },
  { label: '더 높은 업로드 한도', free: 'dash', pro: 'check' },
  { label: '더 많은 메모리', free: 'dash', pro: 'check' },
  { label: '새 기능 얼리 액세스', free: 'dash', pro: 'check' },
];

const COMING_SOON = ['최신 브랜드 발매/세일 자동 트래커', '백그라운드 서칭'];

export default function BillingScreen() {
  const { subscription } = useSubscription();
  return subscription.active ? <ManageView /> : <UpgradeView />;
}

// ── Upgrade (not subscribed) ─────────────────────────────────────────────

function UpgradeView() {
  const insets = useSafeAreaInsets();
  const { activate } = useSubscription();

  const handleUpgrade = () => {
    Haptic.medium();
    // TODO: StoreKit2 purchase -> POST /v1/iap/verify
    activate();
    Haptic.success();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.upgradeBody,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sparkleWrap}>
          <SymbolView
            name="sparkles"
            size={32}
            tintColor={PRO_ACCENT}
            weight="medium"
          />
        </View>

        <Text style={styles.upgradeTitle}>Kiko Pro{'\n'}이용하기</Text>
        <Text style={styles.upgradeSub}>
          확장된 액세스 권한으로 더 많은 브랜드를 발견하기
        </Text>

        <View style={styles.featureCard}>
          <View style={styles.featureHeaderRow}>
            <Text style={styles.featureLabel}>기능</Text>
            <Text style={styles.featureColumnHeader}>Free</Text>
            <Text style={[styles.featureColumnHeader, { color: PRO_ACCENT }]}>Pro</Text>
          </View>
          {FEATURES.map((f, idx) => (
            <View
              key={f.label}
              style={[
                styles.featureRow,
                idx > 0 && styles.featureRowDivider,
              ]}
            >
              <Text style={styles.featureRowLabel}>{f.label}</Text>
              <FeatureMark kind={f.free} muted />
              <FeatureMark kind={f.pro} color={PRO_ACCENT} />
            </View>
          ))}
        </View>

        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonHeader}>Pro의 더 많은 기능 준비 중</Text>
          {COMING_SOON.map((label) => (
            <Text key={label} style={styles.comingSoonItem}>
              {label}
            </Text>
          ))}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.upgradeFooter}>
        <Pressable style={styles.upgradeBtn} onPress={handleUpgrade}>
          <Text style={styles.upgradeBtnText}>₩9,900에 업그레이드</Text>
        </Pressable>
        <Text style={styles.upgradeDisclaimer}>
          매월 자동 청구. 언제든 취소할 수 있습니다.
        </Text>
      </SafeAreaView>

      <FloatingHeader title="결제" />
    </View>
  );
}

function FeatureMark({
  kind,
  color,
  muted,
}: {
  kind: 'check' | 'dash';
  color?: string;
  muted?: boolean;
}) {
  if (kind === 'dash') {
    return (
      <View style={styles.featureCell}>
        <Text style={[styles.featureDash, muted && styles.featureDashMuted]}>—</Text>
      </View>
    );
  }
  return (
    <View style={styles.featureCell}>
      <SymbolView
        name="checkmark"
        size={18}
        tintColor={muted ? IOSColors.tertiaryLabel : color ?? IOSColors.label}
        weight="bold"
      />
    </View>
  );
}

// ── Manage (subscribed) ──────────────────────────────────────────────────

function ManageView() {
  const insets = useSafeAreaInsets();
  const { subscription } = useSubscription();

  const handleManage = async () => {
    Haptic.light();
    await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
  };

  const handleRestore = () => {
    Haptic.light();
    // TODO: StoreKit2 transaction restore -> POST /v1/iap/restore
    Alert.alert('구매 복원', '복원할 구매 내역이 없거나 이미 동기화됐어요.');
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
        <View style={styles.planCard}>
          <View style={styles.planTopRow}>
            <Text style={styles.planLeft}>계정 플랜</Text>
            <Text style={styles.planRight}>Pro</Text>
          </View>
          {subscription.nextBillingAt && (
            <Text style={styles.planSub}>
              다음 결제일 {formatKoreanDate(subscription.nextBillingAt)}
            </Text>
          )}
        </View>

        <View style={styles.actionCard}>
          <Pressable style={styles.actionRow} onPress={handleManage}>
            <Text style={styles.actionLabel}>구독 관리</Text>
            <View style={styles.actionTrailing}>
              <Text style={styles.actionTrailingText}>App Store</Text>
              <SymbolView
                name="chevron.right"
                size={13}
                tintColor={IOSColors.tertiaryLabel}
                weight="semibold"
              />
            </View>
          </Pressable>
          <Pressable
            style={[styles.actionRow, styles.actionRowDivider]}
            onPress={handleRestore}
          >
            <Text style={styles.actionLabel}>구매 복원</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FloatingHeader title="결제" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },

  // ── Upgrade ──
  upgradeBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 140,
    alignItems: 'center',
  },
  sparkleWrap: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  upgradeTitle: {
    ...IOSText.title1,
    fontWeight: '800',
    color: IOSColors.label,
    textAlign: 'center',
    fontFamily: IOSFont.rounded,
    lineHeight: 40,
  },
  upgradeSub: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
    lineHeight: 22,
    fontFamily: IOSFont.rounded,
  },

  featureCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: IOSColors.systemBackground,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  featureLabel: {
    flex: 1,
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  featureColumnHeader: {
    width: 60,
    textAlign: 'center',
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  featureRowDivider: {},
  featureRowLabel: {
    flex: 1,
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  featureCell: {
    width: 60,
    alignItems: 'center',
  },
  featureDash: {
    ...IOSText.body,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },
  featureDashMuted: {
    color: IOSColors.tertiaryLabel,
  },

  comingSoonCard: {
    width: '100%',
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: IOSColors.tertiarySystemBackground,
    gap: 8,
  },
  comingSoonHeader: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
    marginBottom: 4,
  },
  comingSoonItem: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  upgradeFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: IOSColors.secondarySystemBackground,
  },
  upgradeBtn: {
    height: 56,
    borderRadius: 999,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeBtnText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
  upgradeDisclaimer: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    textAlign: 'center',
    fontFamily: IOSFont.rounded,
  },

  // ── Manage ──
  manageBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 14,
  },
  planCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLeft: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  planRight: {
    ...IOSText.body,
    fontWeight: '600',
    color: PRO_ACCENT,
    fontFamily: IOSFont.rounded,
  },
  planSub: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 6,
    fontFamily: IOSFont.rounded,
  },
  actionCard: {
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  actionLabel: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  actionTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTrailingText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
});
