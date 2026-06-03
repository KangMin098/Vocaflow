// POST /api/admin/library/enrich-seed { id }
// → 해당 library_seed_catalog 행의 소스 디테일 페이지 fetch 후 메타 채움.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { fetchGutenbergDetail, fetchStandardEbooksDetail, type DetailFields } from '@/lib/library/seed-fetchers/detail-fetchers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  await requireAdmin('/admin/curation')

  let id: string
  try {
    const body = (await request.json()) as { id?: string }
    if (!body.id) throw new Error('id missing')
    id = body.id
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'bad request' }, { status: 400 })
  }

  const client = (await createClient()) as unknown as SupabaseClient
  const { data: row, error: fetchErr } = await client
    .from('library_seed_catalog')
    .select('id, source, source_id, enriched_at')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !row) {
    return NextResponse.json({ error: fetchErr?.message ?? 'row not found' }, { status: 404 })
  }
  const r = row as { id: string; source: string; source_id: string; enriched_at: string | null }

  // 이미 enriched 면 캐시 반환
  if (r.enriched_at) {
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
    } else {
      return NextResponse.json({ error: `enrich 미지원 소스: ${r.source}` }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'fetch failed' }, { status: 502 })
  }

  // UPDATE — null/undefined 는 기존 값 보존하지 않고 명시 null 로 덮어쓰기.
  // 단, subjects 가 비어있으면 기존 값 유지하도록 분기.
  const update: Record<string, unknown> = {
    enriched_at: new Date().toISOString(),
  }
  if (detail.description !== undefined) update.description = detail.description
  if (detail.subjects && detail.subjects.length > 0) update.subjects = detail.subjects
  if (detail.published_year !== undefined) update.published_year = detail.published_year
  if (detail.word_count !== undefined) update.word_count = detail.word_count
  if (detail.reading_time_minutes !== undefined) update.reading_time_minutes = detail.reading_time_minutes

  const { error: updErr } = await client
    .from('library_seed_catalog')
    .update(update)
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ cached: false, ...update })
}
