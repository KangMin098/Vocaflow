// apps/web/src/lib/csat/content-review/prepublish.ts
//
// **F6 발행 전 검증기.** 공식 정답 **집합** · 분석의 선지 판정 · 강의 cue · (적용된) 수정 후보가
// 서로 어긋나는지 본다. 그리고 발행 게이트(publishAllowed)는 사람 내용 승인 + BLOCK 0 을 함께 요구한다.
//
// - 정답은 집합이다. 2015#25 = {4,5}. 어떤 검사도 「정답 하나」로 줄이지 않는다.
// - officialAnswers=null 은 「모름」이다 — 빈 배열(정답 없음)과 다르고, 그 자체로 BLOCK.
// - 출제 의도 단정은 공식 근거가 없으면 HYPOTHESIS(사실 아님) 경고.

import type { LectureCue } from '../lecture/types'
import { readClaims } from './answer-claims'
import { currentState, verifyLedger } from './state'
import type { LedgerEntry, ProposedChange, ReviewCandidate } from './types'

export type PrepublishSeverity = 'BLOCK' | 'HYPOTHESIS' | 'REVIEW'

export interface PrepublishFinding {
  code: string
  severity: PrepublishSeverity
  where: string
  message: string
}

export interface ChoiceVerdict {
  choice: number
  verdict: 'answer' | 'distractor' | string
}

export interface PrepublishInput {
  itemId: string
  officialAnswers: number[] | null
  /** 출제 의도에 공식 근거(평가원 해설·이의심사 발표)가 있는가 */
  intentOfficiallySourced?: boolean
  choiceVerdicts: ChoiceVerdict[]
  /** 선지 본문(①~⑤ 순) — 「정답은 삼 번, <선지 본문>」 동격을 대조한다. 없으면 동격 문장은 사람 확인 */
  choices?: readonly string[]
  cues: LectureCue[]
  /** 적용할 수정 후보 — target 'cue:<id>' 의 proposed 가 cue 본문(ko-KR 한 덩이)을 대신한다 */
  changes?: ProposedChange[]
}

export interface PrepublishReport {
  itemId: string
  findings: PrepublishFinding[]
  blocked: boolean
}

// 정답·오답 진술은 선지 **집합**으로 읽는다 — answer-claims.ts (T-0158 Codex 4차: 나열·배타·포함)
const FOUR_OTHERS_RE = /답이\s*아닌\s*(네|4)\s*(개|선지)|나머지\s*(네|4)\s*(개|선지)/
const INTENT_RE = /출제자[는가]?[^.。]*?(의도|노렸|노린|노리)|출제\s*의도는/

/** 수정 후보를 적용한 cue 들 — 원본 배열은 바꾸지 않는다 */
export function applyChanges(cues: readonly LectureCue[], changes: readonly ProposedChange[] = []): LectureCue[] {
  return cues.map((c) => {
    const ch = changes.find((x) => x.target === `cue:${c.id}`)
    if (!ch || ch.proposed == null) return c
    return { ...c, segments: [{ lang: 'ko-KR', text: ch.proposed }] }
  })
}

