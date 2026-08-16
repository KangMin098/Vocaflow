// POST /api/admin/library/enrich-seed { id, force? }
// → 해당 library_seed_catalog 행의 소스 디테일 페이지 fetch 후 메타 채움.
//
// ⚠️ 2026-08-16 에 고친 결함 — **빈 성공이 영구 잠금이 됐다**
//   `enriched_at` 을 채운 필드와 무관하게 항상 찍고 있었고, 위쪽 캐시 분기가
//   `enriched_at` 만 보고 즉시 반환했다. 그래서 한 번 빈손으로 끝난 행은 **다시는 시도되지 않는다**.
//   실측 피해: standard_ebooks 1,450행 중 1,449행이 `enriched_at` 을 달고 있는데
//   description 은 11행, subjects·word_count 는 각 1행뿐이었다(2026-05-31 배치, 50행씩 스탬프).
//   그 결과 큐레이션 목록 카드가 제목·표지만 남고 **줄거리·분량이 통째로 비어** 있었다
//   ("소스에 뭐가 있는지 모르겠다" 의 실체).
//   지금은 **하나라도 실제로 채웠을 때만** `enriched_at` 을 찍는다. 빈손이면 스탬프 없이
//   `filled: []` 로 알려서, 다음 시도가 막히지 않게 한다.
//   `force: true` 는 이미 스탬프된 행을 다시 긁는다(과거에 잠긴 행 회수용).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { fetchGutenbergDetail, fetchStandardEbooksDetail, fetchLit2GoDetail, type DetailFields } from '@/lib/library/seed-fetchers/detail-fetchers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/curation')

  let id: string
  let force = false
  try {
    const body = (await request.json()) as { id?: string; force?: boolean }
    if (!body.id) throw new Error('id missing')
    id = body.id
    force = body.force === true
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'bad request' }, { status: 400 })
  }

  // dev-bypass 모드(또는 cookie 세션 없는 admin 호출)에서 RLS 거부 방지 위해
  // service_role client 사용 — 다른 admin write route 와 동일 패턴.
  // requireAdmin 으로 이미 가드 통과한 상태.
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

  const { data: row, error: fetchErr } = await client
    .from('library_seed_catalog')
    .select('id, source, source_id, enriched_at')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !row) {
    return NextResponse.json({ error: fetchErr?.message ?? 'row not found' }, { status: 404 })
  }
  const r = row as { id: string; source: string; source_id: string; enriched_at: string | null }

  // 이미 enriched 면 캐시 반환 (force 면 무시하고 다시 긁는다)
  if (r.enriched_at && !force) {
    const { data: full } = await client
      .from('library_seed_catalog')
      .select('description, subjects, published_year, word_count, reading_time_minutes, enriched_at')
      .eq('id', id)
      .maybeSingle()
    return NextResponse.json({ cached: true, ...full })
  }

  let detail: DetailFields
  try {
    if (r.source === 'gutenberg') {
      detail = await Promise.race([
        fetchGutenbergDetail(r.source_id),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout 20s')), 20_000)),
      ])
    } else if (r.source === 'standard_ebooks') {
      detail = await Promise.race([
        fetchStandardEbooksDetail(r.source_id),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout 20s')), 20_000)),
      ])
    } else if (r.source === 'lit2go') {
      detail = await Promise.race([
        fetchLit2GoDetail(r.source_id),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout 20s')), 20_000)),
      ])
    } else {
      return NextResponse.json({ error: `enrich 미지원 소스: ${r.source}` }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'fetch failed' }, { status: 502 })
  }

  // UPDATE — **실제로 값이 있는 필드만** 쓴다.
  // `!== undefined` 로만 거르면 fetcher 가 `null` 을 담아 돌려준 빈손도 "채웠다" 로 세어져,
  // 아래 스탬프 조건이 무의미해진다(이 라우트가 1,449행을 잠근 경로가 정확히 그거였다).
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

  // 빈손이면 **스탬프하지 않는다** — 다음 시도가 캐시 분기에 막히지 않게.
  // 소스 페이지 구조가 바뀌었거나 일시 장애일 수 있고, 둘 다 재시도로 회복 가능한 상태다.
  if (filled.length === 0) {
    return NextResponse.json({ cached: false, filled: [], enriched: false, source: r.source })
  }

  update.enriched_at = new Date().toISOString()
  const { error: updErr } = await client
    .from('library_seed_catalog')
    .update(update)
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ cached: false, enriched: true, filled, ...update })
}
