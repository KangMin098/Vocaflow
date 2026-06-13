// scripts/lcp/librivox-align.mjs
//
// 제목 기반 LibriVox ↔ 도서 챕터 정합 (Claude Code 드레인용, 정확도 100% 우선).
//
// build-librivox-map.mjs(=(book,chapter) 번호 시퀀스 + count-gate)와의 차이:
//   - 다권(Les Mis 5권 — Book 번호 재시작)·포맷불일치("Bk 1" vs "Bk 01", "<b>")·묶음파일
//     ("Ch 01-04")에서 번호 매핑은 권 간 충돌 → 틀린 오디오 배정.
//   - 본 스크립트는 섹션 제목 본문 ↔ 챕터 제목을 정규화 비교 → 제목이 유일 키라 권 충돌 0.
//     유일 1:1 일치만 배정, 묶음/중복/미일치는 비움(TTS fallback) → 틀린 배정 0 = 정확도 100%.
//
// 실행:  pnpm dlx tsx scripts/lcp/librivox-align.mjs <book_id> [--commit]
//        (--commit 없으면 dry-run: 정합 결과만 출력, DB 미변경)
//
// 드레인 흐름: ① dry-run 으로 matched/gap/ambiguous 확인 → ② 문제 없으면 --commit.
//   gap(미매핑) 은 비정상이 아니라 "그 장은 per-chapter 오디오가 없음 = TTS" 의 정상 표기.

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const bookId = process.argv[2]
const commit = process.argv.includes('--commit')
if (!bookId) {
  console.error('usage: tsx scripts/lcp/librivox-align.mjs <book_id> [--commit]')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { resolveLibriVoxAudioForBook, gutenbergIdFromStandardEbooks } = await import(
  '../../apps/web/src/lib/library/librivox-audio.ts'
)
const { alignChaptersByTitle, alignChaptersByVolume, parseVolumeNumber } = await import(
  '../../apps/web/src/lib/library/librivox-chapter-map.ts'
)

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// 1. 도서
const { data: bk, error: bErr } = await db
  .from('library_books')
  .select('id, source, source_id, title, author, chapter_count')
  .eq('id', bookId)
  .single()
if (bErr || !bk) {
  console.error('Book not found:', bookId, bErr?.message)
  process.exit(1)
}
console.log(`[align] ${bk.title} (${bk.source}/${bk.source_id}) chapters=${bk.chapter_count}`)

// 2. LibriVox 권 해결 + 전 권 섹션 flatten (제목 매칭이라 권 순서 무관)
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
console.log(
  `[align] LibriVox 권: ${volumes.length}`,
  volumes.map((v) => `${v.match.librivox_id}(${v.audio.section_count}sec)`).join(', '),
)
if (volumes.length === 0) {
  console.error('ABORT: LibriVox 낭독 없음')
  process.exit(1)
}
// 권별 volume_number 파싱 + 섹션
const volumesInput = volumes.map((v) => ({
  volume_number: parseVolumeNumber(v.match.librivox_title),
  sections: v.audio.sections.map((s) => ({ title: s.title, url: s.url, secs: s.secs, reader: s.reader, n: s.n })),
}))
const totalSec = volumesInput.reduce((n, v) => n + v.sections.length, 0)
const allNumbered = volumesInput.every((v) => v.volume_number != null)
const multiVol = volumes.length > 1
console.log(`[align] 섹션 합계 ${totalSec} · 권번호: [${volumesInput.map((v) => v.volume_number ?? '?').join(', ')}]`)

// 3. 도서 챕터 (제목 + group_label)
const { data: masters, error: mErr } = await db
  .from('library_chapters_master')
  .select('chapter_idx, group_label, chapter_title')
  .eq('library_book_id', bookId)
  .order('chapter_idx', { ascending: true })
if (mErr) {
  console.error('chapters fetch failed:', mErr.message)
  process.exit(1)
}
const textChapters = (masters ?? []).map((m) => ({
  chapter_idx: m.chapter_idx,
  group_label: m.group_label,
  title: m.chapter_title,
}))

// 4. 정합 — 다권+권번호 인식 시 권-인지(구조) 매핑, 아니면 제목 매핑
let result
let method
if (multiVol && allNumbered) {
  method = 'volume'
  result = alignChaptersByVolume(textChapters, volumesInput)
} else {
  method = 'title'
  result = alignChaptersByTitle(textChapters, volumesInput.flatMap((v) => v.sections))
}
const pct = result.total_chapters
  ? ((result.matched / result.total_chapters) * 100).toFixed(1)
  : '0.0'
const extra =
  method === 'volume'
    ? `conflicts=${result.conflicts.length} · number_trusted=${result.number_trusted.length} · orphan_sections=${result.orphan_sections}`
    : `ambiguous=${result.ambiguous.length} · unused_sections=${result.unused_sections}`
console.log(
  `\n[align] 방식=${method} · matched=${result.matched}/${result.total_chapters} (${pct}%) · ` +
    `gap(TTS)=${result.unmatched_idx.length} · ${extra}`,
)

// 스팟 체크 — 매핑된 것 5개 + 갭 5개 미리보기
const titleByIdx = new Map(textChapters.map((c) => [c.chapter_idx, c.title]))
const mappedIdxs = Object.keys(result.chapter_map).map(Number).sort((a, b) => a - b)
console.log('\n[sample] 매핑 (텍스트 → 오디오):')
for (const idx of mappedIdxs.slice(0, 5)) {
  console.log(`   ${idx} "${(titleByIdx.get(idx) ?? '').slice(0, 32)}" → "${result.chapter_map[idx].parts[0]?.title}"`)
}
if (result.unmatched_idx.length > 0) {
  console.log('\n[sample] 미매핑(TTS) 챕터:')
  for (const idx of result.unmatched_idx.slice(0, 8)) {
    console.log(`   ${idx} "${(titleByIdx.get(idx) ?? '').slice(0, 40)}"`)
  }
}
if (method === 'volume' && result.conflicts.length > 0) {
  console.log('\n[warn] 번호↔제목 불일치(보류):')
  for (const c of result.conflicts.slice(0, 10)) {
    console.log(`   ${c.chapter_idx} 텍스트"${(c.text_title ?? '').slice(0, 28)}" ≠ 오디오"${(c.audio_title ?? '').slice(0, 32)}"`)
  }
}
if (method === 'title' && result.ambiguous.length > 0) {
  console.log('\n[warn] 제목 중복(보류)：', result.ambiguous.slice(0, 8).map((a) => `${a.chapter_idx}:"${a.norm_title}"`).join(' · '))
}
if (method === 'volume' && result.number_trusted.length > 0) {
  console.log(`\n[info] 번호 신뢰 배정(제목 절단/오타 — spot-check 권장): ${result.number_trusted.join(', ')}`)
}

if (!commit) {
  console.log('\n[dry-run] --commit 없음 → DB 미변경. 위 결과 확인 후 --commit 으로 저장.')
  process.exit(0)
}

if (result.matched === 0) {
  console.error('ABORT: 매핑된 챕터 0 — 저장 안 함 (제목 포맷 점검 필요).')
  process.exit(1)
}

// 5. 저장 (chapter_parts · 매핑된 챕터만 — 미매핑은 omit → pickChapterAudio null → TTS)
const v0 = volumes[0]
const saved = {
  librivox_id: v0.match.librivox_id,
  librivox_title: v0.match.librivox_title,
  librivox_url: v0.audio.librivox_url,
  archive_url: v0.audio.archive_url,
  total_secs: null,
  section_count: result.matched,
  consistency: 'multi',
  mode: 'chapter_parts',
  align_method: method, // 'volume'(권-인지 구조) | 'title'(제목)
  chapter_map: Object.fromEntries(
    Object.entries(result.chapter_map).map(([idx, v]) => [idx, { roman: v.roman, parts: v.parts }]),
  ),
  mapped_chapters: result.matched,
  volume_ids: volumes.map((v) => v.match.librivox_id),
  saved_at: new Date().toISOString(),
  saved_by: null,
  sections: [],
}
const { error: upErr } = await db
  .from('library_books')
  .update({ librivox_audio: saved })
  .eq('id', bookId)
if (upErr) {
  console.error('save failed:', upErr.message)
  process.exit(1)
}
console.log(
  `\n[done] librivox_audio 저장: 제목정합 ${result.matched}/${result.total_chapters} 챕터, ` +
    `${volumes.length}권. 미매핑 ${result.unmatched_idx.length}장은 TTS fallback.`,
)
