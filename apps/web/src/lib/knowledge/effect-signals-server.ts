// apps/web/src/lib/knowledge/effect-signals-server.ts
// 트랙 E 서버 로더 — 적용 · 검증 계획 · 첫 시도 뷰를 **읽기만** 해서 적용별 재검토 신호를 만든다. requireAdmin 뒤에서만(service_role).
// 쓰지 않는다: 항목 상태 · efficacy · trial · 적용 상태 모두 그대로. 재검토는 관리자가 항목 화면에서 연다.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeSignals, type FirstAttempt, type Phase, type SignalResult } from './effect-signals'

const LIMIT = 1000
const ID_CHUNK = 200
type Row = Record<string, unknown>

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

async function read(what: string, q: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>): Promise<Row[]> {
  const { data, error } = await q
  if (error) throw new Error(`${what} 읽기 실패 (${error.code ?? 'unknown'}: ${error.message ?? ''})`)
  const rows = (data ?? []) as Row[]
  // 상한에 닿으면 뒤쪽이 조용히 잘린다 — 숫자를 지어내지 않고 멈춘다
  if (rows.length >= LIMIT) throw new Error(`${what} 이 ${LIMIT} 행에 닿았다 — 페이징이 필요하다`)
  return rows
}

export interface SignalRow extends SignalResult {
  itemId: string
  itemSlug: string | null
  itemTitle: string | null
  itemStatus: string | null
  surface: string
  surfaceRef: string
  version: number
  status: string
}

export async function loadEffectSignals(): Promise<SignalRow[]> {
  const client = db()
  const [apps, trials, attempts] = await Promise.all([
    read('제품 적용', client.from('knowledge_applications').select('id,item_id,surface,surface_ref,version,status').limit(LIMIT)),
    read('효과 검증', client.from('knowledge_trials').select('application_id,design').limit(LIMIT)),
    read('수행 기록', client.from('learning_task_attempts').select('id,application_id').not('application_id', 'is', null).limit(LIMIT)),
  ])
  const appOfAttempt = new Map(attempts.map((a) => [String(a.id), String(a.application_id)]))
  const ids = [...appOfAttempt.keys()]
  // 첫 시도는 DB 뷰가 고른다 — 키 (user, task_key, item_ref, phase), 동률 answered_at → id. 앱에서 다시 고르지 않는다.
  const first: Row[] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    // select('*') — M8 이 timing_uncertain 열을 더하면 그대로 읽힌다
    first.push(...(await read('첫 시도', client.from('learning_first_attempts').select('*').in('attempt_id', ids.slice(i, i + ID_CHUNK)).limit(LIMIT))))
  }
  const itemIds = [...new Set(apps.map((a) => String(a.item_id)))]
  const items = itemIds.length ? await read('항목', client.from('knowledge_items').select('id,slug,title,status').in('id', itemIds)) : []
  const itemById = new Map(items.map((i) => [String(i.id), i]))

  const byApp = new Map<string, FirstAttempt[]>()
  for (const r of first) {
    const app = appOfAttempt.get(String(r.attempt_id))
    if (!app) continue
    const list = byApp.get(app) ?? []
    list.push({
      userId: String(r.user_id),
      phase: String(r.phase) as Phase,
      isCorrect: typeof r.is_correct === 'boolean' ? r.is_correct : null,
      synthetic: r.synthetic === true,
      helpLevel: (r.help_level as string | null) ?? null,
      afterViewedFirst: r.after_viewed_first === true,
      afterExplanation: r.after_explanation === true,
      timingUncertain: r.timing_uncertain === true,
    })
    byApp.set(app, list)
  }

  return apps.map((a) => {
    const id = String(a.id)
    const minN = trials
      .filter((t) => String(t.application_id) === id)
      .map((t) => Number((t.design as Record<string, unknown> | null)?.min_n))
      .filter((n) => Number.isFinite(n))
    const item = itemById.get(String(a.item_id))
    return {
      ...computeSignals({ applicationId: id, status: String(a.status), trialMinN: minN, attempts: byApp.get(id) ?? [] }),
      itemId: String(a.item_id),
      itemSlug: item ? String(item.slug) : null,
      itemTitle: item ? String(item.title) : null,
      itemStatus: item ? String(item.status) : null,
      surface: String(a.surface),
      surfaceRef: String(a.surface_ref),
      version: Number(a.version),
      status: String(a.status),
    }
  })
}
