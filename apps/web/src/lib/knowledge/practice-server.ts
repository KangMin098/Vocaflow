// apps/web/src/lib/knowledge/practice-server.ts
// /csat/practice 서버 쪽 — 문항 풀 · 내 기록 · 제출(채점 → 기록 → 판정). docs/csat-learner/PRACTICE_PORT.md
//
// 문항 풀:
//   annotated = 정본 주장/근거 주석이 있고 지금 골격과 서명이 같은 문항(currentAnnotation). 학습자에게는 적용이 active 이고
//               채택 사슬이 살아 있을 때만(loadLiveApplication) — 정본 product-server 와 같은 게이트.
//   skeleton  = 골격 115문항(R-CLAIM · GIST · TOPIC · TITLE) 중 정답 근거 앵커가 있는 것. **관리자 미리보기에서만** 보인다 —
//               출처 · 권리 · 정답 · 해설 · 근거 · 난도 확인 전에는 운영 학습 · 효과 검증에 쓰지 않는다(VNEXT_MERGE §0).
// 정답 키는 기록이 저장된 뒤에만 응답으로 나간다(submitPractice 의 순서가 그 경계다).
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { loadItemSkeleton, skeletonSiblings } from '@/lib/csat/skeleton'
import { createAdminClient } from '@/lib/supabase/admin'

import { annotatedItemIds, annotationFor, annotationHash, gradeClaimSupport, type ClaimSupportAnnotation } from './claim-support'
import { currentItemTask } from './item-tasks'
import {
  PRACTICE_SLUG,
  PRACTICE_TASK,
  SKELETON_TASK,
  TRAIN_TYPES,
  TRANSFER_TYPES,
  checkAnswerRange,
  gradePractice,
  keyFromAnnotation,
  keyFromSkeleton,
  phaseOfType,
  practiceFeedback,
  type HelpLevel,
  type MyAttempt,
  type PoolKind,
  type PracticeFeedback,
  type PracticeKey,
  type PracticePhase,
  type PracticeSubmission,
} from './practice'
import { selectWriter, stableUuid, type AttemptWriter } from './practice-writer'
import { CLAIM_SUPPORT_TASK, itemTaskRef, loadLiveApplication } from './product-server'

/** 정본 주석이 있는 문항 — claim-support.ts 의 주석 레지스트리에서 만든다(손 목록이면 주석을 늘려도 연습 풀이 1문항에 머문다) */
export const ANNOTATED_ITEM_IDS: readonly string[] = annotatedItemIds()

export interface PoolEntry {
  itemId: string
  no: number
  examLabel: string
  typeId: string
  phase: PracticePhase
  kind: PoolKind
  /** 학습자에게 가는 막대(문장 글자 수) */
  bars: number[]
  /** 관계를 묻는 문장(주석 문항만) */
  relationSentence: number | null
}

export interface ServerEntry extends PoolEntry {
  key: PracticeKey
  contentHash: string
  applicationId: string | null
  appVersion: number | null
}

