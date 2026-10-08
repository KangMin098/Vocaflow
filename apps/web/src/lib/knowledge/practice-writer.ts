// apps/web/src/lib/knowledge/practice-writer.ts
// 수행 기록의 **쓰기 어댑터 하나** — /csat/practice 와 문항 확인 과제(/api/csat/item/[slug]/task)가 같이 쓴다. 호출자는 이 인터페이스만 안다.
//   g2(기본 · G2 20261008160000 개발 DB 적용 뒤) = learning_session_apply(공개) → learning_attempt_record RPC · 해설 열람은 별도 공개 변경.
//   direct(되돌림용)                               = 정본 learning_task_attempts 에 직접 INSERT(세션 · 멱등 인덱스 없이). 세션 표가 없어 reveal 은 기록하지 않는다.
// 고르는 것: 환경 변수 PRACTICE_ATTEMPT_WRITER=direct 일 때만 direct. 그 밖은 g2(배포 순서 ③ · G2_INTEGRATED_SQL §6).
//
// 요청 멱등(G2 §2): 같은 (user, client_mutation_id) 가 다시 오면 duplicate, 의미 필드가 다르면 conflict(덮어쓰지 않는다).
//   direct 는 유일 키가 없어 response->>client_mutation_id 를 먼저 읽고 넣는다 — 동시에 도착한 두 요청 사이의 틈은 남는다
//   (화면이 제출 중 잠금으로 막고, 남은 틈은 G2 의 유일 인덱스가 닫는다). 이 한계는 docs/csat-learner/PRACTICE_PORT.md §4.
// 비교는 칸마다 한다 — jsonb 를 JSON.stringify 로 비교하지 않는다(DB 가 키 순서를 바꾼다).
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { HelpLevel, PracticePhase } from './practice'

export interface AttemptWrite {
  userId: string
  taskKey: string
  applicationId: string | null
  itemRef: string
  contentHash: string
  /** 학습 활동 — practice(원리 연습) · theater(기출 문항 화면의 확인 과제) */
  activity: 'practice' | 'theater'
  phase: PracticePhase
  helpLevel: HelpLevel
  synthetic: boolean
  clientMutationId: string
  clientSessionId: string
  answeredAt: string
  sec: number | null
  isCorrect: boolean
  /** 학습자 응답(정답 키 아님) — 과제마다 모양이 다르다(주장과 근거 · 이어 주는 단서 …) */
  answer: Record<string, unknown>
  extra: Record<string, unknown>
}

export type WriteOutcome = 'inserted' | 'duplicate' | 'conflict'

export interface AttemptWriter {
  readonly kind: 'direct' | 'g2'
  /** 판단 제출 전에 세션 공개를 먼저 적용한다(G2 RPC 규칙). 세션 id 를 돌려준다 — direct 는 null */
  reveal(w: AttemptWrite): Promise<string | null>
  record(w: AttemptWrite, sessionId: string | null): Promise<WriteOutcome>
  /**
   * 판단을 보낸 뒤의 해설 열람 — **시도와 별개인 행동**. 시도 payload 에 넣으면 같은 제출의 재전송이 첫 제출과 달라져
   * G2 멱등 비교에서 conflict 가 된다(REVERIFY_17bb7c93f §P1-2). g2 는 세션의 explanation_viewed_at 에 별도 mutation 으로 쓰고
   * (실패는 예외 — 조용히 넘기지 않는다), direct 는 담을 곳이 없어 false(미저장)를 돌려준다
   */
  noteExplanationView(w: AttemptWrite, viewedAt: string, sessionId: string | null): Promise<boolean>
}

/** 결정론적 uuid — 같은 세션의 공개 변경은 재시도해도 같은 id(G2 §7 백필 키와 같은 방식) */
export function stableUuid(...parts: string[]): string {
  const h = createHash('sha256').update(parts.join('\u0000')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** 응답 칸 비교 — 원시값 · 배열 · 평면 객체(jsonb 는 키 순서를 바꾸므로 문자열 비교 금지). null · undefined 는 같게 본다 */
function sameValue(a: unknown, b: unknown): boolean {
  if ((a ?? null) === null || (b ?? null) === null) return (a ?? null) === (b ?? null)
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]))
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    return ka.length === kb.length && ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return a === b
}

