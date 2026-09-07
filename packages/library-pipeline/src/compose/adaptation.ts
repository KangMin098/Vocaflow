// packages/library-pipeline/src/compose/adaptation.ts
//
// ACP §20 — 레벨 적응(adaptation).
//
// ── 재저작과 무엇이 다른가 ───────────────────────────────────────────
//
//   재저작(composition) — 상업 뉴스에서 **사실만** 가져와 우리가 쓴다. 라이선스가 없으므로
//     표현을 빌릴 수 없고, 그래서 출처 독립성·표현 독립성·구조 독립성·발행 지연·인용 정책이
//     전부 필요하다(I12~I17).
//   적응(adaptation)   — 이미 쓸 권리가 있는 글(NASA·VOA·USGS…)을 **같은 내용의 쉬운 판**으로
//     다시 쓴다. 라이선스가 사용을 허락했으므로 위 검사 대부분이 성립하지 않는다.
//     원문을 따라 써도 되고, 인용해도 되고, 언제 내도 된다.
//
// ── 그럼 무엇이 남는가 ───────────────────────────────────────────────
// **원본과 쉬운 판이 서가에 함께 선다**는 것 하나가 실질 위험이다. 학습자가 같은 내용을
// 두 번 만나면 서가가 부풀어 보일 뿐 배울 것은 늘지 않는다. 그래서 I17 만 critical 로 남긴다.
//
// 나머지는 게이트가 아니라 **품질 문제**다: 쉬워졌는가(어휘 밴드) · 원문을 그대로 베끼지
// 않았는가(표현). 후자는 라이선스상 허용되지만 그대로 베낀 것은 '쉬운 판' 이 아니므로
// 경고로 남긴다 — 막지는 않는다.

import { stripAttribution } from './attribution'
import { buildFingerprint, findVerbatimRuns } from './fingerprint'
import { COMPOSE_THRESHOLDS, type GateResult, type SourceRecord } from './gates'
import { GRADE_BANDS, evaluateBand, profileBand, type GradeBandKey, type SpineWord } from './spine'

export interface AdaptationInput {
  /** 쉬운 판 본문 */
  text: string
  /** 원본 글의 본문 (라이선스 보유 — 대조에만 쓰고 저장하지 않는다) */
  sourceText: string
  /** 원본을 제외한 서가 — 같은 원본에서 이미 낸 다른 레벨 판 등 */
  shelf: ReadonlyArray<SourceRecord>
  /** 이 판이 서는 학령 */
  band: GradeBandKey
  /** 쉬운 판의 어휘와 V-Level */
  words: ReadonlyArray<SpineWord>
}

/**
 * 적응 게이트.
 *
 * 재저작 게이트 6종을 그대로 돌리지 않는다 — 성립하지 않는 검사를 통과시키는 것은
 * 검사한 척하는 것이고, 실패시키는 것은 정상 산출물을 막는 것이다. 둘 다 나쁘다.
 */
export function runAdaptationGates(input: AdaptationInput): GateResult[] {
  const draft = stripAttribution(input.text)
  const out: GateResult[] = []

  // I17 서가 중복 — 유일한 critical. 같은 내용이 서가에 두 번 오르는 것을 막는다.
  const dup: string[] = []
  for (const s of input.shelf) {
    for (const run of findVerbatimRuns(draft, s.fingerprint)) {
      if (run.wordCount >= COMPOSE_THRESHOLDS.verbatimHardRunWords) {
        dup.push(`${s.publisher} · "${run.text.slice(0, 60)}"`)
      }
    }
  }
  out.push(
    dup.length === 0
      ? {
          invariant: 'I17 서가 중복',
          severity: 'critical',
          verdict: 'PASS',
          detail: `서가의 다른 판 ${input.shelf.length}편과 겹치는 구간 없음.`,
        }
      : {
          invariant: 'I17 서가 중복',
          severity: 'critical',
          verdict: 'FAIL',
          detail:
            `이미 서가에 있는 판과 겹친다 — ${dup.slice(0, 2).join(' / ')}. ` +
            `같은 원본의 같은 레벨 판이 이미 있는지 확인하고, 있으면 그것을 쓴다.`,
        },
  )

  // A1 원문 재사용도 — 라이선스상 허용되지만, 그대로 베낀 것은 '쉬운 판' 이 아니다.
  const srcFp = buildFingerprint(stripAttribution(input.sourceText))
  const runs = findVerbatimRuns(draft, srcFp).filter(
    (r) => r.wordCount >= COMPOSE_THRESHOLDS.verbatimHardRunWords,
  )
  out.push(
    runs.length === 0
      ? {
          invariant: 'A1 원문 재작성',
          severity: 'warning',
          verdict: 'PASS',
          detail: '원문과 길게 겹치는 구간 없음 — 실제로 다시 썼다.',
        }
      : {
          invariant: 'A1 원문 재작성',
          severity: 'warning',
          verdict: 'WARN',
          detail:
            `원문과 ${runs.length}구간이 그대로 겹친다(최장 ${Math.max(...runs.map((r) => r.wordCount))}어절): ` +
            `"${runs[0]!.text.slice(0, 60)}". 라이선스상 문제는 없지만 그대로 옮긴 문장이 남아 있으면 ` +
            `쉬운 판이 아니다 — 그 구간을 다시 쓴다.`,
        },
  )

  // A2 목표 레벨 — 쉬워졌는가. 이것이 적응의 존재 이유다.
  const profile = profileBand(input.words, input.band)
  const band = evaluateBand(profile)
  out.push({
    invariant: 'A2 목표 레벨',
    severity: 'warning',
    verdict: band.verdict === 'PASS' ? 'PASS' : 'WARN',
    detail: `${GRADE_BANDS[input.band].label} — ${band.detail}`,
  })

  return out
}

/** 적응 글이 발행 가능한가 — critical 실패가 없으면 된다(경고는 사람이 본다). */
export function isAdaptationPublishable(results: ReadonlyArray<GateResult>): boolean {
  return !results.some((r) => r.severity === 'critical' && r.verdict === 'FAIL')
}
