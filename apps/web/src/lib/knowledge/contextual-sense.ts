// apps/web/src/lib/knowledge/contextual-sense.ts
// LM-G1.5a — V2(v.contextual_sense) 「문맥 의미 선택」 확인 과제 주석 · 입력 검증 · 채점(순수).
//
// 대상 문항: 기출 어휘 유형(「밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지 않은 것」 · R-VOCAB / X-VOCAB).
// 과제가 묻는 것(직접 관찰):
//   B 판별  — 밑줄 다섯 중 이 문맥에 맞지 않는 낱말은 무엇인가(misfit)
//   D 대안  — 그 자리에 이 문맥이 요구하는 뜻은 무엇인가(sense · 한국어 뜻 선택지 · 배제 이유는 주석에)
//   C 근거  — 그 판단을 뒷받침하는 문장(cue · 문장 번호). **검수된 근거가 있을 때만 채점**하고 정오(isCorrect)에 합치지 않는다
// 관찰하지 않는 것: 낱말의 기본 뜻 암기(V1) · 문장 구조(S5) · 자유 설명 · 다른 유형으로의 일반화.
//
// 주석은 문장 번호와 한국어 뜻만 담는다(지문 원문은 평가원 저작물 — claim-support 와 같은 원칙). 골격 문장 길이 서명에 묶여
// 골격이 바뀌면 currentItemTask 가 채점하지 않는다. **두 판정자 합의(review.status = 'accepted')** 가 아닌 주석은 레지스트리에 노출하지 않는다.
// 학습자에게 열리는 것은 그 뒤 knowledge_applications 활성(사람 출시 승인)일 때만이다.
import { createHash } from 'node:crypto'

export const CONTEXTUAL_SENSE_KEY = 'contextual-sense'

export interface ContextualSenseAnnotation {
  version: string
  itemId: string
  skeletonSig: string
  sentenceCount: number
  /** 출시 전 필수. 원문 변경(길이가 같아도)·공식 정답 변경은 재검수 대상이다. */
  sourceRevision?: string
  officialAnswer?: number
  /** 밑줄 ①~⑤ 각각이 놓인 문장 번호(0부터) — 낱말 원문은 담지 않는다 */
  targets: number[]
  /** 맞지 않는 밑줄(0부터 · 공식 정답 번호 − 1) */
  misfit: number
  /** 그 자리에 이 문맥이 요구하는 뜻 — 선택지(한국어 뜻)와 정답 · 오답 배제 이유 */
  sense: { options: string[]; correct: number; rejectWhy: Record<string, string> }
  /** 판단 근거 문장 — reviewed 가 아니면 채점하지 않는다 */
  cue: { sentences: number[]; accepted: number[]; reviewed: boolean }
  review: {
    status: 'draft' | 'accepted' | 'rejected'
    annotator: string
    independentReviewer: string | null
    reviewerBlind: boolean
    agreement: string | null
    reviewedAt: string | null
  }
}

export interface ContextualSenseResponse {
  misfit: number
  sense: number
  cue: number[]
}

export interface ContextualSenseGrade {
  misfitOk: boolean
  senseOk: boolean
  /** null = 근거가 검수되지 않아 채점하지 않음 */
  cueOk: boolean | null
  /** B · D 조건 성공(근거 C 는 합치지 않는다) */
  isCorrect: boolean
}

const int = (x: unknown): x is number => Number.isInteger(x)

/** 주석 모양 검증 — 틀린 주석은 과제를 내지 않는다(null) */
export function validAnnotation(a: unknown): a is ContextualSenseAnnotation {
  if (!a || typeof a !== 'object') return false
  const x = a as ContextualSenseAnnotation
  const inRange = (n: unknown) => int(n) && (n as number) >= 0 && (n as number) < x.sentenceCount
  if (typeof x.version !== 'string' || typeof x.itemId !== 'string' || typeof x.skeletonSig !== 'string' || !int(x.sentenceCount) || x.sentenceCount < 1) return false
  if (!Array.isArray(x.targets) || x.targets.length !== 5 || !x.targets.every(inRange)) return false
  if (!int(x.misfit) || x.misfit < 0 || x.misfit > 4) return false
  const s = x.sense
  if (!s || !Array.isArray(s.options) || s.options.length < 2 || s.options.length > 5 || !s.options.every((o) => typeof o === 'string' && o.trim().length > 0)) return false
  if (new Set(s.options.map((o) => o.trim())).size !== s.options.length) return false
  if (!int(s.correct) || s.correct < 0 || s.correct >= s.options.length) return false
  // 오답 뜻마다 배제 이유가 있어야 한다(「왜 이 문맥에서 아닌가」 없이 채점하지 않는다)
  for (let i = 0; i < s.options.length; i++) if (i !== s.correct && !(typeof s.rejectWhy?.[String(i)] === 'string' && s.rejectWhy[String(i)].trim().length > 0)) return false
  const c = x.cue
  if (!c || !Array.isArray(c.sentences) || !Array.isArray(c.accepted) || typeof c.reviewed !== 'boolean') return false
  if (!c.sentences.every(inRange) || !c.accepted.every(inRange)) return false
  if (c.reviewed && c.sentences.length === 0) return false
  if (!x.review || !['draft', 'accepted', 'rejected'].includes(x.review.status)) return false
  return true
}

