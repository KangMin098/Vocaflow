// apps/web/src/lib/knowledge/practice.ts
// /csat/practice 「주장과 근거」 연습의 순수 규칙(2026-10-08 이식 — docs/csat-learner/PRACTICE_PORT.md).
// 이식 원천은 동결된 feat/knowledge-vnext 의 practice.ts(pickNext · 응답 범위 검사), 채점은 정본 gradeClaimSupport 다(옛 scoreClaim 폐기).
//
// ⚠️ 저작권 경계: 학습자에게 가는 것은 문장 길이 막대와 번호뿐이다. 지문 글자는 학습자가 자기 문제지에서 읽는다.
// ⚠️ 정답 키(PracticeKey)는 서버 전용이다. 학습자에게는 기록이 저장된 뒤 practiceFeedback 으로만 나간다.
// ⚠️ 문장 번호는 구운 골격(lib/csat/skeleton-data)의 0부터 세는 번호다 — 골격을 다시 구우면 이 파일의 회귀 시험을 돌린다.
// 이 파일은 node:crypto 를 쓰는 claim-support.ts 를 값으로 import 하지 않는다(클라이언트 컴포넌트가 pickNext 를 쓴다).
import type { ClaimSupportAnnotation, ClaimSupportGrade } from './claim-support'
import { RELATIONS, type Relation } from './claim-support-labels'

/** 정본 주석으로 채점하는 과제 — product-server.CLAIM_SUPPORT_TASK 와 같은 값(효과 계산 후보) */
export const PRACTICE_TASK = 'claim-support'
/** 골격 정답 근거 앵커로 채점하는 개발 · 연습용 과제 — 효과 계산에서 언제나 빠진다 */
export const SKELETON_TASK = 'claim-support-skeleton'
export const PRACTICE_SLUG = 'claim-support'

/** 연습(훈련) 유형과 전이(옮겨 보기) 유형 — 골격 115문항의 네 유형 */
export const TRAIN_TYPES = ['R-CLAIM', 'R-GIST'] as const
export const TRANSFER_TYPES = ['R-TOPIC', 'R-TITLE'] as const
export const TYPE_LABEL: Record<string, string> = { 'R-CLAIM': '필자 주장', 'R-GIST': '요지', 'R-TOPIC': '주제', 'R-TITLE': '제목' }

export type PracticePhase = 'practice' | 'transfer'
/** G0 §2 도움 수준 — hint 는 예약(이 화면에 힌트 기능 없음) */
export type HelpLevel = 'independent' | 'viewed_first'
export type PoolKind = 'annotated' | 'skeleton'

export function phaseOfType(typeId: string): PracticePhase | null {
  if ((TRAIN_TYPES as readonly string[]).includes(typeId)) return 'practice'
  if ((TRANSFER_TYPES as readonly string[]).includes(typeId)) return 'transfer'
  return null
}

/** 서버 전용 정답 키 */
export interface PracticeKey {
  itemId: string
  kind: PoolKind
  sentenceCount: number
  claim: number
  /** 주장으로 골라도 「가까운 판단」인 문장(정본 주석) · 골격에서는 나머지 정답 근거 앵커 문장 */
  claimRestated: number[]
  support: number[]
  /** 골라도 · 안 골라도 채점하지 않는 문장 */
  supportDisputed: number[]
  /** 오답 선지가 기대거나 필자가 반박하는 문장 */
  trap: number[]
  /** 주석 문항만 관계를 묻는다 */
  relationProbe: { sentence: number; relation: Relation } | null
}

export function keyFromAnnotation(a: ClaimSupportAnnotation): PracticeKey {
  return {
    itemId: a.itemId,
    kind: 'annotated',
    sentenceCount: a.sentenceCount,
    claim: a.claim,
    claimRestated: [...a.claimRestated],
    support: [...a.support],
    supportDisputed: [...a.supportDisputed],
    trap: [...a.opposed],
    relationProbe: { ...a.relationProbe },
  }
}

/** 골격 문항 한 개 — 여기서 쓰는 칸만 */
export interface SkeletonItemLike {
  id: string
  sentences: { chars: number }[]
  anchors: { id: string; sentences: number[]; from?: string; lure?: boolean }[]
}

