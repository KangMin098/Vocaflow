// packages/library-pipeline/src/textbook/publish-gate.ts
//
// **발행 게이트 — 조판기가 자기 판정을 실제로 집행하는 자리.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-12) ────────────────────────────
// `render-volume.mjs` 에는 `process.exit` 도 `throw` 도 **0건**이었다. 그 스크립트는 자동 검수를
// 돌리고(`scoreVolume`), 정답 쏠림을 검정하고(`assessAnswerBias`), 교정을 걸고
// (`summarizeProofread`), 해설 보유를 세어 **터미널에 찍은 뒤 — 그대로 HTML 을 쓰고 조판 기록을
// 남겼다.** 즉 판정은 있었지만 **집행이 없었다**:
//
//     자동 검수 7/9 통과
//       ❌ 유형 배합 — 목표 대비 0.71
//     해설 44/60 — 배치 12 · 규칙 32 · 없음 16
//     → D:\...\volume-reading-v5.html          ← 그래도 나온다
//
// 해설이 16문항 빈 책이 조판되고, 판권장에는 「자동 검수 7/9」이 찍힌다. 그 책은 **스스로 결함을
// 광고하는 상품**이다. 게이트는 현황판·발주 화면의 판정으로만 살아 있었는데, 그 둘은 사람이 보는
// 화면이라 **안 보고 돌리면 아무 일도 일어나지 않는다.**
//
// ── 왜 차단과 경고를 가르는가 ────────────────────────────────────────
// 전부 차단으로 만들면 이 게이트는 즉시 꺼진다(`--allow-defects` 가 상수처럼 붙는다). 그러면
// 게이트가 아니라 장식이 된다. 그래서 **근거의 종류**로 가른다:
//
//   · **차단** — 근거가 그 권 자체의 실측이다. 해설 누락과 자동 검수 미통과는 분자/분모가
//     그 권에서 나오고 오탐이 없다. 시중 20종 중 **85%가 정답해설을 낸다**(구성요소 실측
//     2026-09-06) — 해설 빠진 책은 시장에서 상품이 아니다.
//   · **경고** — 근거가 관행이거나 자에 오탐이 있다. 정답 쏠림의 문턱 `V ≥ 0.1` 은
//     **통계 관행이지 시중 실측이 아니고**(`item-health.ts` 가 그렇게 적어 뒀다 —
//     `market-spec.json` 에 시중 정답 위치 분포가 없다), 교정 규칙은 시중 지문 3%를
//     오탐한다(`standalone.ts` 실측 2026-09-04). **관행으로 발행을 막지 않는다.**
//
// ⚠️ **못 잰 것은 통과가 아니다.** 쏠림·교정은 잴 수 없는 권이 있다(단답형만 있는 권에는 고를
//   번호가 없고, 초등 낱말 유형에는 `payload.sentences` 가 없다 — 실측 2026-09-07 에 1·2단이
//   0/0 이었다). 그때는 「괜찮다」가 아니라 **「못 쟀다」**로 적는다. 0 으로 뭉개면 이 저장소가
//   이미 겪은 거짓 초록이 된다.
//
// 순수 함수다 — DB 도 파일도 안 읽는다. 그래서 회귀가 붙는다(`publish-gate.test.ts`).

/** 걸린 것의 무게. `block` 은 조판물을 내지 않는다. */
export type GateSeverity = 'block' | 'warn'

export interface GateFinding {
  severity: GateSeverity
  /** 무엇이 걸렸는가 — 터미널과 조판 기록이 이 문자열을 그대로 쓴다. */
  label: string
  /** 분자/분모를 그대로 적는다. 백분율만 적으면 반올림이 미달을 숨긴다. */
  detail: string
  /** 이것을 푸는 명령 한 줄. 사람이 판단할 일이면 null. */
  fix: string | null
}

