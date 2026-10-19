// apps/web/src/lib/admin/application-attempts.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PAGE, readAllById } from '@/lib/knowledge/effect-signals-server'
import { itemRevealDecision } from '@/lib/csat/embargo-gate'

export interface ApplicationAttempt {
  id: number | string; user_id: string; synthetic: boolean | null; is_correct: boolean | null
  phase: string; response: { appVersion?: unknown } | null
}
export async function loadApplicationAttempts(db: SupabaseClient, applicationId: string): Promise<{ rows: ApplicationAttempt[]; heldCount: number }> {
  type Meta = Omit<ApplicationAttempt, 'is_correct' | 'response'> & { item_ref: string | null; app_version: unknown }
  const metadata = await readAllById<Meta>('적용 수행', async after => {
    // 응답 전체 대신 버전만 읽으며 정오는 문항별 관문 뒤에 조회한다.
    let query = db.from('learning_task_attempts').select('id,user_id,item_ref,synthetic,phase,app_version:response->appVersion')
      .eq('application_id', applicationId).order('id').limit(PAGE)
    if (after !== null) query = query.gt('id', after)
    const result = await query
    if (Array.isArray(result.data) && result.data.some(r => !Number.isSafeInteger(Number(r.id)))) return { data: null, error: { message: '수행 ID가 안전한 커서 범위를 벗어났습니다' } }
    return !result.error && !Array.isArray(result.data) ? { data: null, error: { message: '수행 응답이 배열이 아닙니다' } } : result
  })
  const gate = await itemRevealDecision(metadata.flatMap(r => r.item_ref ? [r.item_ref] : []), { db })
  if (gate.failed) throw new Error('적용 수행 보류 판정 실패')
  const visible = metadata.filter(r => !r.item_ref || !gate.held.has(r.item_ref))
  const known = visible.filter(r => r.item_ref)
  const correct = new Map<string, boolean | null>()
  for (let offset = 0; offset < known.length; offset += 100) {
    const batch = known.slice(offset, offset + 100)
    const expected = new Map(batch.map(r => [String(r.id), r.item_ref]))
    const result = await db.from('learning_task_attempts').select('id,item_ref,is_correct')
      .eq('application_id', applicationId).in('id', batch.map(r => String(r.id))).in('item_ref', [...new Set(batch.map(r => r.item_ref!))])
    if (result.error || !Array.isArray(result.data) || result.data.length !== batch.length) throw new Error('적용 수행 정오 조회 실패 또는 누락')
    for (const row of result.data as { id: number | string; item_ref: string; is_correct: boolean | null }[]) {
      if (!expected.has(String(row.id)) || expected.get(String(row.id)) !== row.item_ref || correct.has(String(row.id))) throw new Error('적용 수행 정오 결속 불일치')
      correct.set(String(row.id), row.is_correct)
    }
  }
  return {
    rows: visible.map(r => ({ id:r.id, user_id:r.user_id, synthetic:r.synthetic, phase:r.phase, response:r.app_version == null ? null : {appVersion:r.app_version}, is_correct:correct.get(String(r.id)) ?? null })),
    heldCount: metadata.length - visible.length,
  }
}
export function summarizeApplicationAttempts(rows: readonly ApplicationAttempt[], version: number) {
  const current = rows.filter(r => r.response?.appVersion === version)
  const other = rows.filter(r => Number.isSafeInteger(r.response?.appVersion) && (r.response!.appVersion as number) > 0 && r.response!.appVersion !== version)
  const known = current.length + other.length
  const nonSynthetic = current.filter(r => r.synthetic === false)
  return {
    current: current.length, other: other.length, unknown: rows.length - known,
    nonSynthetic: nonSynthetic.length, synthetic: current.filter(r => r.synthetic === true).length,
    syntheticUnknown: current.filter(r => r.synthetic !== true && r.synthetic !== false).length,
    accounts: new Set(nonSynthetic.map(r => r.user_id)).size,
    correct: nonSynthetic.filter(r => r.is_correct === true).length,
    phases: [...new Set(current.map(r => r.phase))].sort().map(phase => ({ phase, count: current.filter(r => r.phase === phase).length })),
  }
}
