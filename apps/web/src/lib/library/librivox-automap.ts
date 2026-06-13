// apps/web/src/lib/library/librivox-automap.ts
//
// LibriVox 자동 매핑 (서버 전용, 순수 부수효과 = library_books.librivox_audio 저장).
//
// 한 도서에 대해: LibriVox 권 해결 → 섹션 flatten → 우리 챕터 메타 수집 →
//   buildChapterPartsMap(count-gate) → 정합 시 chapter_parts 저장 /
//   단권·섹션수==챕터수면 flat 폴백 저장 / 그 외엔 미저장(reason 반환).
//
// 이 로직은 원래 /api/admin/library/save-librivox-audio 의 build_chapter_map 분기에만
// 있었으나, LCP dev-process(로직 파이프라인)에서도 동일하게 필요해 공유 헬퍼로 추출했다.
//   - save-librivox-audio: 큐레이터가 수동 트리거 → 결과를 HTTP 응답으로
//   - dev-process: 파이프라인 마지막에 자동 호출 → count-gate 실패 시에만 매핑 큐로
//
// count-gate 실패(챕터 불일치)는 "사람 판단이 필요한" 유일한 케이스 → 호출자가 큐 등록.
// recording_found=false(낭독 자체 없음)는 정상(브라우저 TTS) → 큐 등록 불필요.

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  gutenbergIdFromStandardEbooks,
  resolveLibriVoxAudioForBook,
} from './librivox-audio'
import {
  buildChapterPartsMap,
  type LvSectionInput,
  type OurChapterInput,
} from './librivox-chapter-map'
import { deriveConsistency, type LibriVoxSavedAudio } from '../workspace/chapter-audio'

export interface LibriVoxAutoMapResult {
  /** 오디오가 저장됐는지 (chapter_parts 또는 flat) */
  ok: boolean
  /** 저장 모드 — ok 일 때만 'chapter_parts' | 'flat', 아니면 null */
  mode: 'chapter_parts' | 'flat' | null
  /** 저장 안 됨 사유 (ok=false 일 때) */
  reason: string | null
  mapped_chapters: number
  lv_chapter_count: number
  real_chapter_count: number
  total_chapters: number
  /** 간지/미주로 제외된 우리 chapter_idx */
  excluded_idx: number[]
  /** 매칭된 LibriVox 권 수 */
  volume_count: number
  /**
   * ≥1 LibriVox 권이 매칭됨 — "녹음 자체가 없음(false)" vs "녹음은 있으나 정합 실패(true)" 구분.
   * 호출자(dev-process)는 recording_found && !ok 일 때만 매핑 큐에 등록한다.
   */
  recording_found: boolean
}

interface MasterRow {
  chapter_idx: number
  word_count: number
  content_hash: string
}

/**
 * 한 도서에 대해 LibriVox 보이스를 해결·정렬하여 library_books.librivox_audio 에 저장.
 * DB 오류(도서 조회/저장 실패)는 throw — 호출자가 처리. LibriVox 미매칭·count-gate 실패는
 * ok=false 결과로 정상 반환.
 *
 * @param savedBy 저장자 user id (수동 트리거면 admin.id, 자동 파이프라인이면 null)
 */
export async function autoMapLibriVoxForBook(
  client: SupabaseClient,
  bookId: string,
  opts: { savedBy?: string | null } = {},
): Promise<LibriVoxAutoMapResult> {
  const savedBy = opts.savedBy ?? null

  const { data: bookRow, error: bookErr } = await client
    .from('library_books')
    .select('id, source, source_id, title, author, chapter_count')
    .eq('id', bookId)
    .maybeSingle()
  if (bookErr) throw new Error(`autoMap 도서 조회 실패: ${bookErr.message}`)
  if (!bookRow) throw new Error(`autoMap 도서 없음: ${bookId}`)
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
  const resolved = await resolveLibriVoxAudioForBook({
    gutenbergId,
    title: bk.title,
    author: bk.author,
    chapterCount: bk.chapter_count,
  })
  const volumes = resolved.matches ?? []

  const notSaved = (
    reason: string,
    extra: Partial<LibriVoxAutoMapResult> = {},
  ): LibriVoxAutoMapResult => ({
    ok: false,
    mode: null,
    reason,
    mapped_chapters: 0,
    lv_chapter_count: 0,
    real_chapter_count: 0,
    total_chapters: 0,
    excluded_idx: [],
    volume_count: volumes.length,
    recording_found: volumes.length > 0,
    ...extra,
  })

  if (volumes.length === 0) {
    return notSaved('LibriVox 낭독을 찾지 못했습니다.')
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
  if (mErr) throw new Error(`autoMap 챕터 조회 실패: ${mErr.message}`)
  const masters = (masterData ?? []) as MasterRow[]
  if (masters.length === 0) return notSaved('도서 챕터가 없습니다.')

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
    if (cErr) throw new Error(`autoMap 본문 조회 실패: ${cErr.message}`)
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
      onlyVolume != null && masters.length > 0 && onlyVolume.audio.section_count === masters.length
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
        saved_by: savedBy,
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
      if (upErr) throw new Error(`autoMap flat 저장 실패: ${upErr.message}`)
      return {
        ok: true,
        mode: 'flat',
        reason: null,
        mapped_chapters: onlyVolume.audio.section_count,
        lv_chapter_count: result.lv_chapter_count,
        real_chapter_count: result.real_chapter_count,
        total_chapters: masters.length,
        excluded_idx: result.excluded_idx,
        volume_count: 1,
        recording_found: true,
      }
    }

    return notSaved(result.reason ?? '매핑 정합 실패', {
      lv_chapter_count: result.lv_chapter_count,
      real_chapter_count: result.real_chapter_count,
      total_chapters: masters.length,
      excluded_idx: result.excluded_idx,
    })
  }

  // 5. chapter_parts 저장
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
      Object.entries(result.chapter_map).map(([idx, v]) => [idx, { roman: v.roman, parts: v.parts }]),
    ),
    mapped_chapters: result.mapped_chapters,
    volume_ids: volumes.map((v) => v.match.librivox_id),
    saved_at: new Date().toISOString(),
    saved_by: savedBy,
    sections: [],
  }
  const { error: upErr } = await client
    .from('library_books')
    .update({ librivox_audio: saved })
    .eq('id', bookId)
  if (upErr) throw new Error(`autoMap chapter_parts 저장 실패: ${upErr.message}`)

  return {
    ok: true,
    mode: 'chapter_parts',
    reason: null,
    mapped_chapters: result.mapped_chapters,
    lv_chapter_count: result.lv_chapter_count,
    real_chapter_count: result.real_chapter_count,
    total_chapters: masters.length,
    excluded_idx: result.excluded_idx,
    volume_count: volumes.length,
    recording_found: true,
  }
}
