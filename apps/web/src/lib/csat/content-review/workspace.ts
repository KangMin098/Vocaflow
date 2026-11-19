// apps/web/src/lib/csat/content-review/workspace.ts
//
// **F2 검수 작업 공간 — 화면 모델.** 스냅샷 한 벌을 「대기열 요약」과 「후보 하나의 대조 자료」로 접는다.
//
// 대조 자료는 네 칸이다: 공식 원문(지문·선지·공식 정답 집합) · 현재 분석(선지 판정·소거 설명) ·
// 현재 강의 cue · 수정 후보. 발행 전 검증(F6)과 판본 결속 결과를 같은 자리에 붙인다 —
// 검수자가 「무엇을 보고」 판정하는지가 한 화면에 있어야 한다.
// 서버에서만 부른다(스냅샷 450KB 를 클라이언트로 통째 보내지 않는다).

import type { LectureCue, LectureRole } from '../lecture/types'
import { validatePrepublish, type PrepublishReport } from './prepublish'
import { bindingDiff } from './state'
import type { CandidateRelation, ReviewCandidate, RevisionBinding } from './types'

export interface SnapshotCue {
  id: string
  role: string
  target: string
  text: string
}

export interface SnapshotItem {
  stem: string | null
  passageSentences: string[]
  choices: string[]
  officialAnswers: number[] | null
  analysis: {
    version: number
    answer: number | null
    choiceVerdicts: { n: number; verdict: string; howToReject: string | null }[]
    intent?: string | null
  } | null
  cues: SnapshotCue[]
}

export interface Snapshot {
  schema: string
  generatedFrom: Record<string, unknown>
  candidates: ReviewCandidate[]
  relations: CandidateRelation[]
  currentBindings: Record<string, RevisionBinding>
  items: Record<string, SnapshotItem>
}

export interface QueueRow {
  id: string
  itemId: string
  source: ReviewCandidate['source']
  defect: ReviewCandidate['defect']
  tracks: ReviewCandidate['tracks']
  changeCount: number
  stale: boolean
  textVerdict: ReviewCandidate['officialText']['verdict']
}

export interface CandidateDetail {
  candidate: ReviewCandidate
  item: SnapshotItem | null
  currentBinding: RevisionBinding | null
  /** 후보 binding 과 지금 판본이 어긋난 칸. 빈 배열 = 결속 일치 */
  bindingDrift: string[]
  /** 현재 판본 그대로의 발행 전 검증 */
  prepublishNow: PrepublishReport | null
  /** 수정 후보를 적용한 뒤의 발행 전 검증 — 제안이 충돌을 고치는지 */
  prepublishAfter: PrepublishReport | null
  relations: CandidateRelation[]
}

export const SOURCE_LABEL: Readonly<Record<ReviewCandidate['source'], string>> = {
  C_HANDOFF_30: 'C 인계 30',
  C_HOLD: 'C 보류',
  DRAIN_MULTI_ANSWER: '복수정답',
  E_T0149_GOLD: 'E Gold(AI 이중)',
}

export const DEFECT_LABEL: Readonly<Record<ReviewCandidate['defect'], string>> = {
  false_elimination: '사실과 다른 소거',
  false_trap: '사실과 다른 함정',
  emphasis_binding: '35번 강조 결속',
  overgeneralized_rule: '정리 규칙 과잉 일반화',
  explanation_error: '개별 설명 오류',
  extraction_error: '추출 오류 · 판정 보류',
  official_answer_conflict: '공식 정답 충돌',
  evidence_gold: '결정 근거 gold',
}

/** 'analysis:reject:5' → { kind:'analysis', id:'reject:5' } */
export function toLectureCue(c: SnapshotCue, order: number): LectureCue {
  const i = c.target.indexOf(':')
  const kind = c.target.slice(0, i) === 'anchor' ? 'anchor' : 'analysis'
  return {
    id: c.id,
    order,
    role: c.role as LectureRole,
    target: { kind, id: c.target.slice(i + 1) },
    segments: [{ lang: 'ko-KR', text: c.text }],
    est_sec: 0,
    pause_after_ms: 0,
  }
}

export function queueRows(s: Snapshot): QueueRow[] {
  return s.candidates.map((c) => {
    const now = s.currentBindings[c.itemId]
    return {
      id: c.id,
      itemId: c.itemId,
      source: c.source,
      defect: c.defect,
      tracks: c.tracks,
      changeCount: c.changes.length,
      stale: now ? bindingDiff(c.binding, now).length > 0 : true,
      textVerdict: c.officialText.verdict,
    }
  })
}

function prepublishFor(itemId: string, item: SnapshotItem, c: ReviewCandidate | null): PrepublishReport {
  return validatePrepublish({
    itemId,
    officialAnswers: item.officialAnswers,
    choiceVerdicts: (item.analysis?.choiceVerdicts ?? []).map((v) => ({ choice: v.n, verdict: v.verdict })),
    choices: item.choices,
    cues: item.cues.map(toLectureCue),
    changes: c ? c.changes : [],
  })
}

export function candidateDetail(s: Snapshot, id: string): CandidateDetail | null {
  const candidate = s.candidates.find((c) => c.id === id)
  if (!candidate) return null
  const item = s.items[candidate.itemId] ?? null
  const currentBinding = s.currentBindings[candidate.itemId] ?? null
  return {
    candidate,
    item,
    currentBinding,
    // 지금 판본을 모르면 결속을 「일치」로 보지 않는다 — 모름은 어긋남으로 센다
    bindingDrift: currentBinding ? bindingDiff(candidate.binding, currentBinding) : ['currentBinding'],
    prepublishNow: item ? prepublishFor(candidate.itemId, item, null) : null,
    prepublishAfter: item && candidate.changes.some((ch) => ch.proposed != null) ? prepublishFor(candidate.itemId, item, candidate) : null,
    relations: s.relations.filter((r) => r.a === id || r.b === id),
  }
}

/**
 * 수정 전후 의미 차이 — 글자 차이가 아니라 「무엇이 빠지고 무엇이 들어왔나」를 낱말 단위로.
 * 검수자는 바뀐 낱말만 보고 판정하지 않는다; 이 표시는 어디를 읽을지 안내할 뿐이다.
 */
export function wordDiff(a: string, b: string): { op: 'same' | 'del' | 'add'; text: string }[] {
  const x = a.split(/(\s+)/).filter(Boolean)
  const y = b.split(/(\s+)/).filter(Boolean)
  const n = x.length
  const m = y.length
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = x[i] === y[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!)
  const out: { op: 'same' | 'del' | 'add'; text: string }[] = []
  const push = (op: 'same' | 'del' | 'add', text: string) => {
    const last = out[out.length - 1]
    if (last && last.op === op) last.text += text
    else out.push({ op, text })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (x[i] === y[j]) { push('same', x[i]!); i++; j++ }
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) push('del', x[i++]!)
    else push('add', y[j++]!)
  }
  while (i < n) push('del', x[i++]!)
  while (j < m) push('add', y[j++]!)
  return out
}