/** 노출 자격 — 모양이 맞고 두 판정자 합의(accepted · 맹검 독립 검수자 있음)일 때만 */
export function releasable(a: unknown): a is ContextualSenseAnnotation {
  if (!validAnnotation(a)) return false
  const r = a.review
  const actor = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0
  return r.status === 'accepted' && actor(r.annotator) && actor(r.independentReviewer)
    && r.annotator.trim() !== r.independentReviewer.trim() && r.reviewerBlind === true
    && actor(r.agreement) && typeof r.reviewedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(r.reviewedAt) && Number.isFinite(Date.parse(r.reviewedAt))
    && typeof a.sourceRevision === 'string' && /^[a-f0-9]{64}$/.test(a.sourceRevision)
    && a.officialAnswer === a.misfit + 1
}

/** 중복은 마지막 값으로 덮지 않는다. 합의된 정본이 하나로 고정될 때까지 해당 문항을 닫는다. */
export function indexContextualSenseAnnotations(sources: readonly unknown[]): Record<string, ContextualSenseAnnotation> {
  const counts = new Map<string, number>()
  for (const a of sources) if (a && typeof a === 'object' && typeof (a as { itemId?: unknown }).itemId === 'string') {
    const id = (a as { itemId: string }).itemId
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return Object.fromEntries(sources.filter(releasable).filter((a) => counts.get(a.itemId) === 1).map((a) => [a.itemId, a]))
}

export function contextualSenseHash(a: ContextualSenseAnnotation): string {
  return createHash('sha256').update(JSON.stringify(a)).digest('hex')
}

/** 화면이 받는 모양 — 정답(misfit · correct) · 배제 이유 · 근거 문장은 담지 않는다 */
export function contextualSensePanel(a: ContextualSenseAnnotation): { sentenceCount: number; targets: number[]; senseOptions: string[]; cueGraded: boolean } {
  return { sentenceCount: a.sentenceCount, targets: [...a.targets], senseOptions: [...a.sense.options], cueGraded: a.cue.reviewed }
}

export function parseContextualSense(raw: unknown, a: ContextualSenseAnnotation): ContextualSenseResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!int(r.misfit) || r.misfit < 0 || r.misfit > 4) return null
  if (!int(r.sense) || r.sense < 0 || r.sense >= a.sense.options.length) return null
  const cue = r.cue === undefined ? [] : r.cue
  if (!Array.isArray(cue) || cue.length > a.sentenceCount || !cue.every((n) => int(n) && n >= 0 && n < a.sentenceCount)) return null
  if (new Set(cue).size !== cue.length) return null
  return { misfit: r.misfit, sense: r.sense, cue: [...cue].sort((p, q) => p - q) }
}

export function gradeContextualSense(a: ContextualSenseAnnotation, r: ContextualSenseResponse): ContextualSenseGrade {
  const misfitOk = r.misfit === a.misfit
  // 뜻은 맞지 않는 자리에 대해서만 묻는다 — 엉뚱한 자리를 고르고 고른 뜻은 이 문맥의 판단이 아니다
  const senseOk = misfitOk && r.sense === a.sense.correct
  let cueOk: boolean | null = null
  if (a.cue.reviewed) {
    const ok = new Set([...a.cue.sentences, ...a.cue.accepted])
    cueOk = r.cue.length > 0 && r.cue.every((n) => ok.has(n)) && r.cue.some((n) => a.cue.sentences.includes(n))
  }
  return { misfitOk, senseOk, cueOk, isCorrect: misfitOk && senseOk }
}
