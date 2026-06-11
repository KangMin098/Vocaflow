// scripts/lcp/build-librivox-map.mjs
//
// 다권(multi-volume) LibriVox 낭독 → 도서 챕터별 멀티파트 매핑을 DB 에 연결(저장).
// /api/admin/library/save-librivox-audio {build_chapter_map:true} 와 동일 로직을 CLI 로.
//
// 실행: tsx scripts/lcp/build-librivox-map.mjs <book_id> [--commit]
//   --commit 없으면 dry-run (매핑 결과만 출력, DB 미변경).
//
// 전제: 도서 챕터가 LibriVox Roman 챕터와 정합(간지/미주 제거됨). count-gate 로 안전 검증.

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
  console.error('usage: tsx scripts/lcp/build-librivox-map.mjs <book_id> [--commit]')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { resolveLibriVoxAudioForBook, gutenbergIdFromStandardEbooks } = await import(
  '../../apps/web/src/lib/library/librivox-audio.ts'
)
const { buildChapterPartsMap } = await import(
  '../../apps/web/src/lib/library/librivox-chapter-map.ts'
)

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: bk, error: bErr } = await db
  .from('library_books')
  .select('id, source, source_id, title, author, chapter_count')
  .eq('id', bookId)
  .single()
if (bErr || !bk) {
  console.error('Book not found:', bookId, bErr?.message)
  process.exit(1)
}
console.log(`[map] ${bk.title} (${bk.source}/${bk.source_id}) chapters=${bk.chapter_count}`)

// 1. LibriVox 권 해결
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
console.log(`[map] LibriVox 권: ${volumes.length}`, volumes.map((v) => `${v.match.librivox_id}(${v.audio.section_count}sec)`).join(', '))
if (volumes.length === 0) {
  console.error('ABORT: LibriVox 낭독 없음')
  process.exit(1)
}

// 2. 섹션 flatten
const sections = []
for (const v of volumes) {
  for (const s of v.audio.sections) {
    sections.push({ title: s.title, url: s.url, secs: s.secs, reader: s.reader, n: s.n })
  }
}

// 3. 우리 챕터 + head (미주 이상치는 content fetch 제외)
const { data: masters } = await db
  .from('library_chapters_master')
  .select('chapter_idx, word_count, content_hash')
  .eq('library_book_id', bookId)
  .order('chapter_idx', { ascending: true })
const wcs = masters.map((m) => m.word_count).sort((a, b) => a - b)
const median = wcs[Math.floor(wcs.length / 2)] ?? 0
const outlier = median > 0 ? median * 4 : Infinity
const lightHashes = masters.filter((m) => m.word_count <= outlier).map((m) => m.content_hash)
const headByHash = new Map()
if (lightHashes.length > 0) {
  const { data: chunks } = await db.from('content_chunks').select('hash, content').in('hash', lightHashes)
  for (const c of chunks ?? []) headByHash.set(c.hash, (c.content ?? '').slice(0, 200))
}
const chapters = masters.map((m) => ({
  chapter_idx: m.chapter_idx,
  word_count: m.word_count,
  head: headByHash.get(m.content_hash) ?? '',
}))

// 4. 빌드 (count-gate)
const result = buildChapterPartsMap(sections, chapters)
console.log(
  `[map] result: ok=${result.ok} lv_chapters=${result.lv_chapter_count} real_chapters=${result.real_chapter_count} mapped=${result.mapped_chapters} excluded=[${result.excluded_idx.join(',')}]`,
)
if (!result.ok) {
  console.error('ABORT:', result.reason)
  process.exit(1)
}
// 스팟 체크
const sample = [1, Math.ceil(result.mapped_chapters / 2), result.mapped_chapters]
for (const idx of sample) {
  const e = result.chapter_map[idx]
  if (e) console.log(`   idx ${idx} → Chapter ${e.roman} (${e.parts.length} parts, e.g. "${e.parts[0]?.title}")`)
}

if (!commit) {
  console.log('\n[dry-run] --commit 없음 → DB 미변경.')
  process.exit(0)
}

// 5. 저장
const v0 = volumes[0]
const saved = {
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
  saved_by: null,
  sections: [],
}
const { error: upErr } = await db.from('library_books').update({ librivox_audio: saved }).eq('id', bookId)
if (upErr) {
  console.error('save failed:', upErr.message)
  process.exit(1)
}
console.log(`\n[done] librivox_audio 저장: mode=chapter_parts, ${result.mapped_chapters}챕터, ${volumes.length}권 통합.`)