function admin(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

async function serverPool(opts: { preview: boolean }, client?: SupabaseClient): Promise<ServerEntry[]> {
  const out: ServerEntry[] = []
  const annotated = new Set<string>(ANNOTATED_ITEM_IDS)
  for (const typeId of [...TRAIN_TYPES, ...TRANSFER_TYPES]) {
    const phase = phaseOfType(typeId)!
    for (const s of skeletonSiblings(typeId)) {
      const sk = loadItemSkeleton(s.id)
      if (!sk) continue
      const bars = sk.sentences.map((x) => x.chars)
      if (annotated.has(s.id)) {
        // 정본 레지스트리(item-tasks)가 과제 종류를 일반화했다 — 이 연습은 「주장과 근거」 만 채점하므로 그 과제의 살아 있는 주석만 쓴다
        const task = currentItemTask(s.id)
        if (!task || task.def.key !== CLAIM_SUPPORT_TASK) continue
        const ann = task.ann as unknown as ClaimSupportAnnotation
        const live = await loadLiveApplication('csat_item_task', itemTaskRef(CLAIM_SUPPORT_TASK, s.id), client)
        if (!live && !opts.preview) continue
        out.push({
          itemId: s.id, no: s.no, examLabel: s.exam_label, typeId, phase, kind: 'annotated', bars,
          relationSentence: ann.relationProbe.sentence, key: keyFromAnnotation(ann), contentHash: annotationHash(ann),
          applicationId: live?.app.id ?? null, appVersion: live?.app.version ?? null,
        })
        continue
      }
      if (!opts.preview) continue
      const key = keyFromSkeleton(sk)
      if (!key) continue
      out.push({
        itemId: s.id, no: s.no, examLabel: s.exam_label, typeId, phase, kind: 'skeleton', bars, relationSentence: null, key,
        contentHash: `skeleton:${JSON.stringify(bars)}:${JSON.stringify(sk.anchors.find((a) => a.id === 'answer')?.sentences ?? [])}`,
        applicationId: null, appVersion: null,
      })
    }
  }
  // 주석 문항 먼저, 그다음 최근 회차부터
  return out.sort((a, b) => (a.kind === b.kind ? b.itemId.localeCompare(a.itemId) || a.no - b.no : a.kind === 'annotated' ? -1 : 1))
}

/**
 * 학습자에게 「같은 원리를 다른 지문에 적용」 을 안내해도 되나 — 실학습 풀(미리보기 아님)에 그 문항 말고 다른 문항이 있을 때만.
 * 있으면 Practice 화면 주소, 없으면 null(같은 문항뿐인데 「다른 지문」 이라고 말하지 않는다).
 */
export async function practiceHrefBeyond(itemId: string): Promise<string | null> {
  return (await practiceHrefsBeyond([itemId]))[itemId] ?? null
}

/** 여러 문항을 한 번에 — 풀은 요청당 한 번만 계산한다(문항마다 다시 읽지 않는다) */
export async function practiceHrefsBeyond(itemIds: string[]): Promise<Record<string, string | null>> {
  if (itemIds.length === 0) return {}
  const pool = await serverPool({ preview: false }, admin())
  const href = `/csat/practice/${PRACTICE_SLUG}`
  return Object.fromEntries(itemIds.map((id) => [id, pool.some((e) => e.itemId !== id) ? href : null]))
}

/** 화면용 풀 — 정답 키 없음 */
export async function loadPracticePool(opts: { preview: boolean }): Promise<PoolEntry[]> {
  return (await serverPool(opts, admin())).map((e) => ({
    itemId: e.itemId, no: e.no, examLabel: e.examLabel, typeId: e.typeId, phase: e.phase, kind: e.kind, bars: e.bars, relationSentence: e.relationSentence,
  }))
}

/**
 * 내 기록(학습자 RLS 클라이언트 — 본인 SELECT 만). 실학습 화면은 미리보기 아닌 기록, 미리보기 화면은 미리보기 기록만 — 섞지 않는다.
 * 판정 · 완료는 호출자가 firstAttempts 로 문항마다 첫 시도만 센다.
 */
export async function loadMyAttempts(learnerDb: SupabaseClient, userId: string, opts: { preview: boolean }): Promise<MyAttempt[]> {
  const { data, error } = await learnerDb
    .from('learning_task_attempts')
    .select('id, task_key, item_ref, phase, answered_at, activity, help_level, response')
    .eq('user_id', userId)
    .in('task_key', [PRACTICE_TASK, SKELETON_TASK])
    .order('answered_at')
    .order('id')
    .limit(1000)
  if (error) throw new Error(`내 기록 읽기 실패: ${error.message}`)
  // 정본 열(activity · help_level) 우선 — NULL(G2 전 직접 기록)일 때만 response 사본으로 호환
  type Row = { id: number; task_key: string; item_ref: string | null; phase: string; answered_at: string; activity: string | null; help_level: string | null; response: Record<string, unknown> | null }
  const rows = (data ?? []) as Row[]
  // 첫 시도는 **활동과 무관하게** (과제 · 문항 · 단계)의 가장 이른 판단이다(DB 뷰 learning_first_attempts 와 같다 — 이미 answered_at · id 순).
  // 그 첫 판단이 해설 극장(theater) 등 다른 활동이면, Practice 재풀이는 첫 시도가 아니다 — 역량 판정에서만 뺀다(Codex P2).
  // 완료 · 이력은 수행 기록을 그대로 둔다(빼면 연습을 마쳐도 새로고침 뒤 미완료로 보인다)
  const firstActivity = new Map<string, string | undefined>()
  for (const r of rows) {
    const k = `${r.task_key} ${r.item_ref ?? ''} ${r.phase}`
    if (!firstActivity.has(k)) firstActivity.set(k, (r.activity ?? r.response?.activity) as string | undefined)
  }
  // 실효 도움(M8): 첫 시도 뷰의 판단 시각 기준 도움 · 판단 뒤 해설 · 시각 불확실을 읽는다 — 저장 당시 help_level 은 늦게 도착한 도움을 모른다(Codex P2).
  // 뷰에 없는 행(첫 시도가 아님 · 뷰를 못 읽음)은 저장값으로 판단한다
  const { data: firsts, error: fErr } = await learnerDb
    .from('learning_first_attempts')
    .select('attempt_id, help_level, after_explanation, timing_uncertain')
    .eq('user_id', userId)
    .in('task_key', [PRACTICE_TASK, SKELETON_TASK])
    .limit(1000)
  if (fErr) throw new Error(`첫 시도 읽기 실패: ${fErr.message}`)
  // 뷰 help_level 이 NULL(G2 전 직접 기록 — 세션 없음 · 열 없음)이면 독립 여부는 저장값(response 호환)으로, 해설 뒤 · 시각 불확실은 그대로 적용
  const view = new Map<number, { help: string | null; blocked: boolean }>()
  for (const f of (firsts ?? []) as { attempt_id?: number; help_level?: string | null; after_explanation?: boolean | null; timing_uncertain?: boolean | null }[]) {
    if (typeof f.attempt_id === 'number') view.set(f.attempt_id, { help: f.help_level ?? null, blocked: Boolean(f.after_explanation) || Boolean(f.timing_uncertain) })
  }
  const stored = (r: Row) => (r.help_level ?? r.response?.help_level ?? 'independent') === 'independent'
  const independent = (r: Row) => {
    const v = view.get(r.id)
    if (!v) return stored(r)
    return (v.help === null ? stored(r) : v.help === 'independent') && !v.blocked
  }
  return rows
    .filter((r) => (r.activity ?? r.response?.activity) === 'practice' && (r.response?.preview === true) === opts.preview)
    .filter((r) => r.item_ref && (r.phase === 'practice' || r.phase === 'transfer'))
    .map((r) => ({
      id: r.id,
      taskKey: r.task_key,
      firstElsewhere: firstActivity.get(`${r.task_key} ${r.item_ref ?? ''} ${r.phase}`) !== 'practice',
      itemId: r.item_ref as string,
      phase: r.phase as PracticePhase,
      // hint 도 독립이 아니다 — 「지금 내 상태」 판단에서 viewed_first 와 같이 뺀다(보수적)
      helpLevel: (independent(r) ? 'independent' : 'viewed_first') as HelpLevel,
      claimHit: typeof (r.response?.grade as Record<string, unknown> | undefined)?.claim === 'boolean' ? ((r.response!.grade as Record<string, boolean>).claim) : null,
      answeredAt: r.answered_at,
    }))
}

export class PracticeInputError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message)
  }
}

