// apps/web/src/lib/admin/application-attempts.ts
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PAGE, readAllById } from '@/lib/knowledge/effect-signals-server'

export interface ApplicationAttempt {
  id: number | string; user_id: string; synthetic: boolean | null; is_correct: boolean | null
  phase: string; response: { appVersion?: unknown } | null
}
export async function loadApplicationAttempts(db: SupabaseClient, applicationId: string): Promise<ApplicationAttempt[]> {
  return readAllById<ApplicationAttempt>('적용 수행', async after => {
    let query = db.from('learning_task_attempts').select('id,user_id,is_correct,synthetic,phase,response')
      .eq('application_id', applicationId).order('id').limit(PAGE)
    if (after !== null) query = query.gt('id', after)
    const result = await query
    if (Array.isArray(result.data) && result.data.some(r => !Number.isSafeInteger(Number(r.id)))) return { data: null, error: { message: '수행 ID가 안전한 커서 범위를 벗어났습니다' } }
    return !result.error && !Array.isArray(result.data) ? { data: null, error: { message: '수행 응답이 배열이 아닙니다' } } : result
  })
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
