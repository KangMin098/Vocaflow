// apps/web/src/app/admin/compose/actions.ts
// ACP §20 재저작 콘솔 — 서버 액션 (피드 등록 · 취재 묶음 · 발주 큐).
//
// 권한은 RLS 가 본다(article_compose_* 정책 = is_admin_or_curator). 요청 스코프 클라이언트를
// 쓰므로 서비스 키로 우회하지 않는다 — 관리자가 아니면 INSERT 가 정책에서 막힌다.
//
// 검증은 화면이 아니라 **레지스트리**가 한다. buildJobSpec 이 유형·레벨·글유형·어휘기능의
// 정합을 이미 판정하므로 여기서 규칙을 다시 적지 않는다(적으면 두 벌이 갈린다).

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FACT_SOURCES,
  buildJobSpec,
  type LearningTrack,
  type LexicalSkill,
  type Register,
} from '@vocaflow/library-pipeline'

import { createClient } from '@/lib/supabase/server'

export interface ActionResult {
  ok: boolean
  error?: string
}

const PATH = '/admin/compose'

async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient
}

// ── 피드 ─────────────────────────────────────────────────────────────

/**
 * 피드 등록. **항상 꺼진 상태로 들어온다** — 등록과 수집 시작은 다른 결정이고,
 * 주소를 붙여 넣자마자 외부 요청이 나가면 되돌릴 수 없다.
 */
export async function addFeed(input: {
  sourceKey: string
  url: string
  label: string
}): Promise<ActionResult> {
  const spec = FACT_SOURCES[input.sourceKey]
  if (!spec) return { ok: false, error: `알 수 없는 소스 키: ${input.sourceKey}` }
  if (!spec.access.termsReviewed) {
    return { ok: false, error: `${spec.publisher}: 이용약관 확인 전에는 등록하지 않습니다` }
  }

  let parsed: URL
  try {
    parsed = new URL(input.url)
  } catch {
    return { ok: false, error: '피드 주소 형식이 올바르지 않습니다' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'https 주소만 등록합니다' }
  }
  // 발행사와 다른 호스트를 등록하면 그 소스의 접근 정책·계통 표시가 거짓이 된다.
  if (!parsed.host.toLowerCase().endsWith(spec.publisher.toLowerCase())) {
    return {
      ok: false,
      error: `${spec.publisher} 의 피드가 아닙니다 (입력 호스트: ${parsed.host})`,
    }
  }
  const label = input.label.trim()
  if (label.length < 2) return { ok: false, error: '피드 이름을 2자 이상 적어 주세요' }

  const { error } = await (await db())
    .from('article_compose_feeds')
    .insert({ source_key: spec.key, url: parsed.toString(), label, enabled: false })

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 등록된 피드 주소입니다' }
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

/** 활성/비활성. 켜는 순간부터 다음 수집에 포함된다. */
export async function setFeedEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  const { error } = await (await db())
    .from('article_compose_feeds')
    .update({ enabled })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteFeed(id: string): Promise<ActionResult> {
  const { error } = await (await db()).from('article_compose_feeds').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

// ── 취재 묶음 ────────────────────────────────────────────────────────

/**
 * 취재 묶음 수동 개설.
 *
 * ③ 발견이 생기기 전까지의 경로다. 사건 시각은 I15(48시간)의 재료이므로
 * **비워 두지 않는다** — 비면 게이트가 "검증 불가" 로 차단한다.
 */
export async function createBatch(input: {
  topic: string
  eventOccurredAt: string | null
}): Promise<ActionResult & { id?: string }> {
  const topic = input.topic.trim()
  if (topic.length < 4) return { ok: false, error: '사건/주제를 4자 이상 적어 주세요' }

  let occurred: string | null = null
  if (input.eventOccurredAt) {
    const t = Date.parse(input.eventOccurredAt)
    if (Number.isNaN(t)) return { ok: false, error: '사건 시각을 읽을 수 없습니다' }
    if (t > Date.now()) return { ok: false, error: '사건 시각이 미래입니다' }
    occurred = new Date(t).toISOString()
  }

  const { data, error } = await (await db())
    .from('article_compose_batches')
    .insert({ topic, event_occurred_at: occurred, status: 'collecting' })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true, id: (data as { id: string }).id }
}

// ── 발주 ─────────────────────────────────────────────────────────────

/**
 * 발주 생성. 사양은 레지스트리(buildJobSpec)가 채운다 — 화면이 길이·문장길이·지시를
 * 직접 적지 않는다. 그래야 유형 정의를 고치면 이후 발주가 자동으로 따라온다.
 */
export async function createComposeJob(input: {
  batchId: string
  track: LearningTrack
  targetVLevel: number
  register?: Register
  skillFocus?: LexicalSkill
}): Promise<ActionResult> {
  const spec = buildJobSpec(input.track, input.targetVLevel, {
    register: input.register,
    skillFocus: input.skillFocus,
  })
  if ('error' in spec) return { ok: false, error: spec.error }

  const { error } = await (await db()).from('article_compose_jobs').insert({
    batch_id: input.batchId,
    track: spec.track,
    register: spec.register,
    target_v_level: spec.targetVLevel,
    skill_focus: spec.skillFocus,
    words_min: spec.words.min,
    words_max: spec.words.max,
    avg_sentence_words: spec.avgSentenceWords,
    directives: [...spec.directives],
    activities: [...spec.activities],
  })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: '이 취재 묶음에 같은 유형·레벨 발주가 이미 있습니다' }
    }
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

/** 대기 중인 발주만 취소한다 — 진행 중이면 드레인 세션이 이미 비용을 쓰고 있다. */
export async function deleteComposeJob(id: string): Promise<ActionResult> {
  const { error } = await (await db())
    .from('article_compose_jobs')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

/**
 * 진행 중 발주를 대기로 되돌린다 — 드레인 세션이 죽어 30분을 기다리기 싫을 때.
 * 살아 있는 세션의 작업을 되돌리면 같은 발주를 둘이 쓰게 되므로 확인하고 쓴다.
 */
export async function releaseComposeJob(id: string): Promise<ActionResult> {
  const { error } = await (await db())
    .from('article_compose_jobs')
    .update({ status: 'pending', claimed_by: null, claimed_at: null })
    .eq('id', id)
    .eq('status', 'claimed')
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}
