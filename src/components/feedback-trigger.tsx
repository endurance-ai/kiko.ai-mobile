import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { Haptic, IOSColors } from "@/theme";
import { useFeedback } from "@/state/feedback";

type Props = {
  /** Stable identifier for this agent turn (e.g. "search:42" / "fallback:42"). */
  turnKey: string;
  /** Optional server search_id — when present, propagated to POST /v1/feedback. */
  searchId?: string;
};

export function FeedbackTrigger({ turnKey, searchId }: Props) {
  const { getSubmitted } = useFeedback();
  const submitted = getSubmitted(turnKey);

  const open = (rating: "positive" | "negative") => {
    Haptic.light();
    const searchPart = searchId
      ? `&search=${encodeURIComponent(searchId)}`
      : "";
    router.push(
      `/feedback?turn=${encodeURIComponent(turnKey)}&rating=${rating}${searchPart}`,
    );
  };

  return (
    <View style={styles.row}>
      <Pressable
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => open("positive")}
      >
        <SymbolView
          name={
            submitted === "positive" ? "hand.thumbsup.fill" : "hand.thumbsup"
          }
          size={16}
          tintColor={
            submitted === "positive"
              ? IOSColors.label
              : IOSColors.secondaryLabel
          }
          weight="medium"
        />
      </Pressable>
      <Pressable
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => open("negative")}
      >
        <SymbolView
          name={
            submitted === "negative"
              ? "hand.thumbsdown.fill"
              : "hand.thumbsdown"
          }
          size={16}
          tintColor={
            submitted === "negative"
              ? IOSColors.label
              : IOSColors.secondaryLabel
          }
          weight="medium"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // 컨테이너 좌측 마진은 부모(home.tsx feedbackTriggerRow)에서 잡음.
  // 여기서 다시 paddingHorizontal 을 주면 상위 CTA(더보기)와 좌측 정렬이 어긋남.
  row: {
    flexDirection: "row",
    gap: 12,
  },
  // 아이콘 실제 크기에 맞춰 폭 지정. tap 영역은 hitSlop 으로 별도 확보.
  btn: {
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPressed: {
    opacity: 0.5,
  },
});
