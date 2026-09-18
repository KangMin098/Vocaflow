// apps/web/src/app/api/admin/csat/sources/route.ts
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateSource, sourceEligibilityInput, SOURCE_POLICY_SELECT, ELIGIBILITY_SPEC_VERSION, allDefects } from '@vocaflow/library-pipeline'
import { SOURCE_QUEUES, type SourceQueue, type SourceOperationRow } from '@/lib/textbook/source-operations'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'cache-control': 'no-store' } })
const requireCount = (r: { count: number | null; error: unknown }) => {
  if (r.error || r.count == null) throw new Error(`Count unavailable: ${r.error && typeof r.error === 'object' && 'message' in r.error ? r.error.message : 'missing count'}`)
  return r.count
}
function sameRevision(left: string | null | undefined, right: string | null | undefined): boolean {
  const micros = (value: string | null | undefined) => {
    const match = value?.match(/^(\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/)
    const seconds = match ? Date.parse(`${match[1]}${match[3]}`) : NaN
    return match && Number.isFinite(seconds) ? BigInt(seconds) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0')) : null
  }
  const revision = micros(left)
  return revision !== null && revision === micros(right)
}
function filterQueue(db: SupabaseClient, queue: SourceQueue, countOnly = false) {
  let q = db.from('csat_source_operations').select(countOnly ? 'article_id' : '*', { count: 'exact', head: countOnly })
  if (['eligible', 'conditional', 'rejected', 'review'].includes(queue)) q = q.eq('effective_status', queue)
  if (queue === 'stale') q = q.neq('cache_state', 'current')
  if (['analysis', 'analyzed', 'content', 'cefr', 'excerpt', 'quality', 'p0'].includes(queue)) q = q.eq('cache_state', 'current')
  if (queue === 'analysis') q = q.neq('result->>analysisStatus', 'complete')
  if (queue === 'analyzed') q = q.eq('result->>analysisStatus', 'complete')
  if (queue === 'unavailable') q = q.eq('can_use', false)
  if (queue === 'content') q = q.eq('result->>contentStatus', 'unjudged')
  if (queue === 'cefr') q = q.filter('result->blockers', 'cs', JSON.stringify(['cefr_above_band']))
  if (queue === 'excerpt') q = q.filter('result->blockers', 'cs', JSON.stringify(['excerpt_not_materialized']))
  if (queue === 'quality') q = q.not('quality_flags', 'eq', '{}')
  if (queue === 'p0') q = q.filter('result->blockers', 'cs', JSON.stringify(['content_rejected'])).gt('linked_items', 0)
  return q
}
async function currentSource(db: SupabaseClient, id: string) {
  const [article, itemCount] = await Promise.all([
    db.from('library_articles').select(`${SOURCE_POLICY_SELECT},source,updated_at,content,source_url`).eq('id', id).maybeSingle(),
    db.from('csat_dcp_items').select('id', { head: true, count: 'exact' }).eq('kind', 'article').eq('ref_id', id),
  ])
  if (article.error) throw new Error('Source unavailable')
  if (!article.data) return null
  const linkedItems = requireCount(itemCount)
  const input = sourceEligibilityInput(article.data, linkedItems > 0)
  return { article: article.data, input, current: evaluateSource(input), linkedItems }
}
export async function GET(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  try {
    const db = createAdminClient() as unknown as SupabaseClient
    const params = new URL(request.url).searchParams
    if (params.has('summary')) {
      const summary = await db.from('csat_source_operations_summary').select('counts,measured_at,policy_version').single()
      if (summary.error || !summary.data || !summary.data.counts ||
        (Object.keys(SOURCE_QUEUES) as SourceQueue[]).some(queue =>
          !Number.isSafeInteger(summary.data.counts[queue]) || summary.data.counts[queue] < 0)) {
        throw new Error('Source summary counts unavailable')
      }
      return reply({ counts: summary.data.counts, measuredAt: summary.data.measured_at, policyVersion: summary.data.policy_version })
    }
    const id = params.get('id')
    if (id) {
      if (!UUID.test(id)) return reply({ error: '원문 ID가 올바르지 않습니다.' }, 400)
      const now = await currentSource(db, id)
      if (!now) return reply({ error: '원문을 찾지 못했습니다.' }, 404)
      const [cached, items, history, renders, attempts] = await Promise.all([
        db.from('csat_source_eligibility').select('*').eq('article_id', id).maybeSingle(),
        db.from('csat_dcp_items').select('id,type,paragraph_idx').eq('kind', 'article').eq('ref_id', id).order('id').limit(30),
        db.from('csat_source_eligibility_history').select('*').eq('article_id', id).order('replaced_at', { ascending: false }).limit(10),
        db.from('textbook_volume_renders').select('series,band,rendered_at,colophon'),
        db.from('csat_item_attempts').select('id', { count: 'exact', head: true }).eq('text_id', id).not('dcp_item_id', 'is', null),
      ])
      if (cached.error || items.error || history.error || renders.error) throw new Error('Inspector linkage unavailable')
      const cachedRow = cached.data as SourceOperationRow | null
      const row: SourceOperationRow = cachedRow ?? {
        article_id: id, source: now.article.source, source_updated_at: now.article.updated_at,
        policy_version: ELIGIBILITY_SPEC_VERSION, input: now.input, result: now.current,
        quality_flags: [], linked_items: now.linkedItems, measured_at: null,
        excerpt_evidence: { windows: Array.isArray(now.article.windows) ? now.article.windows.length : 0,
          invalidRanges: null, approved: false, contentRevisionRecorded: false },
      }
      const renderRows = renders.data ?? []
      return reply({ row, current: now.current, currentInput: now.input, content: now.article.content ?? '', sourceUrl: now.article.source_url,
        stale: !cachedRow || !sameRevision(row.source_updated_at, now.article.updated_at) ||
          row.policy_version !== ELIGIBILITY_SPEC_VERSION || (row.result.grade === 'excerpt' && now.linkedItems === 0),
        windows: now.article.windows ?? [], items: items.data, linkedItems: now.linkedItems,
        attempts: requireCount(attempts),
        renders: renderRows.filter(r => r.colophon?.sourceManifest?.sourceIds?.includes(id)).map(({ series, band, rendered_at }) => ({ series, band, rendered_at })),
        historicalRendersUnknown: renderRows.some(r => !r.colophon?.sourceManifest), history: history.data })
    }
    const queue = params.get('queue') ?? 'all'
    if (!Object.prototype.hasOwnProperty.call(SOURCE_QUEUES, queue)) return reply({ error: '알 수 없는 검토 큐입니다.' }, 400)
    const page = Number(params.get('page') ?? 0)
    if (!Number.isInteger(page) || page < 0 || page > 5000) return reply({ error: '페이지가 올바르지 않습니다.' }, 400)
    let query = filterQueue(db, queue as SourceQueue).order('linked_items', { ascending: false }).order('article_id').range(page * 30, page * 30 + 29)
    const term = params.get('q')?.trim().slice(0, 160)
    if (term) query = query.ilike('current_title', `%${term.replace(/[%_]/g, '\\$&')}%`)
    const result = await query
    const count = requireCount(result)
    return reply({ rows: result.data, count, page })
  } catch (error) {
    console.error('[csat-source-operations]', error)
    return reply({ error: '원문 판정 정보를 읽지 못했습니다. 캐시 적재 상태를 확인하고 다시 시도하세요.', diagnostic: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined }, 503)
  }
}

/** One-row derived-cache revalidation; never alters source content or judgment. */
export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: '요청 출처가 올바르지 않습니다.' }, 403)
  try {
    const body = await request.json() as { id?: string; action?: string }
    if (!body.id || !UUID.test(body.id) || body.action !== 'revalidate') return reply({ error: '재검증 요청이 올바르지 않습니다.' }, 400)
    const db = createAdminClient() as unknown as SupabaseClient
    const now = await currentSource(db, body.id)
    if (!now) return reply({ error: '원문을 찾지 못했습니다.' }, 404)
    const quality = allDefects(now.article.content ?? '').map(x => x.id as string)
    if (now.article.source === 'voa' && (now.article.content ?? '').includes('We have a new comment system')) quality.push('voa-comment-system')
    const previous = await db.from('csat_source_eligibility').select('excerpt_evidence,source_updated_at').eq('article_id', body.id).maybeSingle()
    if (previous.error) throw new Error('Previous evidence unavailable')
    // Text revision changed: old range validation is invalidated, never inherited.
    const canReuseEvidence = previous.data && sameRevision(previous.data.source_updated_at, now.article.updated_at)
    const result = await db.from('csat_source_eligibility').upsert({
      article_id: body.id, source: now.article.source, source_updated_at: now.article.updated_at,
      policy_version: ELIGIBILITY_SPEC_VERSION, input: now.input, result: now.current,
      quality_flags: quality, linked_items: now.linkedItems, measured_at: new Date().toISOString(),
      excerpt_evidence: canReuseEvidence ? previous.data?.excerpt_evidence : { windows: Array.isArray(now.article.windows) ? now.article.windows.length : 0, invalidRanges: null, approved: false, contentRevisionRecorded: false },
    })
    if (result.error) throw new Error('Revalidation failed')
    return reply({ ok: true, result: now.current })
  } catch { return reply({ error: '재검증에 실패했습니다. 원문은 변경하지 않았습니다.' }, 503) }
}
