// apps/web/src/lib/vcb/market-panel-text.ts
//
// 지수 패널이 쓰는 **한 줄 문구**. 컴포넌트에서 떼어 둔 이유는 회귀가 이 판정을 직접 잴 수
// 있게 하기 위해서다 — 「천장에 닿은 축」과 「미달인 축」을 같은 말로 적으면 관리자가
// 고칠 수 없는 것을 고치려 든다.

/**
 * 천장 표기.
 *
 * 천장이 있는 축은 **1.20 이 목표가 아니다** — 지면 지수는 장치가 있거나 없거나라
 * `17 ÷ 시장평균` 이 상한이고, 거기에 1.20 을 요구하면 영원히 미달로 남는다.
 */
export function ceilingNote(ceiling: number | null): string {
  return ceiling == null ? '천장 없음' : `천장 ${ceiling.toFixed(3)} (이 축의 목표)`
}