/**
 * 골격 정답 근거 앵커로 만든 **검증 안 된** 키. 정답 근거 앵커는 논증 구조 주석이 아니다(claim-support.ts 머리말) —
 * 그래서 이 키로 낸 기록은 SKELETON_TASK 로 남고 효과 계산에 들어가지 않는다.
 * 옛 판정(정답 근거 문장 중 하나를 주장으로 고르면 적중)을 보존하려고 첫 앵커 문장을 claim, 나머지를 claimRestated 로 둔다.
 * 근거는 채점하지 않는다 — 함정 문장을 근거로 고를 때만 「더 고름」이 된다.
 * 끌리는 구절 드레인 자리(`lure`)는 함정으로 세지 않는다 — 그 문장이 주장의 실제 근거일 수 있어, 맞는 근거를 고른 학습자에게
 * 「더 고름」을 보일 위험이 있다(2026-10-10 측정: 넣으면 62/115문항 · 함정 문장 +90). 채점에 넣으려면 표본 검증부터.
 */
export function keyFromSkeleton(it: SkeletonItemLike): PracticeKey | null {
  const n = it.sentences.length
  const answer = it.anchors.find((a) => a.id === 'answer' || a.from === 'answer')
  const keys = [...new Set(answer?.sentences ?? [])].filter((i) => Number.isInteger(i) && i >= 0 && i < n).sort((a, b) => a - b)
  if (keys.length === 0 || n < 2) return null
  const trap = [
    ...new Set(
      it.anchors
        .filter((a) => a.id !== 'answer' && !a.lure && (a.from === 'tempt' || a.from === 'reject' || a.id.startsWith('reject:')))
        .flatMap((a) => a.sentences),
    ),
  ]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < n && !keys.includes(i))
    .sort((a, b) => a - b)
  const all = Array.from({ length: n }, (_, i) => i)
  return {
    itemId: it.id,
    kind: 'skeleton',
    sentenceCount: n,
    claim: keys[0],
    claimRestated: keys.slice(1),
    support: [],
    supportDisputed: all.filter((i) => i !== keys[0] && !trap.includes(i)),
    trap,
    relationProbe: null,
  }
}

/** 정본 채점 함수에 넘길 주석 모양 — 채점에 쓰는 칸만 의미가 있다 */
export function annotationForGrading(k: PracticeKey, relation: Relation | null): ClaimSupportAnnotation {
  return {
    version: `practice:${k.kind}`,
    itemId: k.itemId,
    skeletonSig: '',
    sentenceCount: k.sentenceCount,
    claim: k.claim,
    claimRestated: k.claimRestated,
    support: k.support,
    supportDisputed: k.supportDisputed,
    opposed: k.trap,
    // 관계를 묻지 않는 문항은 relationOk 를 쓰지 않는다(gradePractice 가 null 로 덮는다) — 값은 아무거나 같게 둔다
    relationProbe: k.relationProbe ?? { sentence: k.claim, relation: relation ?? RELATIONS[0] },
    answerAnchorOverlap: { answerAnchorSentences: [], note: '' },
    provenance: { annotator: '', independentReviewer: '', reviewerBlind: false, agreement: '', resolved: '', reviewedAt: '' },
  }
}

export interface PracticeAnswer {
  claim: number
  /** 0–3개 */
  support: number[]
  /** 관계를 묻는 문항만 */
  relation: Relation | null
  /** 문제지에서 고른 선지 1–5 · 아직 안 골랐으면 null */
  option: number | null
  confidence: 1 | 2 | 3
}

export interface PracticeGrade {
  claimHit: boolean
  claimRestated: boolean
  supportOk: boolean
  supportMissed: number[]
  supportExtra: number[]
  relationOk: boolean | null
  /** 주장 · 근거 · (관계) 모두 맞음 — 선지 정오와 별개 */
  isCorrect: boolean
}

type Grader = (a: ClaimSupportAnnotation, r: { claim: number; support: number[]; relation: Relation }) => ClaimSupportGrade

/** 채점 — 정본 gradeClaimSupport 를 주입받는다(서버가 넘긴다 · 시험은 같은 함수를 넘긴다) */
export function gradePractice(grade: Grader, k: PracticeKey, r: PracticeAnswer): PracticeGrade {
  // 관계를 안 고른 주석 문항은 아래에서 relationOk=false 로 둔다 — 채점 함수에는 자리만 채워 넘긴다
  const relation = r.relation ?? RELATIONS[0]
  const g = grade(annotationForGrading(k, relation), { claim: r.claim, support: r.support, relation })
  const claimHit = g.claimOk || (k.kind === 'skeleton' && g.claimRestated)
  const relationOk = k.relationProbe ? r.relation !== null && g.relationOk : null
  return {
    claimHit,
    claimRestated: !claimHit && g.claimRestated,
    supportOk: g.supportOk,
    supportMissed: g.supportMissed,
    supportExtra: g.supportExtra,
    relationOk,
    isCorrect: claimHit && g.supportOk && relationOk !== false,
  }
}

