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

import { annotationFor, annotationHash, gradeClaimSupport } from './claim-support'
import {
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
import { selectWriter, type AttemptWriter } from './practice-writer'
import { currentAnnotation, itemTaskRef, loadLiveApplication } from './product-server'

/** 정본 주석이 있는 문항 — claim-support.ts 의 ANNOTATIONS 와 같은 목록(시험이 대조한다) */
export const ANNOTATED_ITEM_IDS = ['2022#20'] as const

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
        const ann = currentAnnotation(s.id)
        if (!ann) continue
        const live = await loadLiveApplication('csat_item_task', itemTaskRef(s.id), client)
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
    .select('item_ref, phase, answered_at, response')
    .eq('user_id', userId)
    .in('task_key', [PRACTICE_TASK, SKELETON_TASK])
    .order('answered_at')
    .limit(1000)
  if (error) throw new Error(`내 기록 읽기 실패: ${error.message}`)
  return ((data ?? []) as { item_ref: string | null; phase: string; answered_at: string; response: Record<string, unknown> | null }[])
    .filter((r) => r.response?.activity === 'practice' && (r.response?.preview === true) === opts.preview)
    .filter((r) => r.item_ref && (r.phase === 'practice' || r.phase === 'transfer'))
    .map((r) => ({
      itemId: r.item_ref as string,
      phase: r.phase as PracticePhase,
      helpLevel: (r.response?.help_level === 'viewed_first' ? 'viewed_first' : 'independent') as HelpLevel,
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
      explanation_viewed_at: s.explanationViewedAt,
      pool: entry.kind,
      annotation: entry.kind === 'annotated' ? annotationFor(s.itemId)?.version ?? null : null,
      appVersion: entry.appVersion,
      grade: { claim: grade.claimHit, support: grade.supportOk, relation: grade.relationOk, option: optionCorrect },
    },
  }
  const sessionId = await deps.writer.reveal(write)
  const outcome = await deps.writer.record(write, sessionId)
  if (outcome === 'conflict') throw new PracticeInputError('같은 제출 id 로 다른 답이 왔어요 — 화면을 새로 고쳐 주세요', 409)
  return { outcome, feedback: practiceFeedback(entry.key, grade, optionCorrect, entry.phase, s.helpLevel) }
}