async function answerOf(db: SupabaseClient, itemId: string): Promise<number | null> {
  const { data, error } = await db.from('csat_items_public').select('answer').eq('id', itemId).maybeSingle()
  if (error) throw new Error(`정답 읽기 실패: ${error.message}`)
  const a = (data as { answer?: unknown } | null)?.answer
  return typeof a === 'number' ? a : null
}

export interface SubmitDeps {
  db: SupabaseClient
  writer: AttemptWriter
  pool: (opts: { preview: boolean }) => Promise<ServerEntry[]>
  answer: (itemId: string) => Promise<number | null>
}

export function defaultSubmitDeps(): SubmitDeps {
  const db = admin()
  return { db, writer: selectWriter(db), pool: (o) => serverPool(o, db), answer: (id) => answerOf(db, id) }
}

/** 복습 예약 간격(일) — 닫힌 목록. 화면 버튼과 같다 */
export const REVIEW_DAYS = [1, 3, 7] as const

/**
 * E11 복습 예약 — 판단을 낸 Practice 세션을 마치고(finished) 다시 볼 날(review_at)을 남긴다(G2 learning_session_apply).
 * 학습 지도가 이 예약을 읽어 날짜가 되면 「다시 보기」(문항 확인 과제 = 재평가)를 띄운다.
 * 같은 세션 · 같은 날짜의 재전송은 같은 mutation(duplicate). 예약은 먼저 정한 값이 남는다(review_at = coalesce).
 * 마친 시각 finishedAt 은 화면이 첫 예약 때 정해 재전송에도 그대로 보낸다 — 같은 mutation 의 payload 가 재시도마다 같아야 duplicate(Codex P1).
 */
