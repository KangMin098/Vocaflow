// apps/web/src/lib/csat/content-review/impact.ts
//
// **F4 수정 영향 검사.** 강의 판본 전/후와 (있으면) sidecar 결속을 받아
// 「이 수정이 무엇을 무효로 만드는가」를 판정한다. 순수 함수 — 파일·DB 를 읽지 않는다.
//
// 다루는 sidecar 두 종류:
// - 강의 공개 경계(`lecture/disclosure-data.json`, feat/lecture-learner-control) — {version, cues, stopBefore}.
//   경계는 cue **위치(index)** 로 정해지므로 cue 수·순서가 바뀌거나 경계 앞 cue 가 바뀌면 다시 계산해야 한다.
// - 원문 이해 sidecar(`meaning-support-data.json`) — binding.analysisVersion 이 바뀌면 stale.

import type { Lecture, LectureCue } from '../lecture/types'

export type ImpactSeverity = 'BLOCK' | 'REVIEW' | 'INFO'

export interface ImpactFinding {
  code: string
  severity: ImpactSeverity
  cueId: string | null
  message: string
}

export interface DisclosureSidecar {
  version: number
  cues: number
  stopBefore: number
  digest?: string
  preStopRisk?: string
}

export interface MeaningSupportBinding {
  analysisVersion: number
  unitsHash: string
  basePublicHash: string
}

export interface ImpactInput {
  before: Lecture
  after: Lecture
  /** 지문 문장 수(splitSentences 기준). 모르면 null — 앵커 범위 검사를 REVIEW 로 남긴다 */
  passageSentenceCount: number | null
  disclosure?: DisclosureSidecar | null
  meaningSupport?: MeaningSupportBinding | null
  /** 수정 후 분석 판본(분석을 함께 고친 경우). 없으면 분석은 안 바뀐 것 */
  analysisVersionBefore: number
  analysisVersionAfter?: number
  /** 분석 본문이 바뀌었는가(버전 숫자와 별개) */
  analysisChanged?: boolean
}

export interface ImpactReport {
  itemId: string
  changedCues: string[]
  addedCues: string[]
  removedCues: string[]
  orderChanged: boolean
  lectureVersionBumpRequired: boolean
  disclosureInvalidated: boolean
  meaningSupportInvalidated: boolean
  analysisRevisionBumpRequired: boolean
  findings: ImpactFinding[]
  /** BLOCK 이 하나라도 있으면 false */
  ok: boolean
}

const cueText = (c: LectureCue) => c.segments.map((s) => `${s.lang}:${s.text}`).join('␞')
const targetKey = (c: LectureCue) => `${c.target.kind}:${c.target.id}`

/** 정답 번호를 직접 말하는 cue — 공개 경계의 R1 과 같은 축(「N 번이 정답」) */
const REVEAL_RE = /([일이삼사오]|[1-5①-⑤])\s*번[이은]?\s*정답/

export function revealsAnswer(c: LectureCue): boolean {
  return c.segments.some((s) => REVEAL_RE.test(s.text)) || c.target.id === 'answer'
}

