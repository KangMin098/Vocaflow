// apps/web/src/app/admin/csat/diagnosis/actions.ts
//
// 진단 관리 화면의 쓰기. 모두 requireAdmin 뒤 service role 로 쓴다. 실패는 던지지 않고 결과로 돌려준다.
//
// 재실행 안전: 태깅 저장은 같은 값을 여러 번 저장해도 결과가 같다(upsert). 설정 저장은 매번 새 버전 행을 더한다.
// 되돌릴 수 없는 것: 없다 — 진단 반영 해제·설정 이전 버전 재활성으로 되돌린다.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { getAdminUser, requireAdmin } from '@/lib/auth/require-admin'
import { loadReadiness } from '@/lib/csat/diagnosis/admin'
import { validateSettings } from '@/lib/csat/diagnosis/engine/settings'
import { ATTRIBUTE_CODES, type AttributeCode } from '@/lib/csat/diagnosis/engine/types'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ActionResult {
  ok: boolean
  error?: string
}

const BASE = '/admin/csat/diagnosis'

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

/** reviewed_by·created_by 용 — 개발 우회 계정(0 uuid)은 auth.users 에 없어 FK 가 깨지므로 null */
async function adminId(): Promise<string | null> {
  const user = await getAdminUser()
  return user?.id && user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null
}

const rate = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1)

export async function saveExamStatsAction(examId: string, grade1Ratio: number | null, source: string): Promise<ActionResult> {
  await requireAdmin(`${BASE}/exams`)
  if (!rate(grade1Ratio)) return { ok: false, error: '1등급 비율은 0~1 사이(예: 0.0612)' }
  const { error } = await db().from('csat_exams')
    .update({ official_grade1_ratio: grade1Ratio, official_stats_source: source.trim() || null }).eq('id', examId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`${BASE}/exams`)
  return { ok: true }
}

/** 진단 반영 켜기 — 정답표 45문항 + 모든 문항 검수 완료일 때만. 끄기는 언제나 된다 */
export async function setExamReadyAction(examId: string, ready: boolean): Promise<ActionResult> {
  await requireAdmin(`${BASE}/exams`)
  const c = db()
  if (ready) {
    // 판정은 관리자 목록과 같은 함수 — 문항마다 역량 9개 검수(0 = 해당 없음 포함) · 정답표 45 · 문항 정답(readiness.ts)
    const r = (await loadReadiness(c, [examId])).get(examId)
    if (!r) return { ok: false, error: '없는 시험' }
    if (!r.canEnable) return { ok: false, error: r.reason }
  }
  const { error } = await c.from('csat_exams').update({ diagnosis_ready: ready }).eq('id', examId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`${BASE}/exams`)
  revalidatePath(BASE)
  return { ok: true }
}

export interface ItemTaggingInput {
  itemId: string
  weights: Record<AttributeCode, number>
  traps: Record<number, string | null>
  errorRate: number | null
  ebsLinked: boolean | null
}

/** 문항 하나 검수 저장 — 메타 · 역량 9개(0 포함) · 선지 함정 · 검수 표지를 한 트랜잭션(RPC)으로 */
export async function saveItemTaggingAction(input: ItemTaggingInput): Promise<ActionResult> {
  await requireAdmin(`${BASE}/exams`)
  if (!rate(input.errorRate)) return { ok: false, error: '오답률은 0~1 사이' }
  const bad = ATTRIBUTE_CODES.find((c) => ![0, 1, 2].includes(input.weights[c]))
  if (bad) return { ok: false, error: `${bad} 가중치는 0·1·2` }
  const { error } = await db().rpc('csat_dx_save_item_tagging', {
    p_item_id: input.itemId,
    p_weights: Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, input.weights[c]])),
    p_traps: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [String(n), input.traps[n] ?? null])),
    p_error_rate: input.errorRate,
    p_ebs: input.ebsLinked,
    p_by: await adminId(),
  })
  if (error) return { ok: false, error: `저장하지 못했다(아무것도 바뀌지 않았다): ${error.message}` }
  revalidatePath(`${BASE}/exams`)
  return { ok: true }
}

export async function setPoolItemAction(itemId: string, active: boolean | null): Promise<ActionResult> {
  await requireAdmin(`${BASE}/pool`)
  const c = db()
  if (!/^[A-Za-z0-9_]{1,16}#[0-9]{1,2}$/.test(itemId)) return { ok: false, error: '문항 id 형식은 2026#31' }
  if (active === null) {
    const { error } = await c.from('csat_dx_pool').delete().eq('item_id', itemId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { data: item } = await c.from('csat_items').select('id').eq('id', itemId).maybeSingle()
    if (!item) return { ok: false, error: '없는 문항' }
    const { error } = await c.from('csat_dx_pool').upsert({ item_id: itemId, active }, { onConflict: 'item_id' })
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath(`${BASE}/pool`)
  revalidatePath(BASE)
  return { ok: true }
}

/** 설정 저장 — 검사 후 새 버전을 활성으로 */
export async function saveSettingsAction(json: string, note: string): Promise<ActionResult & { errors?: string[] }> {
  await requireAdmin(`${BASE}/settings`)
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'JSON 형식이 아니다' }
  }
  const c = db()
  const known = await scorableExamIds(c)
  if (typeof known === 'string') return { ok: false, error: known }
  const errors = validateSettings(parsed, known)
  if (errors.length) return { ok: false, error: '설정 검사 실패', errors }
  return activateSettings(c, parsed, note)
}

/** 정답표가 있는 회차 id — 시나리오·기준 시험으로 고를 수 있는 것. 실패하면 오류 문자열 */
async function scorableExamIds(c: SupabaseClient): Promise<Set<string> | string> {
  const { data, error } = await c.from('csat_dx_answer_key').select('exam_id').eq('no', 1)
  if (error) return error.message
  return new Set((data ?? []).map((k) => k.exam_id as string))
}

/** 새 버전을 더하고 활성으로 바꾼다 — 끄기·넣기가 한 트랜잭션(RPC)이라 활성 설정이 비는 순간이 없다 */
async function activateSettings(c: SupabaseClient, parsed: unknown, note: string): Promise<ActionResult> {
  const { error } = await c.rpc('csat_dx_activate_settings', { p_settings: parsed, p_note: note, p_by: await adminId() })
  if (error) return { ok: false, error: `저장하지 못했다(이전 설정이 그대로 활성): ${error.message}` }
  revalidatePath(`${BASE}/settings`)
  return { ok: true }
}
