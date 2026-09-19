// apps/web/src/lib/diagnostic/interim-level.ts
//
// **진단 도중의 중간 추정** — `/diagnostic` 「답할수록 칠해지는 지문」(2026-09-19 · docs/design/compare/diagnostic.md).
//
// 서버 RPC `analyze_diagnostic_result` 와 **같은 규칙**이다(pg_get_functiondef 로 읽음, 2026-09-19):
//   레벨(`target_v_level`)마다 정답률을 내고, 정답률 ≥ 0.70 인 **가장 높은 레벨**. 하나도 없으면 1.
// 그래서 화면이 문항 중에 보여 주는 수준은 "지금까지의 답을 지금 제출하면 서버가 낼 값" 이다 —
// 지어낸 추정이 아니다. 결과 화면의 레벨은 여전히 RPC 가 돌려준 값만 쓴다.
//
// ⚠️ 서버 규칙이 바뀌면 여기도 바뀌어야 한다. 규칙 문자열을 테스트가 잠근다(`__tests__/interim-level.test.ts`).

export const PASS_ACCURACY = 0.7

export interface InterimQuestion {
  id: string
  target_v_level: number | null
}

export interface InterimResponse {
  question_id: string
  knew: boolean
}

/** 답이 하나도 없으면 `null` — 아직 아무것도 모른다(1 로 칠하면 "거의 다 모른다" 로 읽힌다). */
export function interimLevel(
  questions: readonly InterimQuestion[],
  responses: readonly InterimResponse[],
): number | null {
  if (responses.length === 0) return null
  const levelOf = new Map(questions.map((q) => [q.id, q.target_v_level]))
  const tally = new Map<number, { correct: number; total: number }>()
  for (const r of responses) {
    const vl = levelOf.get(r.question_id)
    if (typeof vl !== 'number') continue
    const t = tally.get(vl) ?? { correct: 0, total: 0 }
    t.total += 1
    if (r.knew) t.correct += 1
    tally.set(vl, t)
  }
  let best: number | null = null
  for (const [vl, t] of tally) {
    // 서버는 소수 셋째 자리에서 반올림한 뒤 비교한다
    const acc = Math.round((t.correct / t.total) * 1000) / 1000
    if (acc >= PASS_ACCURACY && (best === null || vl > best)) best = vl
  }
  return best ?? 1
}
