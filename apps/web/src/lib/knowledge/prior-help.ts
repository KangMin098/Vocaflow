// apps/web/src/lib/knowledge/prior-help.ts
//
// 같은 문항의 **앞선 도움 · 해설 열람**을 서버 기록에서 확인한다 — Practice 와 문항 확인 과제가 같이 쓴다(Codex P1 · 2026-10-09).
// 화면은 새로고침 · 문항 재선택 · 다른 기기마다 새 세션을 independent 로 시작하므로, 독립 판정은 서버가 이어 붙인다.
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 같은 문항 · 다른 세션에 도움 노출(hint · viewed_first)이나 해설 열람이 **이미 서버에 있나**(Codex P1).
 * 화면은 새로고침 · 문항 재선택마다 새 세션을 independent 로 시작하므로, 앞선 해설 열람을 서버가 이어 붙인다.
 * 기기 시각은 비교하지 않는다 — 다른 기기 시계가 앞서면 시각 비교가 앞선 열람을 놓친다. 정답 · 해설을 본 뒤의 판단은 독립이 아니다(보수적).
 */
export async function priorHelpOf(db: SupabaseClient, userId: string, itemId: string, clientMutationId: string, clientSessionId: string): Promise<boolean> {
  // 이미 저장된 제출의 재전송이면 그때 정한 도움 수준을 그대로 — 사이에 다른 세션 열람이 생겨도 재전송 원문이 바뀌지 않게(Codex P1)
  const prior = await db.from('learning_task_attempts').select('help_level').eq('user_id', userId).eq('client_mutation_id', clientMutationId).maybeSingle()
  if (!prior.error && prior.data) return (prior.data as { help_level: string | null }).help_level !== 'independent'
  const { data, error } = await db.from('learning_sessions').select('id')
    .eq('user_id', userId).eq('item_ref', itemId).neq('client_session_id', clientSessionId)
    .or('help_level.in.(hint,viewed_first),explanation_viewed_at.not.is.null')
    .limit(1)
  // 확인을 못 하면 보수적으로 도움받은 것으로 본다 — 독립 표본을 부풀리지 않는다
  if (error) return true
  return (data ?? []).length > 0
}

