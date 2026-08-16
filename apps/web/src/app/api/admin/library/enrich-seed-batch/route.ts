// apps/web/src/app/api/admin/library/enrich-seed-batch/route.ts
//
// POST /api/admin/library/enrich-seed-batch { limit?, source?, dryRun? }
// → 메타가 빈 `library_seed_catalog` 행을 **한 번에 N건** 보강한다. UI 가 반복 호출한다.
//
// 왜 배치가 필요한가 (실측 2026-08-16):
//   단건 라우트(`enrich-seed`)만 있었고 UI 호출부조차 없었다. 그런데 보강이 필요한 행은
//   standard_ebooks 만 1,439건이다 — 한 건씩 누르는 건 운영 수단이 아니다.
//   그 결과 큐레이션 목록의 카드 대부분이 제목·표지만 남아, 관리자가 "소스에 뭐가 있는지"를
//   화면에서 알 수 없었다. 이 라우트가 그 격차를 메운다.
//
// 왜 한 번에 다 안 하는가:
//   행마다 외부 사이트를 1회 때린다. 1,439건을 한 요청에 처리하면 어떤 타임아웃에도 안 들어가고,
//   무엇보다 **남의 사이트를 수천 번 연속으로 때리는 요청**이 된다.
//   호출 1회 = N건(기본 8) + 건당 간격을 두고, 진행은 UI 가 반복 호출로 만든다
//   (PDCP 드레인 · dev-drain-queue 와 같은 구조).
//
// 잠금 회수(`force`)를 여기 두지 않은 이유:
//   과거 배치가 `enriched_at` 만 찍어 둔 행은 **선택 조건 자체**로 걸러 낸다
//   (내용이 비어 있으면 스탬프 여부와 무관하게 대상). 스탬프를 신뢰하지 않으므로 force 가 필요 없다.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/auth/require-admin'
import {
  fetchGutenbergDetail,
  fetchStandardEbooksDetail,
  fetchLit2GoDetail,
  type DetailFields,
} from '@/lib/library/seed-fetchers/detail-fetchers'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** 디테일 fetcher 가 있는 소스만 대상. 나머지는 목록 API 가 준 것 이상을 얻을 수 없다. */
const FETCHERS: Record<string, (sourceId: string) => Promise<DetailFields>> = {
  gutenberg: fetchGutenbergDetail,
  standard_ebooks: fetchStandardEbooksDetail,
  lit2go: fetchLit2GoDetail,
}

const MAX_LIMIT = 25
const PER_ROW_TIMEOUT_MS = 20_000
/** 소스 사이트에 대한 예의 — 건당 간격. 없애면 초당 수 회로 때리게 된다. */
const POLITE_DELAY_MS = 400

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

interface SeedRow {
  id: string
  source: string
  source_id: string
  title: string | null
}

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/curation')

  let limit = 8
  let source: string | null = null
  let dryRun = false
  try {
    const body = (await request.json()) as { limit?: number; source?: string; dryRun?: boolean }
    if (typeof body.limit === 'number') limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(body.limit)))
    if (typeof body.source === 'string' && body.source) source = body.source
    dryRun = body.dryRun === true
  } catch {
    /* 본문 없이 호출하면 기본값 */
  }

  if (source && !FETCHERS[source]) {
    return NextResponse.json(
      { error: `enrich 미지원 소스: ${source}`, supported: Object.keys(FETCHERS) },
      { status: 400 },
    )
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'ServerConfig', message: 'SUPABASE_URL / SERVICE_ROLE_KEY 누락' },
      { status: 500 },
    )
  }
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 대상 = 지원 소스 중 **내용이 비어 있는** 행. `enriched_at` 은 보지 않는다
  // (과거 배치가 내용 없이 스탬프만 찍어 둔 행이 1,449건 있었다 — 스탬프는 신뢰 대상이 아니다).
  const targetSources = source ? [source] : Object.keys(FETCHERS)

  const { data, error, count } = await client
    .from('library_seed_catalog')
    .select('id, source, source_id, title', { count: 'exact' })
    .in('source', targetSources)
    .is('description', null)
    .is('word_count', null)
    .order('popularity_rank', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as SeedRow[]
  const remainingBefore = count ?? rows.length

  if (rows.length === 0) {
    return NextResponse.json({ done: true, processed: 0, remaining: 0, message: '보강할 후보가 없습니다' })
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      remaining: remainingBefore,
      wouldProcess: rows.map((r) => ({ id: r.id, source: r.source, sourceId: r.source_id, title: r.title })),
    })
  }

  const results: Array<{ id: string; title: string | null; filled: string[]; error?: string }> = []

  for (const [i, r] of rows.entries()) {
    if (i > 0) await delay(POLITE_DELAY_MS)
    const fetcher = FETCHERS[r.source]
    if (!fetcher) {
      results.push({ id: r.id, title: r.title, filled: [], error: `미지원 소스: ${r.source}` })
      continue
    }
    let detail: DetailFields
    try {
      detail = await Promise.race([
        fetcher(r.source_id),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`timeout ${PER_ROW_TIMEOUT_MS / 1000}s`)), PER_ROW_TIMEOUT_MS),
        ),
      ])
    } catch (e) {
      // 실패는 **스탬프하지 않는다** — 다음 호출에서 다시 대상이 된다.
      results.push({ id: r.id, title: r.title, filled: [], error: e instanceof Error ? e.message : 'fetch 실패' })
      continue
    }

    const update: Record<string, unknown> = {}
    const filled: string[] = []
    const put = (k: string, v: unknown): void => {
      if (v === undefined || v === null || v === '') return
      update[k] = v
      filled.push(k)
    }
    put('description', detail.description)
    if (detail.subjects && detail.subjects.length > 0) put('subjects', detail.subjects)
    put('published_year', detail.published_year)
    put('word_count', detail.word_count)
    put('reading_time_minutes', detail.reading_time_minutes)

    if (filled.length === 0) {
      // 빈손도 스탬프 없이 남긴다. 소스 페이지 구조 변경이면 여기서 0 이 쌓여 눈에 띈다.
      results.push({ id: r.id, title: r.title, filled: [] })
      continue
    }

    update.enriched_at = new Date().toISOString()
    const { error: updErr } = await client.from('library_seed_catalog').update(update).eq('id', r.id)
    results.push({
      id: r.id,
      title: r.title,
      filled: updErr ? [] : filled,
      ...(updErr ? { error: updErr.message } : {}),
    })
  }

  const enriched = results.filter((x) => x.filled.length > 0).length
  const empty = results.filter((x) => x.filled.length === 0 && !x.error).length
  const failed = results.filter((x) => x.error).length

  return NextResponse.json({
    done: false,
    processed: results.length,
    enriched,
    empty,
    failed,
    // 이번 회차에서 채운 만큼 줄어든 잔량. 빈손·실패는 그대로 남아 다음 회차 대상이 된다.
    remaining: Math.max(0, remainingBefore - enriched),
    results,
  })
}
