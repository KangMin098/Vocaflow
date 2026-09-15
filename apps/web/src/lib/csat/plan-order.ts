// apps/web/src/lib/csat/plan-order.ts
//
// **⑤ 주파 — 「내 약한 수법 순서로 한 회차를 짠다」의 순수 모델.**
//
// ── 무엇을 세는가 ─────────────────────────────────────────────────────
// 지도(`trap-atlas`)는 유형마다 오답이 **어떤 수법으로** 만들어졌는지 안다. 기록
// (`csat_trap_attempts`)은 내가 **어떤 수법에** 걸리는지 안다. 둘을 곱하면 「이 유형에서
// 내가 잃을 몫」이 나온다 — 조인 하나로 나오는 값이고, 새 테이블이 필요 없다.
//
//   risk(유형) = Σ_수법  (내 오답 중 그 수법의 몫) × (그 유형 오답 중 그 수법의 몫)
//
// 둘 다 0~1 이라 합도 0~1 이다. 내 약점이 그 유형의 구성과 많이 겹칠수록 커진다.
//
// ── ⚠️ 시험을 이 순서로 치르라는 말이 아니다 ──────────────────────────
// 시험은 18번부터 번호대로 나온다. 이 순서는 **공부할 순서**다. 화면이 그것을 분명히 적지
// 않으면 학습자가 시험장에서 문제를 건너뛰며 푸는 법으로 오해할 수 있고, 그건 이 화면이
// 줄 수 있는 가장 나쁜 조언이다. 시간 띠는 그래서 **언제나 번호 순서**로 남는다.
//
// ⚠️ **`server-only` 를 들이지 않는다** — 정렬 토글이 클라이언트에서 이 함수를 다시 부른다.

import { TRAPS } from './trap-atlas'

export type PlanOrder = 'exam' | 'weak'

export interface TypeRisk {
  /** 0~1. 내 약점이 이 유형의 오답 구성과 겹치는 정도 */
  score: number
  /** 그 겹침에 가장 크게 기여한 수법 — 화면이 「왜 위로 왔나」를 한 줄로 말할 수 있게 */
  driver: string | null
  /** 그 수법이 이 유형 오답에서 차지하는 몫 (0~1) */
  driverShare: number
}

/**
 * 유형마다 위험도를 센다.
 *
 * `missCounts` 는 함정별 **내가 놓친 횟수**(`myMissCounts`). 비어 있으면 전부 0 이고,
 * 그때 화면은 이 정렬을 아예 내놓지 않는다 — 0 으로 줄 세우면 순서가 아니라 잡음이다.
 */
export function riskByType(missCounts: Record<string, number>): Map<string, TypeRisk> {
  const myTotal = Object.values(missCounts).reduce((a, b) => a + b, 0)
  const out = new Map<string, TypeRisk>()
  if (myTotal <= 0) return out

  // 유형마다 「이름 붙은 오답」의 총수 — 그 유형 안에서의 몫을 낼 분모.
  const typeTotal = new Map<string, number>()
  for (const t of TRAPS) {
    for (const [typeId, n] of Object.entries(t.by_type)) {
      typeTotal.set(typeId, (typeTotal.get(typeId) ?? 0) + n)
    }
  }

  for (const [typeId, total] of typeTotal) {
    if (total <= 0) continue
    let score = 0
    let driver: string | null = null
    let driverShare = 0
    let best = 0
    for (const t of TRAPS) {
      const inType = t.by_type[typeId] ?? 0
      if (!inType) continue
      const mine = (missCounts[t.key] ?? 0) / myTotal
      if (mine <= 0) continue
      const share = inType / total
      const part = mine * share
      score += part
      if (part > best) {
        best = part
        driver = t.key
        driverShare = share
      }
    }
    out.set(typeId, { score, driver, driverShare })
  }
  return out
}

export interface OrderableRow {
  no: number
  type_id: string
}

/**
 * 줄을 세운다.
 *
 * `'exam'` 은 번호 순서(시험에서 만나는 순서). `'weak'` 는 위험도 내림차순이고,
 * **같으면 번호 순서로 되돌아간다** — 안 그러면 새로고침마다 순서가 흔들려 학습자가
 * 「내가 본 그 줄」을 다시 못 찾는다.
 */
export function orderRows<T extends OrderableRow>(rows: T[], mode: PlanOrder, risk: Map<string, TypeRisk>): T[] {
  const sorted = [...rows]
  if (mode === 'exam') return sorted.sort((a, b) => a.no - b.no)
  return sorted.sort(
    (a, b) => (risk.get(b.type_id)?.score ?? 0) - (risk.get(a.type_id)?.score ?? 0) || a.no - b.no,
  )
}