export async function schedulePracticeReview(
  deps: SubmitDeps,
  who: { userId: string; synthetic: boolean },
  r: { itemId: string; clientSessionId: string; days: number; finishedAt: string; preview: boolean },
): Promise<{ reviewAt: string; outcome: 'applied' | 'duplicate' }> {
  if (!(REVIEW_DAYS as readonly number[]).includes(r.days)) throw new PracticeInputError('예약 간격을 다시 골라 주세요')
  const entry = (await deps.pool({ preview: r.preview })).find((p) => p.itemId === r.itemId)
  if (!entry) throw new PracticeInputError('이 문항에는 지금 연습 과제가 없어요', 404)
  const at = r.finishedAt
  const reviewAt = new Date(Date.parse(r.finishedAt) + r.days * 86_400_000).toISOString().slice(0, 10) + 'T00:00:00.000Z'
  const { data, error } = await deps.db.rpc('learning_session_apply', {
    p_user: who.userId,
    p_mutation: stableUuid(r.clientSessionId, 'review', reviewAt),
    p_client_session_id: r.clientSessionId,
    p_activity: 'practice',
    p_phase: entry.phase,
    p_item_ref: r.itemId,
    p_stage: 'finished',
    p_step: 1,
    p_steps: 1,
    p_help_level: null,
    p_at: at,
    p_review_at: reviewAt,
    p_synthetic: who.synthetic || r.preview,
    p_task_key: entry.kind === 'annotated' ? PRACTICE_TASK : SKELETON_TASK,
    p_application_id: entry.applicationId,
  })
  if (error) throw new Error(`복습 예약 실패: ${error.message}`)
  const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string } | null
  if (row?.outcome === 'conflict') throw new PracticeInputError('이미 다른 날짜로 예약했어요', 409)
  if (row?.outcome !== 'applied' && row?.outcome !== 'duplicate') throw new Error(`복습 예약 실패: ${String(row?.outcome)}`)
  return { reviewAt, outcome: row.outcome }
}

/**
 * 판단 **전** 해설 열람 한 건(시도가 아니다) — 세션을 viewed_first 로 공개하고 열람 시각을 남긴다(별도 mutation · B8).
 * 같은 열람의 재전송은 같은 id(세션 · 열람 시각)라 duplicate. 직접 쓰기(롤백)에서는 남길 곳이 없어 false.
 */