export interface PublishGateInput {
  /** 조판 단(`--band`). 채우는 명령에 그대로 들어간다. */
  band: number
  /** 인쇄될 문항 수. */
  items: number
  /** 그중 해설이 붙은 수. */
  explained: number
  /** 자동 검수에서 떨어진 항목 이름 — `scoreVolume().auto` 의 `label`. */
  failedChecks: readonly string[]
  /** 정답 쏠림 판정(`assessAnswerBias().biased`). **못 쟀으면 null** — false 와 다르다. */
  answerBiased: boolean | null
  /** 그때의 효과 크기. 경고문에 근거로 적는다. */
  cramersV: number | null
  /** 교정: 잰 지문 수. 0 이나 null 이면 판정 불가다. */
  proofChecked: number | null
  /** 그중 결함이 있는 지문 수. */
  proofDefective: number | null
  /**
   * 그 권에 실릴 문항 중 **서로 다른 페르소나 3인 이상이 통과시킨** 수.
   *
   * ── 왜 이 축이 여기 있어야 하는가 (실측 2026-09-12) ──────────────────
   * 검증이 **거꾸로 걸려 있었다.** 학습자에게 가지 않는 기출 분석은 3인 검수를 6,702행
   * 받았는데(분석 2,234건 × 정확히 3인), 학습자가 실제로 받는 책의 문항 **1,860개**
   * (조판된 19권)는 **0건**이었다 — 담을 표(`csat_item_reviews`)가 없었기 때문이다.
   * 검수 화면의 「L2 3인 페르소나」 눈금은 기출 쪽 수를 세고 있어서, 교재 쪽 구멍을
   * 아무도 못 봤다.
   *
   * ⚠️ **표가 없으면 `null`** — 0 이 아니다. 0 으로 넘기면 게이트가 「전 권 차단」을 내고,
   *   그건 사실이 아니라 **아직 아무도 안 쟀다**는 뜻이다. 이 저장소가 이미 당한 함정이다.
   *   표가 생기고 나서야 이 축은 차단이 된다 — 근거가 생기는 순간 게이트가 조여진다.
   */
  reviewedItems: number | null
}

export interface PublishGateVerdict {
  findings: GateFinding[]
  blocked: GateFinding[]
  warned: GateFinding[]
  /** 못 쟀다고 적을 것 — 통과로 세지 않는다. */
  unmeasured: string[]
  /** 조판물을 낼 수 있는가. `blocked` 가 비었을 때만 참이다. */
  pass: boolean
}

/**
 * 한 권을 발행해도 되는지 판정한다.
 *
 * ⚠️ **판정만 한다.** 우회(`--allow-defects`)는 부르는 쪽의 일이다 — 여기서 우회를 받으면
 *   "통과했다" 는 거짓 값이 만들어지고, 그 값이 조판 기록에 남아 나중에 구별이 안 된다.
 */
