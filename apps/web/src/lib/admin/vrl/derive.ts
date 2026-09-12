// apps/web/src/lib/admin/vrl/derive.ts
//
// 사전DB 모니터 화면의 수치를 **실측에서 파생**시키는 순수 함수들.
//
// 왜 따로 두는가 — 2026-09-05 실측:
//   이 화면들은 실시간 막대 **바로 위**에 `C2 56.2%` · `noun 66.1% dominant` 같은 문장을
//   상수로 박아 두고 있었다. 막대는 DB 를 따라 움직이는데 캡션은 안 움직여서, 분포가
//   바뀐 뒤에도 관리자는 옛 진단을 읽는다. 진행률 막대(`10,830 / 38,626 (28.0%)`)도
//   6개 라운드 상수의 합이었다 — 화면에서 유일한 실측은 우상단 Classified 하나뿐이었다.
//
// 여기 있는 함수는 전부 인자를 받아 문자열/숫자만 돌려준다 — 테스트가 DB 없이 돈다.

import type { VrlClassificationStatsData } from '@/lib/admin/dict/types'

/** 분포 한 덩이의 실측 요약 — 막대 위 캡션에 그대로 쓴다. */
export interface DistributionFacts {
  /** 가장 큰 값의 키 */
  topKey: string
  /** 그 키가 차지하는 비율 (0~100, 소수 1자리 반올림) */
  topSharePct: number
  /** 값이 있는 키 개수 */
  keyCount: number
  /** 분포에 실린 전체 행 수 */
  sum: number
}

/**
 * `Record<string, number>` 분포에서 실측 사실만 뽑는다.
 * 비었거나(null · 0 키) 합이 0 이면 null — 호출부가 "없음" 을 따로 말해야 한다.
 */
export function distributionFacts(
  data: Record<string, number> | null | undefined,
): DistributionFacts | null {
  const entries = Object.entries(data ?? {}).filter(
    ([, n]) => typeof n === 'number' && Number.isFinite(n) && n > 0,
  )
  if (entries.length === 0) return null

  const sum = entries.reduce((s, [, n]) => s + n, 0)
  if (sum <= 0) return null

  let top = entries[0]!
  for (const e of entries) {
    if (e[1] > top[1]) top = e
  }

  return {
    topKey: top[0],
    topSharePct: Math.round((top[1] / sum) * 1000) / 10,
    keyCount: entries.length,
    sum,
  }
}

/**
 * 막대 위 캡션 한 줄. `note` 는 수치가 아닌 성격 설명(있으면 뒤에 붙인다).
 * 수치는 전부 여기서 계산되므로 상수가 낄 자리가 없다.
 */
export function distributionCaption(
  facts: DistributionFacts | null,
  note?: string,
): string {
  if (!facts) {
    return note ? `분포 없음 — ${note}` : '분포 없음'
  }
  const head = `최다 ${facts.topKey} ${facts.topSharePct.toFixed(1)}% · ${facts.keyCount}개 값 · ${facts.sum.toLocaleString()}행`
  return note ? `${head} — ${note}` : head
}

/** 재분류 진행도 — 라운드 상수의 합이 아니라 v_level 실측에서 나온다. */
export interface ReclassificationProgress {
  classified: number
  unclassified: number
  total: number
  /** 0~100 */
  pct: number
}

export function reclassificationProgress(
  v: VrlClassificationStatsData,
): ReclassificationProgress {
  const classified = Math.max(0, v.totalClassified)
  const unclassified = Math.max(0, v.totalUnclassified)
  const total = classified + unclassified
  return {
    classified,
    unclassified,
    total,
    pct: total > 0 ? Math.round((classified / total) * 1000) / 10 : 0,
  }
}
