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
    const { count: keyCount, error: ke } = await c.from('csat_dx_answer_key').select('no', { count: 'exact', head: true }).eq('exam_id', examId)
    if (ke) return { ok: false, error: ke.message }
    if (keyCount !== 45) return { ok: false, error: `정답표가 45문항이 아니다(${keyCount ?? '?'})` }
    const { data: items, error: ie } = await c.from('csat_items').select('id').eq('exam_id', examId)
    if (ie) return { ok: false, error: ie.message }
    const ids = (items ?? []).map((i) => i.id as string)
    if (ids.length === 0) return { ok: false, error: '문항이 없다' }
    const { data: reviewed, error: re } = await c.from('csat_dx_item_attribute').select('item_id')
      .in('item_id', ids).eq('attribute_code', 'A1').not('reviewed_at', 'is', null)
    if (re) return { ok: false, error: re.message }
    const missing = ids.length - new Set((reviewed ?? []).map((r) => r.item_id)).size
    if (missing > 0) return { ok: false, error: `검수 안 된 문항 ${missing}개 — 태깅을 먼저 끝낸다` }
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

/** 문항 하나 검수 저장 — 역량 9개를 모두 쓰고(0 포함) reviewed_at 을 찍는다 */
export async function saveItemTaggingAction(input: ItemTaggingInput): Promise<ActionResult> {
  await requireAdmin(`${BASE}/exams`)
  if (!rate(input.errorRate)) return { ok: false, error: '오답률은 0~1 사이' }
  for (const c of ATTRIBUTE_CODES) {
    const w = input.weights[c]
    if (![0, 1, 2].includes(w)) return { ok: false, error: `${c} 가중치는 0·1·2` }
  }
  const c = db()
  const by = await adminId()
  const now = new Date().toISOString()
  const { data: item, error: ie } = await c.from('csat_items').select('id, answer, answers').eq('id', input.itemId).maybeSingle()
  if (ie || !item) return { ok: false, error: ie?.message ?? '없는 문항' }
  const correct = new Set(((item.answers as number[] | null)?.length ? item.answers : [item.answer]) as number[])

  const { error: ue } = await c.from('csat_items').update({ official_error_rate: input.errorRate, ebs_linked: input.ebsLinked }).eq('id', input.itemId)
  if (ue) return { ok: false, error: ue.message }

  const attrRows = ATTRIBUTE_CODES.map((code) => ({
    item_id: input.itemId, attribute_code: code, weight: input.weights[code], source: 'admin', reviewed_at: now, reviewed_by: by,
  }))
  const { error: ae } = await c.from('csat_dx_item_attribute').upsert(attrRows, { onConflict: 'item_id,attribute_code' })
  if (ae) return { ok: false, error: ae.message }

  const set: { item_id: string; option_no: number; trap_key: string; source: string; reviewed_at: string; reviewed_by: string | null }[] = []
  const clear: number[] = []
  for (let n = 1; n <= 5; n++) {
    const key = input.traps[n]
    if (correct.has(n) || !key) clear.push(n)
    else set.push({ item_id: input.itemId, option_no: n, trap_key: key, source: 'admin', reviewed_at: now, reviewed_by: by })
  }
  if (set.length) {
    const { error } = await c.from('csat_dx_option_trap').upsert(set, { onConflict: 'item_id,option_no' })
    if (error) return { ok: false, error: error.message }
  }
  if (clear.length) {
    const { error } = await c.from('csat_dx_option_trap').delete().eq('item_id', input.itemId).in('option_no', clear)
    if (error) return { ok: false, error: error.message }
  }
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

/** 설정 저장 — 새 버전 행을 더하고 그것을 활성으로. 실패하면 이전 활성으로 되돌린다 */
export async function saveSettingsAction(json: string, note: string): Promise<ActionResult & { errors?: string[] }> {
  await requireAdmin(`${BASE}/settings`)
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'JSON 형식이 아니다' }
  }
  const c = db()
  const { data: keys, error: ke } = await c.from('csat_dx_answer_key').select('exam_id').eq('no', 1)
  if (ke) return { ok: false, error: ke.message }
  const errors = validateSettings(parsed, new Set((keys ?? []).map((k) => k.exam_id as string)))
  if (errors.length) return { ok: false, error: '설정 검사 실패', errors }

  const { data: prev } = await c.from('csat_dx_settings').select('id').eq('active', true).maybeSingle()
  const { data: created, error: ie } = await c.from('csat_dx_settings')
    .insert({ settings: parsed, active: false, note: note.trim() || null, created_by: await adminId() }).select('id').single()
  if (ie) return { ok: false, error: ie.message }
  if (prev) {
    const { error } = await c.from('csat_dx_settings').update({ active: false }).eq('id', prev.id)
    if (error) return { ok: false, error: error.message }
  }
  const { error: ae } = await c.from('csat_dx_settings').update({ active: true }).eq('id', created.id)
  if (ae) {
    if (prev) await c.from('csat_dx_settings').update({ active: true }).eq('id', prev.id)
    return { ok: false, error: `활성화 실패(이전 설정으로 되돌림): ${ae.message}` }
  }
  revalidatePath(`${BASE}/settings`)
  return { ok: true }
}
