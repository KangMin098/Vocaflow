// apps/web/src/app/api/admin/library/convert-to-se/route.ts
//
// POST /api/admin/library/convert-to-se   { rowId: string }
//   Gutenberg seed 행을 Standard Ebooks 동일 도서로 "변환(교체)".
//
//   유연한 매핑 프로세스 (사용자 정책):
//     1) 제목 우선 — 관사(the/a/an)·부제(: ;)·기호 무시 정규화 제목이 같으면 동일 도서로 간주
//        (저자 음차 철자 차이 Dostoyevsky/Dostoevsky 등 무관).
//     2) 후보 2개 이상 → ① 저자 성 일치 우선 → ② "높은 버전"(canonical=경로 짧은 것 → 최신)
//        → ③ 첫(관련도) 결과.
//     3) 변환 = 교체 — SE 행 추가 + 해당 Gutenberg 행 삭제 (자동 shadowing 이 안 되는
//        관사/음차 케이스까지 확실히 정리). 단 imported_to_books 인 행은 보존(링크 보호).
//
// 응답: 200 { ok, found, inserted, seTitle?, gutenbergDeleted }

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { FETCHERS } from '@/lib/library/seed-fetchers'
import type { SeedRow } from '@/lib/library/seed-fetchers/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 제목 정규화 — 관사 + 부제 + 비영숫자 제거 + 소문자. (매칭 강신호) */
function normTitle(title: string | null | undefined): string {
  return (title ?? '')
    .replace(/[:;].*$/, '') // 부제 제거
    .replace(/^\s*(the|a|an)\s+/i, '') // 앞 관사 제거
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

/** 첫 저자의 성 정규화 — 'Last, First' 면 콤마 앞, 아니면 마지막 토큰. (약신호 — tiebreak 용) */
function surname(author: string | null | undefined): string {
  const first = ((author ?? '').split(/\s+and\s+|\s*&\s*|\s*;\s*|\s+with\s+/i)[0] ?? '').trim()
  let s: string
  if (first.includes(',')) {
    s = first.split(',')[0]?.trim() ?? ''
  } else {
    const toks = first.split(/\s+/).filter(Boolean)
    s = toks[toks.length - 1] ?? ''
  }
  return s.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()
}

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'ServerConfig', message: 'SUPABASE_URL / SERVICE_ROLE_KEY 누락' },
      { status: 500 },
    )
  }

  let rowId = ''
  try {
    const body = (await request.json()) as { rowId?: unknown }
    if (typeof body.rowId === 'string') rowId = body.rowId
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!rowId) {
    return NextResponse.json({ error: 'NoRowId', message: 'rowId 누락' }, { status: 400 })
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) 원본 Gutenberg 행 로드
  const { data: row, error: selErr } = await client
    .from('library_seed_catalog')
    .select('id, source, title, author, imported_to_books')
    .eq('id', rowId)
    .maybeSingle()
  if (selErr) {
    return NextResponse.json({ error: 'DBError', message: selErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'NotFound', message: '행을 찾을 수 없습니다' }, { status: 404 })
  }
  const src = row as {
    source: string
    title: string
    author: string | null
    imported_to_books: boolean
  }
  if (src.source !== 'gutenberg') {
    return NextResponse.json(
      { error: 'NotGutenberg', message: 'Gutenberg 행만 변환할 수 있습니다' },
      { status: 400 },
    )
  }

  const tKey = normTitle(src.title)
  const gSurname = surname(src.author)

  // 2) SE 를 제목으로 검색 (관사 제거한 제목으로 — 검색 적중률↑)
  const queryTitle = src.title.replace(/^\s*(the|a|an)\s+/i, '').replace(/[:;].*$/, '').trim()
  let fetched: SeedRow[] = []
  try {
    const result = await Promise.race([
      FETCHERS.standard_ebooks.fetchBatch({
        search: queryTitle || src.title,
        sort: 'title-alpha',
        language: 'en',
        offset: 0,
        limit: 48,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SE 검색 timeout 20s')), 20_000),
      ),
    ])
    fetched = result.fetched
  } catch (e) {
    return NextResponse.json(
      { error: 'FetchFailed', message: e instanceof Error ? e.message : 'SE 검색 실패' },
      { status: 502 },
    )
  }

  // 3) 제목 우선 매칭 — 정규화 제목 동일한 SE 후보
  const candidates = fetched.filter((se) => normTitle(se.title) === tKey)
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, found: false, inserted: 0, gutenbergDeleted: false })
  }

  // 4) 후보 다중 → disambiguation 캐스케이드
  let chosen: SeedRow
  if (candidates.length === 1) {
    chosen = candidates[0]!
  } else {
    // ① 저자 성 일치 우선 (없으면 전체 후보 유지)
    const authorMatched = candidates.filter((se) => surname(se.author) === gSurname)
    const pool = authorMatched.length > 0 ? authorMatched : candidates
    // ② 높은 버전 — canonical(경로 segment 적은 기본 에디션) 우선 → 그다음 최신(source_id desc)
    pool.sort((a, b) => {
      const segA = a.source_id.split('/').length
      const segB = b.source_id.split('/').length
      if (segA !== segB) return segA - segB
      return b.source_id.localeCompare(a.source_id)
    })
    chosen = pool[0]!
  }

  // 5) SE 행 upsert
  const { data: upserted, error: upErr } = await client
    .from('library_seed_catalog')
    .upsert([chosen] as never, { onConflict: 'source,source_id', ignoreDuplicates: false })
    .select('id')
  if (upErr) {
    return NextResponse.json({ error: 'DBError', message: upErr.message }, { status: 500 })
  }

  // 6) 변환 = 교체 — Gutenberg 행 삭제 (단 큐에 추가된 행은 보존)
  let gutenbergDeleted = false
  if (!src.imported_to_books) {
    const { error: delErr } = await client
      .from('library_seed_catalog')
      .delete()
      .eq('id', rowId)
    if (delErr) {
      return NextResponse.json({ error: 'DBError', message: delErr.message }, { status: 500 })
    }
    gutenbergDeleted = true
  }

  return NextResponse.json({
    ok: true,
    found: true,
    inserted: upserted?.length ?? 1,
    seTitle: chosen.title,
    gutenbergDeleted,
  })
}