export function judgePublish(input: PublishGateInput): PublishGateVerdict {
  const findings: GateFinding[] = []
  const unmeasured: string[] = []

  // ── 0문항 — 책이 아니다 ─────────────────────────────────────────────
  // 재료가 모자라 한 단원도 안 나온 것과 결함은 다르지만, **낼 수 없다는 결론은 같다.**
  if (input.items <= 0) {
    findings.push({
      severity: 'block',
      label: '문항 0',
      detail: '인쇄할 문항이 없다 — 조합기가 한 단원도 못 만들었다',
      fix: `pnpm dlx tsx scripts/textbook/store-new-types.mjs --band ${input.band} --commit`,
    })
  }

  // ── 해설 누락 — 시중 85%가 내는 것 ─────────────────────────────────
  const missing = Math.max(0, input.items - input.explained)
  if (input.items > 0 && missing > 0) {
    findings.push({
      severity: 'block',
      label: '해설 누락',
      detail: `${input.explained}/${input.items} — ${missing}문항에 해설이 없다 (시중 20종 중 85%가 정답해설을 낸다)`,
      // ⚠️ **규칙 해설이 먼저다.** 여기가 배치 드레인만 가리키던 동안(2026-09-12) 관리자는
      //   막다른 길로 갔다: `explain-drain-export` 는 **순서·삽입 전용**이라 어휘·어법 문항을
      //   「수능 형식 변환 실패」로 세고 **배치 몫 0** 을 찍는다 — 해설이 없는데 「쓸 것이 없다」고
      //   말한다. 그 51문항은 막힌 것이 아니라 `explain-fill`(규칙 작성기)의 몫이었다
      //   (실측: 해설 없는 어휘 6,087 · 어법 3,074 가 **전부** 작성기의 조건을 만족한다).
      //   순서를 명령에 담는다 — 규칙으로 안 되는 것만 배치로 간다.
      fix:
        `pnpm dlx tsx scripts/textbook/explain-fill.mjs --commit --type <유형> ` +
        `→ 남은 것만 explain-drain-export.mjs --band ${input.band} --volume 20 --size 12`,
    })
  }

  // ── 자동 검수 미통과 — 판권장이 그 수를 찍는다 ──────────────────────
  if (input.failedChecks.length) {
    findings.push({
      severity: 'block',
      label: '자동 검수 미통과',
      detail: `떨어진 항목 ${input.failedChecks.length}개 — ${input.failedChecks.join(' · ')}`,
      fix: `pnpm dlx tsx scripts/textbook/build-volume.mjs --band ${input.band} --units 20`,
    })
  }

  // ── L2 다수·다각 검수 — 근거가 생기면 차단이 된다 ──────────────────
  //
  // 기출 쪽과 같은 규약을 쓴다: **서로 다른 페르소나 3인 이상이 pass** 해야 한 문항이
  // 검수를 받은 것이다(`analysis-drain-import.mjs` 가 3인 미달을 적재에서 거부한다).
  // 한 사람이 세 번 본 것은 다각이 아니라 같은 눈이 세 번 본 것이다.
  if (input.reviewedItems == null) {
    unmeasured.push('3인 검수 — 교재 문항 검수 기록을 담을 표가 없다(csat_item_reviews)')
  } else if (input.items > 0 && input.reviewedItems < input.items) {
    findings.push({
      severity: 'block',
      label: '3인 검수 미완',
      detail:
        `${input.reviewedItems}/${input.items} — ` +
        `${input.items - input.reviewedItems}문항이 페르소나 3인 통과를 못 받았다`,
      fix: `pnpm dlx tsx scripts/textbook/item-review-drain-export.mjs --band ${input.band} --volume 20`,
    })
  }

  // ── 정답 쏠림 — 문턱이 관행이라 경고다 ──────────────────────────────
  if (input.answerBiased == null) {
    unmeasured.push('정답 쏠림 — 고를 번호가 있는 문항이 없어 검정 불가')
  } else if (input.answerBiased) {
    findings.push({
      severity: 'warn',
      label: '정답 번호 쏠림',
      detail:
        `Cramér V ${(input.cramersV ?? 0).toFixed(3)} ≥ 0.100 — ` +
        '문턱이 통계 관행이다(시중 정답 위치 분포는 코퍼스에 없다). 발행을 막지 않는다',
      fix: 'pnpm dlx tsx scripts/textbook/item-health-report.mjs',
    })
  }

  // ── 교정 — 규칙에 오탐 3%가 있어 경고다 ─────────────────────────────
  if (input.proofChecked == null || input.proofChecked === 0) {
    unmeasured.push('교정 — 잴 수 있는 지문이 없다(낱말 유형은 문장 배열이 없다)')
  } else if ((input.proofDefective ?? 0) > 0) {
    findings.push({
      severity: 'warn',
      label: '표기 결함',
      detail:
        `${input.proofDefective}/${input.proofChecked} 지문 — ` +
        '규칙 교정은 시중 지문 3%를 오탐한다. 고칠 것과 둘 것을 사람이 가른다',
      fix: 'pnpm dlx tsx scripts/textbook/proofread-report.mjs',
    })
  }

  const blocked = findings.filter((f) => f.severity === 'block')
  return {
    findings,
    blocked,
    warned: findings.filter((f) => f.severity === 'warn'),
    unmeasured,
    pass: blocked.length === 0,
  }
}

/**
 * 터미널에 찍을 판정문.
 *
 * **떨어진 항목은 이름과 푸는 명령을 함께 말한다** — "게이트 실패" 만 찍으면 관리자가
 * 무엇을 해야 하는지 몰라 `--allow-defects` 를 붙이게 된다. 그 순간 게이트는 죽는다.
 */
export function formatGate(v: PublishGateVerdict): string[] {
  const out: string[] = []
  for (const f of v.blocked) {
    out.push(`  ⛔ ${f.label} — ${f.detail}`)
    if (f.fix) out.push(`     ↳ ${f.fix}`)
  }
  for (const f of v.warned) out.push(`  ⚠️ ${f.label} — ${f.detail}`)
  for (const u of v.unmeasured) out.push(`  · 못 잼 · ${u}`)
  return out
}

/** 조판 기록(`colophon.review.gate`)에 남길 모양. 통과·우회를 구별해 적는다. */
export function gateRecord(
  v: PublishGateVerdict,
  forced: boolean,
): {
  pass: boolean
  forced: boolean
  blocked: { label: string; detail: string }[]
  warned: { label: string; detail: string }[]
  unmeasured: string[]
} {
  const strip = (f: GateFinding) => ({ label: f.label, detail: f.detail })
  return {
    pass: v.pass,
    // 우회로 나온 권을 통과와 같은 모양으로 적으면 나중에 구별이 안 된다.
    forced: forced && !v.pass,
    blocked: v.blocked.map(strip),
    warned: v.warned.map(strip),
    unmeasured: [...v.unmeasured],
  }
}
