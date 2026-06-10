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
import {
  fetchLibriVoxAudioById,
  gutenbergIdFromStandardEbooks,
  resolveLibriVoxAudioForBook,
} from '@/lib/library/librivox-audio'
import {
  buildChapterPartsMap,
  type LvSectionInput,
  type OurChapterInput,
} from '@/lib/library/librivox-chapter-map'
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

  // ── 다권 저작 — 챕터별 멀티파트 매핑 빌드·저장
  if (body.build_chapter_map) {
    const { data: bookRow, error: bookErr } = await client
      .from('library_books')
      .select('id, source, source_id, title, author, chapter_count')
      .eq('id', bookId)
      .maybeSingle()
    if (bookErr) {
      return NextResponse.json({ error: 'DBError', message: bookErr.message }, { status: 500 })
    }
    if (!bookRow) {
      return NextResponse.json({ error: 'NotFound', message: '도서 없음' }, { status: 404 })
    }
    const bk = bookRow as {
      id: string
      source: string
      source_id: string | null
      title: string
      author: string | null
      chapter_count: number | null
    }

    // 1. LibriVox 권 해결 (SE → gutenberg id → resolver)
    let gutenbergId = bk.source === 'gutenberg' ? bk.source_id : null
    if (!gutenbergId && bk.source === 'standard_ebooks' && bk.source_id) {
      gutenbergId = await gutenbergIdFromStandardEbooks(bk.source_id)
    }
    let resolved
    try {
      resolved = await resolveLibriVoxAudioForBook({
        gutenbergId,
        title: bk.title,
        author: bk.author,
        chapterCount: bk.chapter_count,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown'
      return NextResponse.json(
        { error: 'GatewayError', message: `LibriVox 해결 실패: ${message}` },
        { status: 502 },
      )
    }
    const volumes = resolved.matches ?? []
    if (volumes.length === 0) {
      return NextResponse.json({ ok: false, reason: 'LibriVox 낭독을 찾지 못했습니다.', mapped_chapters: 0 })
    }

    // 2. 모든 권 섹션 flatten
    const sections: LvSectionInput[] = []
    for (const v of volumes) {
      for (const s of v.audio.sections) {
        sections.push({ title: s.title, url: s.url, secs: s.secs, reader: s.reader, n: s.n })
      }
    }

    // 3. 우리 챕터 메타 + head (미주 등 word_count 이상치는 content fetch 제외 — 빌더가 word_count 로 제외)
    const { data: masterData, error: mErr } = await client
      .from('library_chapters_master')
      .select('chapter_idx, word_count, content_hash')
      .eq('library_book_id', bookId)
      .order('chapter_idx', { ascending: true })
    if (mErr) {
      return NextResponse.json({ error: 'DBError', message: mErr.message }, { status: 500 })
    }
    const masters = (masterData ?? []) as Array<{
      chapter_idx: number
      word_count: number
      content_hash: string
    }>
    if (masters.length === 0) {
      return NextResponse.json({ ok: false, reason: '도서 챕터가 없습니다.', mapped_chapters: 0 })
    }
    const wcs = masters.map((m) => m.word_count).sort((a, b) => a - b)
    const median = wcs[Math.floor(wcs.length / 2)] ?? 0
    const outlier = median > 0 ? median * 4 : Number.POSITIVE_INFINITY
    const lightHashes = masters.filter((m) => m.word_count <= outlier).map((m) => m.content_hash)
    const headByHash = new Map<string, string>()
    if (lightHashes.length > 0) {
      const { data: chunkData, error: cErr } = await client
        .from('content_chunks')
        .select('hash, content')
        .in('hash', lightHashes)
      if (cErr) {
        return NextResponse.json({ error: 'DBError', message: cErr.message }, { status: 500 })
      }
      for (const c of (chunkData ?? []) as Array<{ hash: string; content: string | null }>) {
        headByHash.set(c.hash, (c.content ?? '').slice(0, 200))
      }
    }
    const chapters: OurChapterInput[] = masters.map((m) => ({
      chapter_idx: m.chapter_idx,
      word_count: m.word_count,
      head: headByHash.get(m.content_hash) ?? '',
    }))

    // 4. 빌드 (count-gate 안전 검증 포함)
    const result = buildChapterPartsMap(sections, chapters)
    if (!result.ok) {
      // ── flat 폴백 ──
      // Roman 파싱 실패는 흔한 케이스 (Arabic "Chapter 01" / 서술형 제목).
      // 단권(volumes.length === 1) AND 섹션 수 == 도서 챕터 수 일 때만 1섹션=1챕터로 저장.
      const onlyVolume = volumes.length === 1 ? volumes[0]! : null
      const flatAligned =
        onlyVolume != null &&
        masters.length > 0 &&
        onlyVolume.audio.section_count === masters.length
      if (flatAligned) {
        const flatSaved: LibriVoxSavedAudio = {
          librivox_id: onlyVolume.match.librivox_id,
          librivox_title: onlyVolume.match.librivox_title,
          librivox_url: onlyVolume.audio.librivox_url,
          archive_url: onlyVolume.audio.archive_url,
          total_secs: onlyVolume.audio.total_secs,
          section_count: onlyVolume.audio.section_count,
          aligned: true,
          chapter_count_at_save: masters.length,
          consistency: deriveConsistency(onlyVolume.audio.sections),
          mode: 'flat',
          saved_at: new Date().toISOString(),
          saved_by: admin.id,
          sections: onlyVolume.audio.sections.map((s) => ({
            n: s.n,
            title: s.title,
            url: s.url,
            secs: s.secs,
            reader: s.reader,
          })),
        }
        const { error: upErr } = await client
          .from('library_books')
          .update({ librivox_audio: flatSaved })
          .eq('id', bookId)
        if (upErr) {
          return NextResponse.json({ error: 'DBError', message: upErr.message }, { status: 500 })
        }
        return NextResponse.json({
          ok: true,
          mode: 'flat',
          mapped_chapters: onlyVolume.audio.section_count,
          total_chapters: masters.length,
          volume_count: 1,
          fallback: 'flat_from_chapter_parts',
        })
      }

      return NextResponse.json({
        ok: false,
        reason: result.reason,
        lv_chapter_count: result.lv_chapter_count,
        real_chapter_count: result.real_chapter_count,
        mapped_chapters: 0,
        volume_count: volumes.length,
      })
    }

    // 5. 저장
    const v0 = volumes[0]!
    const saved: LibriVoxSavedAudio = {
      librivox_id: v0.match.librivox_id,
      librivox_title: v0.match.librivox_title,
      librivox_url: v0.audio.librivox_url,
      archive_url: v0.audio.archive_url,
      total_secs: null,
      section_count: result.mapped_chapters,
      consistency: 'multi',
      mode: 'chapter_parts',
      chapter_map: Object.fromEntries(
        Object.entries(result.chapter_map).map(([idx, v]) => [
          idx,
          { roman: v.roman, parts: v.parts },
        ]),
      ),
      mapped_chapters: result.mapped_chapters,
      volume_ids: volumes.map((v) => v.match.librivox_id),
      saved_at: new Date().toISOString(),
      saved_by: admin.id,
      sections: [],
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
      mode: 'chapter_parts',
      mapped_chapters: result.mapped_chapters,
      lv_chapter_count: result.lv_chapter_count,
      real_chapter_count: result.real_chapter_count,
      excluded_idx: result.excluded_idx,
      total_chapters: masters.length,
      volume_count: volumes.length,
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