/** 저장된 response 와 새 요청의 의미 필드가 같은가 */
export function sameAttempt(row: { item_ref: unknown; phase: unknown; task_key: unknown; answered_at: unknown; response: unknown }, w: AttemptWrite): boolean {
  const r = (row.response ?? {}) as Record<string, unknown>
  return (
    row.item_ref === w.itemRef &&
    row.phase === w.phase &&
    row.task_key === w.taskKey &&
    typeof row.answered_at === 'string' &&
    Date.parse(row.answered_at) === Date.parse(w.answeredAt) &&
    r.client_session_id === w.clientSessionId &&
    r.help_level === w.helpLevel &&
    Object.keys(w.answer).every((k) => sameValue(r[k], w.answer[k]))
  )
}

/** 두 어댑터가 같은 모양으로 남기는 response — G2 열(activity · help_level · client ids)의 사본을 담는다 */
export function responseOf(w: AttemptWrite): Record<string, unknown> {
  return {
    ...w.answer,
    ...w.extra,
    activity: w.activity,
    help_level: w.helpLevel,
    client_mutation_id: w.clientMutationId,
    client_session_id: w.clientSessionId,
  }
}

export function directWriter(db: SupabaseClient): AttemptWriter {
  return {
    kind: 'direct',
    async reveal() {
      return null
    },
    async noteExplanationView() {
      return false
    },
    async record(w) {
      const { data: prior, error: readErr } = await db
        .from('learning_task_attempts')
        .select('item_ref, phase, task_key, answered_at, response')
        .eq('user_id', w.userId)
        .eq('response->>client_mutation_id', w.clientMutationId)
        .limit(1)
      if (readErr) throw new Error(`이전 제출 확인 실패: ${readErr.message}`)
      if (prior && prior.length > 0) return sameAttempt(prior[0] as never, w) ? 'duplicate' : 'conflict'
      const { error } = await db.from('learning_task_attempts').insert({
        user_id: w.userId,
        task_key: w.taskKey,
        application_id: w.applicationId,
        item_ref: w.itemRef,
        content_hash: w.contentHash,
        phase: w.phase,
        synthetic: w.synthetic,
        is_correct: w.isCorrect,
        sec: w.sec,
        answered_at: w.answeredAt,
        // G2 열(activity · help_level · client_mutation_id · session)이 생기기 전까지는 response 안에 둔다 — 이전 때 그대로 옮긴다
        response: responseOf(w),
      })
      if (error) throw new Error(`수행 기록 저장 실패: ${error.message}`)
      return 'inserted'
    },
  }
}