export interface PracticeSubmission extends PracticeAnswer {
  itemId: string
  sec: number | null
  /** 제출마다 새 uuid — 같은 논리적 변경의 재시도만 같은 값(G2 요청 멱등) */
  clientMutationId: string
  /** 문항을 연 세션의 uuid */
  clientSessionId: string
  /** 판단한 시각(기기) — 필수. 첫 시도 순서는 도착이 아니라 이 값으로 정한다 */
  answeredAt: string
  helpLevel: HelpLevel
  /** 판단을 보낸 뒤 해설을 연 시각 — 도움 수준과 별개인 행동 기록(없으면 null) */
  explanationViewedAt: string | null
  preview: boolean
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SKEW_MS = 5 * 60_000
const MAX_AGE_MS = 30 * 86_400_000

/** G2 기록 계약의 클라이언트 메타(요청 멱등 id · 세션 id · 판단 시각 · 도움 수준) — practice 와 문항 확인 과제가 같은 규칙을 쓴다 */
export interface ClientMeta {
  clientMutationId: string
  clientSessionId: string
  answeredAt: string
  helpLevel: HelpLevel
}

export function parseClientMeta(o: Record<string, unknown>, now: number): ParseResult<ClientMeta> {
  if (typeof o.clientMutationId !== 'string' || !UUID.test(o.clientMutationId)) return { ok: false, error: '제출 id 가 없어요' }
  if (typeof o.clientSessionId !== 'string' || !UUID.test(o.clientSessionId)) return { ok: false, error: '세션 id 가 없어요' }
  const at = typeof o.answeredAt === 'string' ? Date.parse(o.answeredAt) : Number.NaN
  if (!Number.isFinite(at)) return { ok: false, error: '판단 시각이 없어요' }
  if (at > now + SKEW_MS || at < now - MAX_AGE_MS) return { ok: false, error: '판단 시각이 맞지 않아요 — 기기 시계를 확인해 주세요' }
  if (o.helpLevel !== 'independent' && o.helpLevel !== 'viewed_first') return { ok: false, error: '도움 수준이 맞지 않아요' }
  return {
    ok: true,
    value: { clientMutationId: o.clientMutationId.toLowerCase(), clientSessionId: o.clientSessionId.toLowerCase(), answeredAt: new Date(at).toISOString(), helpLevel: o.helpLevel },
  }
}

/** 요청 본문의 모양 검사(숫자 · uuid · 시각만). 문항 범위 검사는 키를 안 뒤 checkAnswerRange 로 한다 */
export function parseSubmission(v: unknown, now: number): ParseResult<PracticeSubmission> {
  if (!v || typeof v !== 'object') return { ok: false, error: '응답이 비었어요' }
  const o = v as Record<string, unknown>
  if (typeof o.itemId !== 'string' || !/^[A-Za-z0-9]{1,16}#\d{1,2}$/.test(o.itemId)) return { ok: false, error: '문항을 찾지 못했어요' }
  const meta = parseClientMeta(o, now)
  if (!meta.ok) return meta
  const ev = o.explanationViewedAt === null || o.explanationViewedAt === undefined ? null : typeof o.explanationViewedAt === 'string' ? Date.parse(o.explanationViewedAt) : Number.NaN
  if (ev !== null && (!Number.isFinite(ev) || ev > now + SKEW_MS || ev < now - MAX_AGE_MS)) return { ok: false, error: '해설 열람 시각이 맞지 않아요' }
  if (!Number.isInteger(o.claim)) return { ok: false, error: '주장 문장을 골라 주세요' }
  const support = Array.isArray(o.support) ? o.support : null
  // 근거는 「모두」 고른다 — 주석 문항은 근거가 6개인 것도 있다(2021#20). 상한은 지문 문장 수 범위(채점 쪽이 문항 문장 수로 다시 막는다) · 2026-10-10 0~3 상한 때문에 항상 오답이던 결함
  if (!support || support.length > 20 || !support.every((x) => Number.isInteger(x))) return { ok: false, error: '근거 문장을 다시 골라 주세요' }
  const relation = o.relation === null || o.relation === undefined ? null : o.relation
  if (relation !== null && !(typeof relation === 'string' && (RELATIONS as readonly string[]).includes(relation))) return { ok: false, error: '관계를 다시 골라 주세요' }
  const option = o.option === null || o.option === undefined ? null : o.option
  if (option !== null && !(Number.isInteger(option) && (option as number) >= 1 && (option as number) <= 5)) return { ok: false, error: '선지는 1~5번이에요' }
  if (o.confidence !== 1 && o.confidence !== 2 && o.confidence !== 3) return { ok: false, error: '확신을 골라 주세요' }
  const sec = typeof o.sec === 'number' && Number.isFinite(o.sec) && o.sec >= 0 ? Math.min(7200, Math.round(o.sec)) : null
  const claim = o.claim as number
  return {
    ok: true,
    value: {
      itemId: o.itemId,
      claim,
      support: [...new Set(support as number[])].filter((i) => i !== claim).sort((a, b) => a - b),
      relation: relation as Relation | null,
      option: option as number | null,
      confidence: o.confidence,
      sec,
      ...meta.value,
      explanationViewedAt: ev === null ? null : new Date(ev).toISOString(),
      preview: o.preview === true,
    },
  }
}

export function checkAnswerRange(k: PracticeKey, a: PracticeAnswer): string | null {
  const ok = (i: number) => i >= 0 && i < k.sentenceCount
  if (!ok(a.claim)) return '주장 문장 번호가 범위를 벗어났어요'
  if (!a.support.every(ok)) return '근거 문장 번호가 범위를 벗어났어요'
  if (k.relationProbe && a.relation === null) return '관계를 골라 주세요'
  if (!k.relationProbe && a.relation !== null) return '이 문항은 관계를 묻지 않아요'
  return null
}

/** 학습자에게 가는 판정 — 기록이 저장된 뒤에만 만든다 */
export interface PracticeFeedback {
  phase: PracticePhase
  kind: PoolKind
  claimHit: boolean
  claimRestated: boolean
  supportOk: boolean
  relationOk: boolean | null
  optionCorrect: boolean | null
  claimSentences: number[]
  supportSentences: number[]
  trapSentences: number[]
  relationProbe: { sentence: number; relation: Relation } | null
  helpLevel: HelpLevel
  next: string
}

export function practiceFeedback(k: PracticeKey, g: PracticeGrade, optionCorrect: boolean | null, phase: PracticePhase, helpLevel: HelpLevel): PracticeFeedback {
  let next: string
  if (g.claimHit && !g.supportOk) next = '주장 문장은 맞았어요. 표시된 근거 문장이 주장을 어떻게 떠받치는지 한 줄로 적어 봐요.'
  else if (g.claimHit && g.relationOk === false) next = '주장과 근거는 찾았어요. 표시된 문장이 주장과 어떤 관계인지 다시 나눠 봐요.'
  else if (g.claimHit && optionCorrect === false) next = '주장 문장은 맞았어요. 선지가 그 문장과 어디서 어긋나는지 한 줄로 적어 봐요.'
  else if (g.claimHit) next = '주장 문장을 먼저 잡았어요. 다음 문항도 같은 순서로 가요.'
  else if (g.claimRestated) next = '고른 문장은 주장을 다시 말한 문장이에요. 처음 주장을 세우는 문장을 찾아 봐요.'
  else if (k.trap.length > 0) next = '표시된 함정 문장이 주장인지 근거 · 예시인지 다시 나눠 봐요.'
  else next = '표시된 문장을 문제지에서 다시 읽고, 왜 그 문장이 글 전체를 묶는지 한 줄로 적어 봐요.'
  return {
    phase,
    kind: k.kind,
    claimHit: g.claimHit,
    claimRestated: g.claimRestated,
    supportOk: g.supportOk,
    relationOk: g.relationOk,
    optionCorrect,
    claimSentences: [k.claim, ...(k.kind === 'skeleton' ? k.claimRestated : [])],
    supportSentences: k.support,
    trapSentences: k.trap,
    relationProbe: k.relationProbe,
    helpLevel,
    next,
  }
}

/** 기록 한 줄(내 기록 화면 · 판정 입력) */
export interface MyAttempt {
  itemId: string
  phase: PracticePhase
  helpLevel: HelpLevel
  claimHit: boolean | null
  answeredAt: string
  /** 과제 키 · 행 id — DB 뷰 learning_first_attempts 와 같은 첫 시도 키 · 동률 순서(answered_at, id)를 쓰려고 */
  taskKey?: string
  id?: number
  /** 같은 (과제 · 문항 · 단계)의 첫 판단이 다른 활동(해설 극장)이었다 — 완료 · 이력에는 남고 역량 판정에서만 빠진다 */
  firstElsewhere?: boolean
}

/**
 * 학습자 · 과제 · 문항 · 단계마다 **판단 시각이 가장 이른 시도만**(G2 §3 첫 시도). 정답을 본 뒤 다시 낸 것은 판정에 넣지 않는다.
 * 도착 순이 아니라 answeredAt 순이다 — 늦게 동기화된 이른 판단이 첫 시도다.
 * 키 · 동률 규칙은 DB 뷰 learning_first_attempts 와 같다: (task_key, item_ref, phase) · answered_at → id 순
 */
export function firstAttempts<T extends { itemId: string; phase: string; answeredAt: string; taskKey?: string; id?: number }>(rows: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of [...rows].sort((a, b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt) || (a.id ?? 0) - (b.id ?? 0))) {
    const k = `${r.taskKey ?? ''} ${r.itemId} ${r.phase}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

/** 역량 판정 입력 — 첫 시도 중 연습 단계 · 독립 수행만(해설 먼저 본 시도는 독립 수행과 분리 · G0 §2) */
export function capabilityHits(rows: readonly MyAttempt[]): (boolean | null)[] {
  return firstAttempts(rows)
    // 첫 판단이 다른 활동(해설 극장)이었던 묶음은 독립 첫 시도가 아니다
    .filter((r) => r.phase === 'practice' && r.helpLevel === 'independent' && !r.firstElsewhere)
    .map((r) => r.claimHit)
}

/**
 * 다음 문항 고르기 — 자유 이동이 기본이고 이건 추천일 뿐이다(이식 원천 그대로 · 단계 이름만 정본 phase 로).
 * 연습 유형 중 아직 안 한 문항 → 연습을 transferEvery 회 채울 때마다 전이 유형 하나를 섞는다.
 * trainDone 은 화면 표시 수가 아니라 **문항 단위 완료 수**다(같은 문항 재제출은 늘리지 않는다).
 */
export function pickNext(
  pool: { practice: readonly string[]; transfer: readonly string[] },
  doneItemIds: ReadonlySet<string>,
  trainDone: number,
  transferEvery = 5,
): { itemId: string; phase: PracticePhase } | null {
  const freshTrain = pool.practice.filter((id) => !doneItemIds.has(id))
  const freshTransfer = pool.transfer.filter((id) => !doneItemIds.has(id))
  const wantTransfer = trainDone > 0 && trainDone % transferEvery === 0 && freshTransfer.length > 0
  if (wantTransfer) return { itemId: freshTransfer[0], phase: 'transfer' }
  if (freshTrain.length > 0) return { itemId: freshTrain[0], phase: 'practice' }
  if (freshTransfer.length > 0) return { itemId: freshTransfer[0], phase: 'transfer' }
  return null
}

/** 합성(테스트) 계정 — 기록을 synthetic 으로 분리한다. 서버 목록 확정 전 잠정 규칙(G2 검토 B5) */
export const SYNTHETIC_EMAIL_DOMAINS = ['vocaflow.dev', 'vocaflow.local', 'example.com'] as const
export function isSyntheticEmail(email: string | null | undefined): boolean {
  const d = (email ?? '').toLowerCase().split('@')[1] ?? ''
  return (SYNTHETIC_EMAIL_DOMAINS as readonly string[]).includes(d)
}

/** 내 복습 — 이 학습자의 Practice 복습 예약 한 줄(세션) */
export interface ReviewSession {
  item_ref: string | null
  review_at: string | null
  deleted_at: string | null
}

export interface PendingReview {
  itemId: string
  /** 예약 시각(저장값 · KST 00:00) */
  reviewAt: string
  /** 예약일이 지났나(now 기준) */
  due: boolean
}

/**
 * 아직 끝나지 않은 복습 예약 — 예약 시각 뒤에 **같은 문항**을 다시 판단했으면 끝난 것이다(학습 지도와 같은 계약 · PR #170).
 * 해설 열람은 판단 기록이 아니므로 예약을 끝내지 않는다. 같은 문항에 예약이 여럿이면 가장 이른 것 하나. 이른 날짜 순.
 * `now` 는 호출자가 넘긴다(시계를 직접 읽지 않는다).
 */
export function pendingReviews(sessions: readonly ReviewSession[], attempts: readonly { itemId: string; answeredAt: string }[], now: number): PendingReview[] {
  const byItem = new Map<string, string>()
  for (const s of sessions) {
    if (!s.item_ref || !s.review_at || s.deleted_at) continue
    const at = s.review_at
    const done = attempts.some((a) => a.itemId === s.item_ref && Date.parse(a.answeredAt) >= Date.parse(at))
    if (done) continue
    const prev = byItem.get(s.item_ref)
    if (!prev || Date.parse(at) < Date.parse(prev)) byItem.set(s.item_ref, at)
  }
  return [...byItem.entries()]
    .map(([itemId, reviewAt]) => ({ itemId, reviewAt, due: Date.parse(reviewAt) <= now }))
    .sort((a, b) => Date.parse(a.reviewAt) - Date.parse(b.reviewAt))
}
