import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Haptic, IOSColors, IOSFont, IOSText, Opacity } from "@/theme";
import { trackEvent } from "@/lib/analytics";

type Props = {
  /** 이 검색의 유저 쿼리 텍스트 — search_failed 의 join 컨텍스트. */
  query: string;
  /** 현재 채팅 세션 ID — 스레드 단위 실패 집계 키. */
  sessionId: string | null;
};

/** 검색 결과 하단의 유저 자가신고 버튼. 탭 시 search_failed 를 1회 발사해
 *  "결과가 안 맞았다"는 실패 신호를 직접 수집한다(검색 품질 입력). 발사는
 *  턴당 1회 — 재탭 방지로 신고 후 문구를 바꾸고 비활성화한다. */
export function SearchFailedTrigger({ query, sessionId }: Props) {
  const [reported, setReported] = useState(false);

  const onPress = () => {
    if (reported) return;
    Haptic.light();
    trackEvent("search_failed", { query, session_id: sessionId });
    setReported(true);
  };

  return (
    <Pressable
      hitSlop={8}
      disabled={reported}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      onPress={onPress}
    >
      <Text style={styles.label}>
        {reported ? "알려줘서 고마워" : "원하는 게 없어요"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: "center",
  },
  btnPressed: {
    opacity: Opacity.muted,
  },
  label: {
    ...IOSText.footnote,
    fontFamily: IOSFont.sans,
    color: IOSColors.tertiaryLabel,
    textDecorationLine: "underline",
  },
});