export async function notePracticeView(
  deps: SubmitDeps,
  who: { userId: string; synthetic: boolean },
  v: { itemId: string; clientSessionId: string; viewedAt: string; preview: boolean },
): Promise<boolean> {
  const entry = (await deps.pool({ preview: v.preview })).find((p) => p.itemId === v.itemId)
  if (!entry) throw new PracticeInputError('이 문항에는 지금 연습 과제가 없어요', 404)
  return deps.writer.noteExplanationView({
    userId: who.userId,
    taskKey: entry.kind === 'annotated' ? PRACTICE_TASK : SKELETON_TASK,
    applicationId: entry.applicationId,
    itemRef: v.itemId,
    contentHash: entry.contentHash,
    activity: 'practice',
    phase: entry.phase,
    helpLevel: 'viewed_first',
    synthetic: who.synthetic || v.preview,
    clientMutationId: v.clientSessionId,
    clientSessionId: v.clientSessionId,
    answeredAt: v.viewedAt,
    sec: null,
    isCorrect: false,
    answer: {},
    extra: {},
  }, v.viewedAt, null)
}

/**
 * 제출 한 건. 순서가 계약이다: 검사 → 채점 → 세션 공개(reveal) → 시도 기록 → **그 뒤에** 정답 키를 담은 판정을 만든다.
 * preview 는 관리자 확인을 마친 라우트만 true 로 넘긴다. synthetic = 미리보기 또는 합성 계정.
 */
export async function submitPractice(
  deps: SubmitDeps,
  who: { userId: string; synthetic: boolean },
  s: PracticeSubmission,
): Promise<{ outcome: 'inserted' | 'duplicate'; feedback: PracticeFeedback }> {
  const entry = (await deps.pool({ preview: s.preview })).find((p) => p.itemId === s.itemId)
  if (!entry) throw new PracticeInputError('이 문항에는 지금 연습 과제가 없어요', 404)
  const rangeErr = checkAnswerRange(entry.key, s)
  if (rangeErr) throw new PracticeInputError(rangeErr)
  const grade = gradePractice(gradeClaimSupport, entry.key, s)
  const correct = await deps.answer(s.itemId)
  const optionCorrect = s.option === null || correct === null ? null : s.option === correct
  const write = {
    userId: who.userId,
    taskKey: entry.kind === 'annotated' ? PRACTICE_TASK : SKELETON_TASK,
    applicationId: entry.applicationId,
    itemRef: s.itemId,
    contentHash: entry.contentHash,
    activity: 'practice' as const,
    phase: entry.phase,
    helpLevel: s.helpLevel,
    synthetic: who.synthetic || s.preview,
    clientMutationId: s.clientMutationId,
    clientSessionId: s.clientSessionId,
    answeredAt: s.answeredAt,
    sec: s.sec,
    isCorrect: grade.isCorrect,
    answer: { claim: s.claim, support: s.support, relation: s.relation, option: s.option, confidence: s.confidence },
    extra: {
      preview: s.preview,
      pool: entry.kind,
      annotation: entry.kind === 'annotated' ? annotationFor(s.itemId)?.version ?? null : null,
      appVersion: entry.appVersion,
      grade: { claim: grade.claimHit, support: grade.supportOk, relation: grade.relationOk, option: optionCorrect },
    },
  }
  const sessionId = await deps.writer.reveal(write)
  const outcome = await deps.writer.record(write, sessionId)
  // 해설 열람은 시도 payload 밖의 별도 행동 — 재전송 payload 가 첫 제출과 같게 남는다
  if (outcome !== 'conflict' && s.explanationViewedAt) await deps.writer.noteExplanationView(write, s.explanationViewedAt, sessionId)
  if (outcome === 'conflict') throw new PracticeInputError('같은 제출 id 로 다른 답이 왔어요 — 화면을 새로 고쳐 주세요', 409)
  return { outcome, feedback: practiceFeedback(entry.key, grade, optionCorrect, entry.phase, s.helpLevel) }
}