export function validatePrepublish(input: PrepublishInput): PrepublishReport {
  const findings: PrepublishFinding[] = []
  const push = (severity: PrepublishSeverity, code: string, where: string, message: string) =>
    findings.push({ severity, code, where, message })
  const answers = input.officialAnswers
  const multi = !!answers && answers.length > 1
  const setLabel = answers ? `{${answers.join(',')}}` : '모름'

  if (answers == null) {
    push('BLOCK', 'OFFICIAL_ANSWER_UNKNOWN', 'item', '공식 정답 근거가 없다 — 「모름」은 「정답 없음」이 아니다. 정답표 확인 전 발행 불가')
  } else if (answers.length === 0) {
    push('BLOCK', 'OFFICIAL_ANSWER_EMPTY', 'item', '공식 정답 집합이 비어 있다')
  }

  if (answers) {
    // (1) 분석이 공식 정답을 오답으로 판정
    for (const v of input.choiceVerdicts) {
      const isOfficial = answers.includes(v.choice)
      if (isOfficial && v.verdict === 'distractor') {
        push('BLOCK', 'ANALYSIS_REJECTS_OFFICIAL', `analysis:choice:${v.choice}`,
          `분석이 공식 정답 ${v.choice}번을 오답(distractor)으로 설명한다 — 공식 정답 ${setLabel}`)
      }
      if (!isOfficial && v.verdict === 'answer') {
        push('BLOCK', 'ANALYSIS_ANSWER_NOT_OFFICIAL', `analysis:choice:${v.choice}`,
          `분석이 ${v.choice}번을 정답으로 두지만 공식 정답 집합 ${setLabel} 에 없다`)
      }
    }
    const verdictAnswers = input.choiceVerdicts.filter((v) => v.verdict === 'answer').map((v) => v.choice)
    if (multi && verdictAnswers.length === 1) {
      push('BLOCK', 'ANALYSIS_SINGLE_ANSWER', 'analysis', `복수정답 ${setLabel} 인데 분석은 정답을 하나만 둔다`)
    }
  }

  for (const c of applyChanges(input.cues, input.changes)) {
    const where = `cue:${c.id}`
    const text = c.segments.map((s) => s.text).join(' ')
    if (answers) {
      // 주어 없는 술어 절(「맞는 진술이고, 답이 아닙니다」)의 주어는 소거 cue 의 target — 의미가 정해지면 공식 정답과 자동 대조
      const rejectOf = c.target.kind === 'analysis' ? /^reject:([1-5])$/.exec(c.target.id) : null
      const claims = readClaims(text, { choices: input.choices, rejectTarget: rejectOf ? Number(rejectOf[1]) : undefined })
      // (2) 정답 진술 — 집합 단위로 공식 정답과 대조
      // cue 안의 정답 진술을 **합쳐서** 본다 — 「④가 정답이고 ⑤도 정답」은 {4,5} 를 말한 것이다(5차 P2)
      const said = [...new Set(claims.answers.flatMap((a) => a.choices))]
      const wrong = said.filter((n) => !answers.includes(n))
      if (wrong.length) push('BLOCK', 'CUE_WRONG_ANSWER', where, `cue 가 ${wrong.join(',')}번을 정답이라 하지만 공식 정답은 ${setLabel}`)
      if (multi && said.length) {
        // 배타 진술(「오직 ④」)은 그 진술 하나가 집합 전체여야 한다
        for (const a of claims.answers.filter((x) => x.exclusive)) {
          if (!answers.every((n) => a.choices.includes(n))) {
            push('BLOCK', 'CUE_PARTIAL_ANSWER', where, `cue 가 정답을 ${a.choices.join(',')}번만이라고 한정한다 — 공식 복수정답 ${setLabel}`)
          }
        }
        // 「⑤도 정답」은 다른 정답을 전제한다 — 그런 표현이 없는데 합집합이 모자라면 축소다
        const inclusive = claims.answers.some((a) => a.inclusive)
        const missing = answers.filter((n) => !said.includes(n))
        if (!inclusive && missing.length && !claims.answers.some((a) => a.exclusive)) {
          push('BLOCK', 'CUE_PARTIAL_ANSWER', where, `cue 가 정답을 ${said.join(',')}번만 말한다 — 공식 복수정답 ${setLabel}`)
        }
      }
      // 해석하지 못한 정답 진술은 통과시키지 않는다(fail-closed)
      for (const s of claims.unparsed) {
        // 기계가 확인하지 못한 문장 — 틀렸다는 판정이 아니다. 영어 선지의 한국어 풀이 동격(「정답은 삼 번, 메시지입니다」)도 여기로 온다
        push('BLOCK', 'CUE_ANSWER_UNPARSED', where, `정답 진술을 기계로 다 확인하지 못했다(오류 판정 아님) — 사람이 문장 전체를 확인한다: 「${s.slice(0, 60)}」`)
      }
      // (3) 공식 정답을 소거
      const rej = /^reject:(\d)$/.exec(c.target.id)
      const eliminated = new Set<number>(claims.rejected)
      if (c.target.kind === 'analysis' && rej) eliminated.add(Number(rej[1]))
      for (const n of eliminated) {
        if (answers.includes(n)) {
          push('BLOCK', 'CUE_ELIMINATES_OFFICIAL', where, `cue 가 공식 정답 ${n}번을 소거(오답 처리)한다 — 공식 정답 ${setLabel}`)
        }
      }
      // (4) 단일 정답 전제 표현
      if (multi && FOUR_OTHERS_RE.test(text)) {
        push('BLOCK', 'CUE_ASSUMES_SINGLE_ANSWER', where, `「답이 아닌 네 선지」류 표현은 단일 정답 전제다 — 공식 복수정답 ${setLabel}`)
      }
    }
    // (5) 출제 의도 단정
    if (INTENT_RE.test(text) && !input.intentOfficiallySourced) {
      push('HYPOTHESIS', 'INTENT_UNSOURCED', where, '출제 의도를 단정한다 — 공식 근거가 없으면 「근거 기반 가설」로 표시해야 한다')
    }
  }

  return { itemId: input.itemId, findings, blocked: findings.some((f) => f.severity === 'BLOCK') }
}

export interface PublishGate {
  allowed: boolean
  reasons: string[]
}

/** (7) 발행 게이트 — 모든 트랙이 사람 내용 승인(또는 발행 대기) + 발행 전 검증 BLOCK 0 */
export function publishAllowed(
  ledger: readonly LedgerEntry[],
  candidate: ReviewCandidate,
  report: PrepublishReport | null,
): PublishGate {
  const reasons: string[] = []
  // 원장 자체가 계약을 어기면(전이 함수를 거치지 않은 승인 줄 등) 상태를 믿지 않는다
  const integrity = verifyLedger(ledger)
  if (!integrity.ok) reasons.push(`원장 무결성 오류: ${integrity.problems.slice(0, 3).join(' · ')}`)
  for (const t of candidate.tracks) {
    const s = currentState(ledger, candidate.id, t)
    if (s !== 'content_approved' && s !== 'publish_pending') {
      reasons.push(`트랙 ${t} 가 내용 승인 상태가 아니다(${s})`)
      continue
    }
    const last = [...ledger].reverse().find((e) => e.candidateId === candidate.id && e.track === t)
    if (!last || last.by.kind !== 'human') reasons.push(`트랙 ${t} 의 승인이 사람 승인이 아니다`)
  }
  if (!report) reasons.push('발행 전 검증을 실행하지 않았다')
  else if (report.itemId !== candidate.itemId) reasons.push('발행 전 검증이 다른 문항의 결과다')
  else if (report.blocked) reasons.push(`발행 전 검증 BLOCK ${report.findings.filter((f) => f.severity === 'BLOCK').length}건`)
  return { allowed: reasons.length === 0, reasons }
}