/** G2 통합 SQL(sha256 779eb9bb…) 적용 뒤에만 — 함수 시그니처는 그 초안 그대로 */
export function g2Writer(db: SupabaseClient): AttemptWriter {
  return {
    kind: 'g2',
    async reveal(w) {
      // 이미 기록된 판단(같은 제출 id)의 재전송이면 세션을 건드리지 않는다 — 같은 id 로 도움 수준만 바꾼 요청이
      // 세션을 먼저 바꾼 뒤 시도에서 conflict 로 거부되면, 거부된 요청이 앞선 독립 판단을 비독립으로 오염시킨다(Codex P1).
      // 시도 RPC 가 원문 비교로 duplicate / conflict 를 정한다
      const prior = await db.from('learning_task_attempts').select('session_id')
        .eq('user_id', w.userId).eq('client_mutation_id', w.clientMutationId).maybeSingle()
      if (prior.error) throw new Error(`세션 공개 실패: ${prior.error.message}`)
      if (prior.data) return (prior.data as { session_id: string | null }).session_id
      const { data, error } = await db.rpc('learning_session_apply', {
        p_user: w.userId,
        // 공개 id = 세션 · 도움 수준 · 판단 시각 — 같은 판단의 재전송만 같은 id. 해설을 본 뒤의 새 판단(도움 상승)은 새 공개로
        // 적용돼 세션 도움 수준 · 첫 노출 시각이 오른다(같은 id 로 묶으면 conflict 가 무시돼 도움받은 판단이 독립으로 남는다 — Codex P1)
        p_mutation: stableUuid(w.clientSessionId, 'reveal', w.helpLevel, w.answeredAt),
        p_client_session_id: w.clientSessionId,
        p_activity: w.activity,
        p_phase: w.phase,
        p_item_ref: w.itemRef,
        p_stage: 'revealed',
        p_step: 0,
        p_steps: 1,
        p_help_level: w.helpLevel,
        p_at: w.answeredAt,
        p_synthetic: w.synthetic,
        p_task_key: w.taskKey,
        p_application_id: w.applicationId,
      })
      if (error) throw new Error(`세션 공개 실패: ${error.message}`)
      const row = (Array.isArray(data) ? data[0] : data) as { session_id?: string; outcome?: string } | null
      if (!row?.session_id) throw new Error('세션 공개 실패: 세션 id 가 없다')
      // conflict = 같은 판단의 공개인데 다른 내용(대상 · 단계 등) — 무시하고 시도를 기록하면 세션 값을 잘못 상속한다
      if (row.outcome !== 'applied' && row.outcome !== 'duplicate') throw new Error(`세션 공개 실패: ${String(row.outcome)}`)
      return row.session_id
    },
    async noteExplanationView(w, viewedAt) {
      // B8 — 판단과 **다른** mutation id. 같은 열람(같은 세션 · 같은 시각)의 재전송만 같은 id 를 쓴다(공개 · 판단 id 재사용 금지 —
      // 재사용하면 payload 가 달라 conflict 로 조용히 유실된다: G2_SQL_REVIEW_da627938 (b)). 해설 시각은 서버가 가장 이른 값을 지킨다.
      const { data, error } = await db.rpc('learning_session_apply', {
        p_user: w.userId,
        p_mutation: stableUuid(w.clientSessionId, 'explain', viewedAt),
        p_client_session_id: w.clientSessionId,
        p_activity: w.activity,
        p_phase: w.phase,
        p_item_ref: w.itemRef,
        p_stage: 'revealed',
        p_step: 0,
        p_steps: 1,
        p_help_level: w.helpLevel,
        p_at: viewedAt,
        p_synthetic: w.synthetic,
        p_task_key: w.taskKey,
        p_application_id: w.applicationId,
        p_explanation_viewed_at: viewedAt,
      })
      if (error) throw new Error(`해설 열람 기록 실패: ${error.message}`)
      const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string } | null
      // conflict = 같은 id 에 다른 내용 — 조용히 넘기지 않는다(저장 실패를 숨기지 않는다)
      if (row?.outcome !== 'applied' && row?.outcome !== 'duplicate') throw new Error(`해설 열람 기록 실패: ${String(row?.outcome)}`)
      return true
    },
    async record(w, sessionId) {
      const { data, error } = await db.rpc('learning_attempt_record', {
        p_user: w.userId,
        p_mutation: w.clientMutationId,
        p_session_id: sessionId,
        p_task_key: w.taskKey,
        p_activity: w.activity,
        p_phase: w.phase,
        // 보내지 않는다(NULL → 세션 상속). 세션과 다른 값을 보내면 RPC 가 「metadata contradicts session」 으로 영구 거부한다
        p_help_level: null,
        p_item_ref: w.itemRef,
        p_content_hash: w.contentHash,
        // 열과 같은 값을 response 에도 둔다 — 「내 기록」 읽기가 direct · g2 어느 쪽 기록이든 같은 칸으로 읽게(PRACTICE_PORT §4)
        p_response: responseOf(w),
        p_is_correct: w.isCorrect,
        p_sec: w.sec,
        p_synthetic: w.synthetic,
        p_application_id: w.applicationId,
        p_answered_at: w.answeredAt,
      })
      if (error) throw new Error(`수행 기록 저장 실패: ${error.message}`)
      const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string } | null
      const o = row?.outcome
      if (o !== 'inserted' && o !== 'duplicate' && o !== 'conflict') throw new Error(`수행 기록 저장 실패: 알 수 없는 결과 ${String(o)}`)
      return o
    },
  }
}

export function selectWriter(db: SupabaseClient, env: string | undefined = process.env.PRACTICE_ATTEMPT_WRITER): AttemptWriter {
  // G2 SQL(20261008160000)이 개발 DB 에 적용됐다 — 기본은 g2(배포 순서 ③). direct 는 되돌림용으로만 남긴다
  return env === 'direct' ? directWriter(db) : g2Writer(db)
}
