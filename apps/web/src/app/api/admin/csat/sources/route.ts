// apps/web/src/app/api/admin/csat/sources/route.ts
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateSource, sourceEligibilityInput, SOURCE_POLICY_SELECT, ELIGIBILITY_SPEC_VERSION, allDefects } from '@vocaflow/library-pipeline'
import {
  SOURCE_QUEUES, SOURCE_BREAKDOWN_REASONS, buildSourceMetrics, isSourceBreakdownReason,
  SOURCE_GRADES, SOURCE_STATUSES, SOURCE_USE_TAGS, SOURCE_LIST_SORTS, SOURCE_PAGE_SIZES, SOURCE_PAGE_SIZE,
  type SourceQueue, type SourceOperationRow, type SourceGrade, type SourceStatus,
  type SourceUseTag, type SourceListSort, type SourcePageSize,
} from '@/lib/textbook/source-operations'
import { lastDrainRun } from '@/lib/csat/drain-runs'
import { loadSourceLive } from '@/lib/textbook/source-live'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'cache-control': 'no-store' } })
const requireCount = (r: { count: number | null; error: unknown }) => {
  if (r.error || r.count == null) throw new Error(`Count unavailable: ${r.error && typeof r.error === 'object' && 'message' in r.error ? r.error.message : 'missing count'}`)
  return r.count
}
function filterQueue(db: SupabaseClient, queue: SourceQueue, countOnly = false) {
  let q = db.from('csat_source_eligibility').select(countOnly ? 'article_id' : '*', { count: 'exact', head: countOnly })
  if (queue === 'eligible') q = q.eq('result->>status', 'eligible')
  if (queue === 'conditional') q = q.eq('result->>status', 'conditional')
  if (queue === 'rejected') q = q.eq('result->>status', 'rejected')
  if (queue === 'review') q = q.eq('result->>status', 'review')
  if (queue === 'analysis') q = q.neq('result->>analysisStatus', 'complete')
  if (queue === 'analyzed') q = q.eq('result->>analysisStatus', 'complete')
  if (queue === 'unavailable') q = q.not('result->>grade', 'in', '(usable,excerpt)')
  if (queue === 'content') q = q.eq('result->>contentStatus', 'unjudged')
  if (queue === 'raw') q = q.filter('result->blockers', 'cs', JSON.stringify(['raw_content_unjudged']))
  if (queue === 'cefr') q = q.filter('result->blockers', 'cs', JSON.stringify(['cefr_above_band']))
  if (queue === 'excerpt') q = q.filter('result->blockers', 'cs', JSON.stringify(['excerpt_not_materialized']))
  if (queue === 'quality') q = q.not('quality_flags', 'eq', '{}')
  if (queue === 'tagged') q = q.not('uses', 'is', null).not('uses', 'eq', '{}')
  if (queue === 'ready') q = q.eq('result->>grade', 'usable').not('uses', 'is', null).not('uses', 'eq', '{}')
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
    // 「지금 다시 세기」 단추 — 첫 화면(page.tsx)과 **같은 함수**로 센다. 못 셌으면 503 과 이유
    // (0 으로 뭉개지 않는다 — 화면이 「판정 0편」과 「못 셌다」를 가른다).
    if (params.has('live')) {
      const live = await loadSourceLive(db)
      return reply(live, live.ok ? 200 : 503)
    }
    if (params.has('summary')) {
      const entries = await Promise.all((Object.keys(SOURCE_QUEUES) as SourceQueue[]).map(async queue => [queue, requireCount(await filterQueue(db, queue, true))] as const))
      const latest = await db.from('csat_source_eligibility').select('measured_at,policy_version').order('measured_at').limit(1)
      if (latest.error) throw new Error('Cache timestamp unavailable')
      const counts = Object.fromEntries(entries) as Record<SourceQueue, number>
      const measuredAt = latest.data?.[0]?.measured_at ?? null
      /* 마지막 드레인 실행. 화면이 「이 명령을 돌려라」까지만 말하고 「이미 돌았는지」는
       * 못 말하던 구멍을 메운다. 요약에 같이 실어 왕복을 안 늘린다. */
      const drain = await lastDrainRun(db, 'source')
      return reply({ counts, metrics: buildSourceMetrics(counts, measuredAt), measuredAt, policyVersion: ELIGIBILITY_SPEC_VERSION, drain })
    }
    if (params.has('breakdown')) {
      const queue = params.get('breakdown') ?? ''
      if (!Object.prototype.hasOwnProperty.call(SOURCE_QUEUES, queue)) return reply({ error: '알 수 없는 검토 큐입니다.' }, 400)
      const entries = await Promise.all(SOURCE_BREAKDOWN_REASONS.map(async reason => {
        const count = await filterQueue(db, queue as SourceQueue, true)
          .filter('result->blockers', 'cs', JSON.stringify([reason]))
        return [reason, requireCount(count)] as const
      }))
      return reply({ reasons: Object.fromEntries(entries), overlap: true })
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
      const row = cached.data as SourceOperationRow | null
      if (!row) return reply({ error: '판정 캐시가 없습니다. 전수 갱신을 먼저 실행하세요.' }, 409)
      const renderRows = renders.data ?? []
      return reply({ row, current: now.current, currentInput: now.input, content: now.article.content ?? '', sourceUrl: now.article.source_url,
        stale: Date.parse(row.source_updated_at) !== Date.parse(now.article.updated_at) || row.policy_version !== ELIGIBILITY_SPEC_VERSION,
        windows: now.article.windows ?? [], items: items.data, linkedItems: now.linkedItems,
        attempts: requireCount(attempts),
        renders: renderRows.filter(r => r.colophon?.sourceManifest?.sourceIds?.includes(id)).map(({ series, band, rendered_at }) => ({ series, band, rendered_at })),
        historicalRendersUnknown: renderRows.some(r => !r.colophon?.sourceManifest), history: history.data })
    }
    const queue = params.get('queue') ?? 'all'
    if (!Object.prototype.hasOwnProperty.call(SOURCE_QUEUES, queue)) return reply({ error: '알 수 없는 검토 큐입니다.' }, 400)
    const page = Number(params.get('page') ?? 0)
    if (!Number.isInteger(page) || page < 0 || page > 5000) return reply({ error: '페이지가 올바르지 않습니다.' }, 400)
    const size = Number(params.get('pageSize') ?? SOURCE_PAGE_SIZE)
    if (!SOURCE_PAGE_SIZES.includes(size as SourcePageSize)) return reply({ error: '쪽 크기가 올바르지 않습니다.' }, 400)
    /* ⚠️ **값을 전부 검사한 뒤에 DB 클라이언트를 만진다.** 검사와 조립을 섞으면 잘못된 값이
     *   와도 앞쪽 필터까지는 이미 질의가 만들어진 뒤에 400 이 나간다 — 이 경로의 회귀가
     *   「권한·입력이 틀리면 서비스에 닿기 전에 거절한다」를 성질로 못박고 있다. */
    // 여러 사유를 AND 로 받는다 — 「내용 미판정이면서 밴드 초과」처럼 겹친 것만 보려면 필요하다.
    const reasons = (params.get('reason') ?? '').split(',').map(x => x.trim()).filter(Boolean)
    if (reasons.length > 4) return reply({ error: '판정 사유는 한 번에 넷까지 겹칠 수 있습니다.' }, 400)
    if (reasons.some(x => !isSourceBreakdownReason(x))) return reply({ error: '알 수 없는 판정 사유입니다.' }, 400)
    const source = params.get('source')?.trim()
    if (source && source.length > 100) return reply({ error: '원천 필터가 너무 깁니다.' }, 400)
    const cefr = params.get('cefr')
    if (cefr && !['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown'].includes(cefr)) return reply({ error: 'CEFR 필터가 올바르지 않습니다.' }, 400)
    // 등급·판정 상태는 지금까지 큐 프리셋으로만 물을 수 있었다. 프리셋은 조합이 안 된다 —
    // 「usable 인데 문항이 없는 것」 같은 질문이 프리셋 14개 어디에도 없었다.
    const grade = params.get('grade')
    if (grade && !SOURCE_GRADES.includes(grade as SourceGrade)) return reply({ error: '등급 필터가 올바르지 않습니다.' }, 400)
    const status = params.get('status')
    if (status && !SOURCE_STATUSES.includes(status as SourceStatus)) return reply({ error: '판정 상태 필터가 올바르지 않습니다.' }, 400)
    const genre = params.get('genre')?.trim()
    if (genre && genre.length > 40) return reply({ error: '장르 필터가 너무 깁니다.' }, 400)
    // 밴드는 jsonb 안에 문자열로 있다 — 같음만 받는다. 범위(`gte`)는 사전순 비교가 되어
    // V10 이 V2 보다 작다고 나온다. 범위가 필요해지면 생성 컬럼을 만들어야 한다.
    const band = params.get('band')
    if (band && !/^(?:[0-9]|1[01])$/.test(band)) return reply({ error: '학령(V-Level) 필터가 올바르지 않습니다.' }, 400)
    // `uses` — 이 원문으로 만들 수 있는 교재 재료(gate-rules.SOURCE_USES). 파생 캐시의 전용
    // 칸에서 읽는다. NULL(아직 안 실림)과 빈 배열(reject 라 재료 없음)은 다른 뜻이다.
    const uses = (params.get('uses') ?? '').split(',').map(x => x.trim()).filter(Boolean)
    if (uses.some(u => !SOURCE_USE_TAGS.includes(u as SourceUseTag))) return reply({ error: '알 수 없는 교재 재료입니다.' }, 400)
    const term = params.get('q')?.trim().slice(0, 160)
    const sort = params.get('sort') ?? 'items'
    if (!Object.prototype.hasOwnProperty.call(SOURCE_LIST_SORTS, sort)) return reply({ error: '정렬이 올바르지 않습니다.' }, 400)

    // ── 여기서부터 조립. 정렬·범위는 마지막에 건다.
    let query = filterQueue(db, queue as SourceQueue)
    for (const reason of reasons) query = query.filter('result->blockers', 'cs', JSON.stringify([reason]))
    if (source) query = query.eq('source', source)
    if (cefr) query = cefr === 'unknown' ? query.is('input->cefrLevel', null) : query.eq('input->>cefrLevel', cefr)
    if (grade) query = query.eq('result->>grade', grade)
    if (status) query = query.eq('result->>status', status)
    if (genre) query = query.eq('input->>gateGenre', genre)
    if (band) query = query.eq('input->>articleVLevel', band)
    if (uses.length) query = query.contains('uses', uses)
    if (term) query = query.ilike('input->>title', `%${term.replace(/[%_]/g, '\\$&')}%`)
    for (const [column, ascending] of SOURCE_LIST_SORTS[sort as SourceListSort]) query = query.order(column, { ascending })
    const result = await query.order('article_id').range(page * size, page * size + size - 1)
    const count = requireCount(result)
    return reply({ rows: result.data, count, page, pageSize: size })
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
    const sameRevision = previous.data && Date.parse(previous.data.source_updated_at) === Date.parse(now.article.updated_at)
    const result = await db.from('csat_source_eligibility').upsert({
      article_id: body.id, source: now.article.source, source_updated_at: now.article.updated_at,
      policy_version: ELIGIBILITY_SPEC_VERSION, input: now.input, result: now.current,
      quality_flags: quality, linked_items: now.linkedItems, measured_at: new Date().toISOString(),
      excerpt_evidence: sameRevision ? previous.data?.excerpt_evidence : { windows: Array.isArray(now.article.windows) ? now.article.windows.length : 0, invalidRanges: null, approved: false, contentRevisionRecorded: false },
    })
    if (result.error) throw new Error('Revalidation failed')
    return reply({ ok: true, result: now.current })
  } catch { return reply({ error: '재검증에 실패했습니다. 원문은 변경하지 않았습니다.' }, 503) }
}
