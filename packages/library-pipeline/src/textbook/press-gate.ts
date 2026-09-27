// packages/library-pipeline/src/textbook/press-gate.ts
//
// **조판 게이트의 순수 판정** — 「이 권을 찍어도 되는가 · 안 되면 왜인가」.
//
// ── 왜 순수 함수인가 ────────────────────────────────────────────────
// 이 판정은 **세 곳**이 같은 답을 내야 한다:
//   · `press-drain-export.mjs` — 찍을 후보를 고른다
//   · ⑧ 조판 화면            — 「나갈 수 없는 권」을 센다
//   · 발행 승인              — 차단 사유 0 인 권만 승인 대상이다
// 셋이 각자 세면 언젠가 다른 수를 말하고, 그때부터 셋 다 못 믿는다. 이 저장소는 그 사고를
// 이미 겪었다 — 「3인 검수」가 기출과 교재 두 가지를 뜻하는 동안 ⑦ 눈금이 **다른 것을 세면서
// 초록**이었다(`20260912210000` 머리말).
//
// ⚠️ **「못 잼」을 차단 사유로 세지 않는다.** 기록이 없는 것은 막힌 것이 아니라 **안 본 것**이고,
//   할 일이 정반대다(전자는 검수를 돌리고, 후자는 문항을 고친다). 그래서 `blockers` 와
//   `unmeasured` 를 따로 돌려준다.

/** 한 권의 조판 게이트 입력. 어디서 읽었는지는 호출자 몫이다. */
export interface PressGateInput {
  series: string
  band: number
  /** 지면에 실릴 문항 수. */
  items: number
  /** 그중 해설이 안 붙은 수. */
  missingExplanations: number
  /**
   * 3인 검수에서 **셋이 보기는 했는데 통과가 아닌** 문항 수.
   * `null` 은 「안 쟀다」 — 0 과 다르다.
   */
  personaBlocked: number | null
  /** 자동 검사 통과/전체. 전체가 0 이면 검사가 안 돈 것이다. */
  autoPassed: number
  autoTotal: number
  /** 브랜드 지문이 지금 값과 같은가. */
  brandCurrent: boolean
  /** 그 시리즈의 목차 스냅샷이 구워져 있는가 — 없으면 학습자 상세면에 목차 절이 안 나간다. */
  hasContents: boolean
  /** 사람이 내린 발행 판정. `null` 은 「아무도 판정한 적 없다」. */
  publishStatus: 'rendered' | 'review' | 'approved' | 'published' | 'withdrawn' | null
}

export interface PressGateVerdict {
  /** 학습자에게 나갈 수 없게 **막는** 이유. 비면 막는 것이 없다. */
  blockers: string[]
  /** **못 잰** 축. 막는 것이 아니라 아직 안 본 것이다. */
  unmeasured: string[]
  /** 승인 대상인가 — 막는 것이 없고 못 잰 것도 없어야 한다. */
  approvable: boolean
}

/**
 * 한 권을 판정한다.
 *
 * 규칙은 다섯뿐이다:
 *   ① 해설이 안 붙은 문항이 있으면 막는다 — 해설 빠진 책이 나간다.
 *   ② 3인 검수에서 막힌 문항이 있으면 막는다 — 반려된 원고가 그대로 실린다.
 *   ③ 자동 검사가 하나라도 떨어지면 막는다.
 *   ④ 옛 규격이면 막는다 — 손에 쥔 책이 화면과 달라진다.
 *   ⑤ 목차 스냅샷이 없으면 막는다 — 상세면이 절을 통째로 잃는다.
 * `withdrawn` 은 사람이 내린 권이라 따로 막는다.
 */
export function judgePressGate(v: PressGateInput): PressGateVerdict {
  const blockers: string[] = []
  const unmeasured: string[] = []

  if (v.missingExplanations > 0) blockers.push(`해설 없는 문항 ${v.missingExplanations}`)

  // ⚠️ null 과 0 을 가른다. null 은 「안 쟀다」이고, 그것을 0 으로 읽으면 검수를 한 번도
  //   안 돌린 권이 **깨끗한 권**으로 승인 대상이 된다.
  if (v.personaBlocked == null) unmeasured.push('3인 검수 기록 없음')
  else if (v.personaBlocked > 0) blockers.push(`3인 검수 막힘 ${v.personaBlocked}`)

  if (v.autoTotal <= 0) unmeasured.push('자동 검사 안 돎')
  else if (v.autoPassed < v.autoTotal) {
    blockers.push(`자동 검사 ${v.autoPassed}/${v.autoTotal}`)
  }

  if (!v.brandCurrent) blockers.push('옛 규격으로 찍힘')
  if (!v.hasContents) blockers.push('목차 스냅샷 없음')
  if (v.publishStatus === 'withdrawn') blockers.push('사람이 내린 권')

  return {
    blockers,
    unmeasured,
    // 못 잰 것이 있으면 승인 대상이 아니다 — **재지 않은 것을 통과로 세는 것이
    // 이 저장소의 지배적 결함**이다(`factory-model.ts` 머리말).
    approvable: blockers.length === 0 && unmeasured.length === 0,
  }
}

/** 여러 권을 접는다 — 화면과 드레인이 같은 수를 낸다. */
export function summarizePressGate(rows: readonly PressGateInput[]): {
  total: number
  approvable: number
  blocked: number
  unmeasured: number
} {
  let approvable = 0
  let blocked = 0
  let unmeasured = 0
  for (const r of rows) {
    const v = judgePressGate(r)
    if (v.blockers.length) blocked++
    else if (v.unmeasured.length) unmeasured++
    else approvable++
  }
  return { total: rows.length, approvable, blocked, unmeasured }
}
