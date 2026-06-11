// apps/web/src/app/api/admin/library/save-librivox-audio/route.ts
//
// POST /api/admin/library/save-librivox-audio
//   본문: { book_id, librivox_id }            → 보이스 연결 저장 (워크스페이스 노출 활성)
//         { book_id, clear: true }            → 연결 해제 (librivox_audio = null)
//
// 신뢰 정책: 클라이언트가 보낸 audio 를 신뢰하지 않고, librivox_id 로 섹션을 서버에서
//   재조회(fetchLibriVoxAudioById) 하여 저장. 도서 chapter_count 와 섹션 수를 비교해
//   aligned 를 산정 — 일치할 때만 워크스페이스에서 챕터별 매핑이 신뢰된다.
//
// 응답: 200 { ok, saved|cleared, aligned, section_count, chapter_count }
//       400 invalid · 401/403 미인증 · 404 도서 없음 · 502 LibriVox 오류

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { fetchLibriVoxAudioById } from '@/lib/library/librivox-audio'
import { autoMapLibriVoxForBook } from '@/lib/library/librivox-automap'
import { deriveConsistency, type LibriVoxSavedAudio } from '@/lib/workspace/chapter-audio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SaveBody {
  book_id?: string
  librivox_id?: string
  clear?: boolean
  /** 다권 저작 — 챕터별 멀티파트 매핑을 서버에서 빌드·저장 */
  build_chapter_map?: boolean
}

export async function POST(request: Request): Promise<NextResponse> {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError
  const admin = adminOrError

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'ServerConfig', message: 'SUPABASE_URL / SERVICE_ROLE_KEY 누락' },
      { status: 500 },
    )
  }

  let body: SaveBody
  try {
    body = (await request.json()) as SaveBody
  } catch {
    return NextResponse.json({ error: 'BadRequest', message: 'Invalid JSON' }, { status: 400 })
  }

  const bookId = (body.book_id ?? '').trim()
  if (!bookId) {
    return NextResponse.json({ error: 'BadRequest', message: 'book_id 필요' }, { status: 400 })
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── 연결 해제
  if (body.clear) {
    const { error } = await client
      .from('library_books')
      .update({ librivox_audio: null })
      .eq('id', bookId)
    if (error) {
      return NextResponse.json({ error: 'DBError', message: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, cleared: true })
  }

  // ── 다권 저작 — 챕터별 멀티파트 매핑 빌드·저장 (공유 헬퍼 autoMapLibriVoxForBook)
  //   동일 로직을 LCP dev-process(파이프라인 자동 매핑)도 사용 — 중복 제거.
  if (body.build_chapter_map) {
    let result
    try {
      result = await autoMapLibriVoxForBook(client, bookId, { savedBy: admin.id })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      if (/도서 없음/.test(message)) {
        return NextResponse.json({ error: 'NotFound', message: '도서 없음' }, { status: 404 })
      }
      return NextResponse.json({ error: 'GatewayError', message }, { status: 502 })
    }

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        mode: result.mode,
        mapped_chapters: result.mapped_chapters,
        lv_chapter_count: result.lv_chapter_count,
        real_chapter_count: result.real_chapter_count,
        excluded_idx: result.excluded_idx,
        total_chapters: result.total_chapters,
        volume_count: result.volume_count,
        ...(result.mode === 'flat' ? { fallback: 'flat_from_chapter_parts' } : {}),
      })
    }

    return NextResponse.json({
      ok: false,
      reason: result.reason,
      lv_chapter_count: result.lv_chapter_count,
      real_chapter_count: result.real_chapter_count,
      mapped_chapters: 0,
      volume_count: result.volume_count,
    })
  }

  // ── 연결 저장
  const librivoxId = (body.librivox_id ?? '').trim()
  if (!librivoxId) {
    return NextResponse.json(
      { error: 'BadRequest', message: 'librivox_id 또는 clear 필요' },
      { status: 400 },
    )
  }

  // 도서 chapter_count 조회
  const { data: bookRow, error: bookErr } = await client
    .from('library_books')
    .select('id, chapter_count')
    .eq('id', bookId)
    .maybeSingle()
  if (bookErr) {
    return NextResponse.json({ error: 'DBError', message: bookErr.message }, { status: 500 })
  }
  if (!bookRow) {
    return NextResponse.json({ error: 'NotFound', message: '도서 없음' }, { status: 404 })
  }
  const chapterCount = (bookRow as { chapter_count: number | null }).chapter_count ?? 0

  // LibriVox 섹션 서버 재조회 (신뢰 경로)
  let audio
  try {
    audio = await fetchLibriVoxAudioById(librivoxId)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json(
      { error: 'GatewayError', message: `LibriVox 조회 실패: ${message}` },
      { status: 502 },
    )
  }
  if (!audio || audio.sections.length === 0) {
    return NextResponse.json(
      { error: 'NotFound', message: 'LibriVox 섹션을 찾지 못했습니다.' },
      { status: 404 },
    )
  }

  const aligned = chapterCount > 0 && audio.section_count === chapterCount
  const consistency = deriveConsistency(audio.sections)

  const saved: LibriVoxSavedAudio = {
    librivox_id: librivoxId,
    librivox_title: null,
    archive_url: audio.archive_url,
    librivox_url: audio.librivox_url,
    total_secs: audio.total_secs,
    section_count: audio.section_count,
    aligned,
    chapter_count_at_save: chapterCount || null,
    consistency,
    saved_at: new Date().toISOString(),
    saved_by: admin.id,
    sections: audio.sections.map((s) => ({
      n: s.n,
      title: s.title,
      url: s.url,
      secs: s.secs,
      reader: s.reader,
    })),
  }

  const { error: upErr } = await client
    .from('library_books')
    .update({ librivox_audio: saved })
    .eq('id', bookId)
  if (upErr) {
    return NextResponse.json({ error: 'DBError', message: upErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    saved: true,
    aligned,
    section_count: audio.section_count,
    chapter_count: chapterCount,
    consistency,
  })
}
