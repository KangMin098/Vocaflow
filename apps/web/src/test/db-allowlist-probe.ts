// apps/web/src/test/db-allowlist-probe.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { allowMutatingSharedDbTests } from './shared-db-test-policy'

export async function probeDbEventAllowlist(db: SupabaseClient, events: readonly string[], runId: string, env: Readonly<Record<string, string | undefined>>): Promise<void> {
  if (!allowMutatingSharedDbTests(env)) throw new Error('공유 DB 쓰기 테스트는 승인된 명시적 로컬 실행만 허용합니다')
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(runId) || !events.length) throw new Error('검사 실행 ID와 이벤트가 필요합니다')
  const errors: string[] = []
  try {
    const result = await db.from('funnel_events').insert(events.map(event => ({ user_id: null, event, surface: 'selftest', meta: { selftest_run_id: runId } }))).select('id')
    if (result.error) throw new Error(`이벤트 일괄 검사 실패: ${result.error.message}`)
    if (!Array.isArray(result.data) || result.data.length !== events.length) throw new Error('이벤트 검사 응답 누락')
  } catch (error) {
    errors.push(error instanceof Error ? error.message : '이벤트 검사 실패')
  } finally {
    try {
      const cleanup = await db.from('funnel_events').delete().eq('surface', 'selftest').eq('meta->>selftest_run_id', runId)
      if (cleanup.error) throw new Error(`검사 실행 정리 실패: ${cleanup.error.message}`)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '검사 실행 정리 실패')
    }
  }
  if (errors.length) throw new Error(errors.join(' / '))
}