export function analyzeImpact(input: ImpactInput): ImpactReport {
  const { before, after } = input
  const findings: ImpactFinding[] = []
  const add = (severity: ImpactSeverity, code: string, cueId: string | null, message: string) =>
    findings.push({ severity, code, cueId, message })

  if (before.item_id !== after.item_id) {
    add('BLOCK', 'ITEM_MISMATCH', null, `전 판본(${before.item_id})과 후 판본(${after.item_id})의 문항이 다르다`)
  }

  const bMap = new Map(before.cues.map((c) => [c.id, c]))
  const aMap = new Map(after.cues.map((c) => [c.id, c]))
  const removedCues = before.cues.filter((c) => !aMap.has(c.id)).map((c) => c.id)
  const addedCues = after.cues.filter((c) => !bMap.has(c.id)).map((c) => c.id)
  const changedCues: string[] = []

  for (const c of after.cues) {
    const prev = bMap.get(c.id)
    if (!prev) continue
    const textChanged = cueText(prev) !== cueText(c)
    const targetChanged = targetKey(prev) !== targetKey(c)
    const roleChanged = prev.role !== c.role
    if (textChanged || targetChanged || roleChanged) changedCues.push(c.id)
    if (targetChanged) add('REVIEW', 'TARGET_CHANGED', c.id, `하이라이트 대상이 ${targetKey(prev)} → ${targetKey(c)} 로 바뀐다`)
    if (roleChanged) add('REVIEW', 'ROLE_CHANGED', c.id, `역할이 ${prev.role} → ${c.role} 로 바뀐다`)
  }

  // 앵커 범위 — sentence:k 는 0부터, 지문 문장 수 미만이어야 한다
  for (const c of after.cues) {
    if (c.target.kind !== 'anchor') continue
    const m = /^sentence:(\d+)$/.exec(c.target.id)
    if (!m) {
      add('BLOCK', 'ANCHOR_FORMAT', c.id, `앵커 형식이 sentence:k 가 아니다(${c.target.id})`)
      continue
    }
    const k = Number(m[1])
    if (input.passageSentenceCount == null) {
      if (changedCues.includes(c.id) || addedCues.includes(c.id)) {
        add('REVIEW', 'ANCHOR_UNVERIFIED', c.id, `지문 문장 수를 몰라 sentence:${k} 범위를 확인하지 못했다`)
      }
    } else if (k >= input.passageSentenceCount) {
      add('BLOCK', 'ANCHOR_OUT_OF_RANGE', c.id, `sentence:${k} 는 지문 문장 ${input.passageSentenceCount}개 밖이다`)
    }
  }

  const beforeOrder = before.cues.map((c) => c.id).filter((id) => aMap.has(id))
  const afterOrder = after.cues.map((c) => c.id).filter((id) => bMap.has(id))
  const orderChanged = beforeOrder.join(',') !== afterOrder.join(',')

  const anyChange = changedCues.length + addedCues.length + removedCues.length > 0 || orderChanged
  const lectureVersionBumpRequired = anyChange
  if (anyChange && after.version <= before.version) {
    add('BLOCK', 'VERSION_NOT_BUMPED', null, `cue 가 바뀌었는데 강의 version 이 ${before.version} → ${after.version} 이다(올려야 한다)`)
  }

  // 공개 경계
  let disclosureInvalidated = false
  const d = input.disclosure
  if (d) {
    if (d.version !== before.version) {
      add('REVIEW', 'DISCLOSURE_ALREADY_STALE', null, `공개 경계는 강의 v${d.version} 기준인데 전 판본이 v${before.version} 이다`)
    }
    if (d.cues !== after.cues.length || addedCues.length || removedCues.length || orderChanged) {
      disclosureInvalidated = true
      add('BLOCK', 'DISCLOSURE_INDEX_SHIFT', null, `cue 수·순서가 바뀌어 경계 위치(stopBefore=${d.stopBefore})를 다시 계산해야 한다`)
    }
    after.cues.forEach((c, i) => {
      if (!changedCues.includes(c.id) && !addedCues.includes(c.id)) return
      if (i < d.stopBefore) {
        disclosureInvalidated = true
        const sev: ImpactSeverity = revealsAnswer(c) ? 'BLOCK' : 'REVIEW'
        add(sev, revealsAnswer(c) ? 'REVEAL_BEFORE_BOUNDARY' : 'CHANGED_BEFORE_BOUNDARY', c.id,
          revealsAnswer(c)
            ? `경계 앞(${i + 1}번째) cue 가 정답을 말한다 — 「정답 직전까지」 경로에 정답이 노출된다`
            : `경계 앞(${i + 1}번째) cue 가 바뀌어 공개 수준을 다시 판정해야 한다`)
      }
    })
    if (disclosureInvalidated && d.version === after.version) {
      add('INFO', 'DISCLOSURE_REBUILD', null, '공개 경계 sidecar 를 새 판본으로 다시 만들어야 한다')
    }
  } else if (anyChange) {
    add('INFO', 'NO_DISCLOSURE_SIDECAR', null, '공개 경계 sidecar 가 주어지지 않아 경계 영향은 검사하지 않았다')
  }

  // 분석 판본 · 원문 이해 sidecar
  const versionAfter = input.analysisVersionAfter ?? input.analysisVersionBefore
  const analysisRevisionBumpRequired = !!input.analysisChanged
  if (input.analysisChanged && versionAfter <= input.analysisVersionBefore) {
    add('BLOCK', 'ANALYSIS_REVISION_NOT_BUMPED', null, `분석 본문이 바뀌었는데 revision 이 v${input.analysisVersionBefore} 그대로다 — 새 revision 으로만 고친다`)
  }
  let meaningSupportInvalidated = false
  const ms = input.meaningSupport
  if (ms) {
    if (ms.analysisVersion !== versionAfter || input.analysisChanged) {
      meaningSupportInvalidated = true
      add('BLOCK', 'MEANING_SUPPORT_STALE', null,
        `원문 이해 sidecar 가 분석 v${ms.analysisVersion} 에 묶여 있다 — 분석 v${versionAfter} 로 다시 결속·검수해야 공개된다`)
    }
  }

  return {
    itemId: after.item_id,
    changedCues,
    addedCues,
    removedCues,
    orderChanged,
    lectureVersionBumpRequired,
    disclosureInvalidated,
    meaningSupportInvalidated,
    analysisRevisionBumpRequired,
    findings,
    ok: !findings.some((f) => f.severity === 'BLOCK'),
  }
}
