// scripts/lcp/librivox-dump.mjs
//
// 도서 소스 챕터 목록 + LibriVox 녹음(섹션) 목록을 파일로 덤프 — 정합 비교/진단용.
// 실행: pnpm dlx tsx scripts/lcp/librivox-dump.mjs <book_id>
//   → scripts/lcp/_dump-<short>.txt 에 두 목록을 기록 + 콘솔에 요약.

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
if (!bookId) {
  console.error('usage: tsx scripts/lcp/librivox-dump.mjs <book_id>')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { resolveLibriVoxAudioForBook, gutenbergIdFromStandardEbooks } = await import(
  '../../apps/web/src/lib/library/librivox-audio.ts'
)

const db = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL'],
  process.env['SUPABASE_SERVICE_ROLE_KEY'],
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const { data: bk } = await db
  .from('library_books')
  .select('id, source, source_id, title, author, chapter_count')
  .eq('id', bookId)
  .single()
if (!bk) {
  console.error('Book not found:', bookId)
  process.exit(1)
}

// 소스 챕터
const { data: masters } = await db
  .from('library_chapters_master')
  .select('chapter_idx, group_label, chapter_title')
  .eq('library_book_id', bookId)
  .order('chapter_idx', { ascending: true })

// LibriVox 권 + 섹션
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

const fmtSecs = (s) => {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

const lines = []
lines.push(`# ${bk.title}  (${bk.source}/${bk.source_id})`)
lines.push('')
lines.push(`===== 소스 챕터 (${(masters ?? []).length}) =====`)
let lastGroup = null
for (const m of masters ?? []) {
  if (m.group_label !== lastGroup) {
    lines.push('')
    lines.push(`  [${m.group_label ?? '(no group)'}]`)
    lastGroup = m.group_label
  }
  lines.push(`  ${String(m.chapter_idx).padStart(3, ' ')}  ${m.chapter_title ?? ''}`)
}

lines.push('')
const totalSec = volumes.reduce((n, v) => n + v.audio.sections.length, 0)
lines.push(`===== LibriVox 녹음 (${volumes.length}권 · ${totalSec}섹션) =====`)
for (const v of volumes) {
  lines.push('')
  lines.push(`  ▶ Vol id=${v.match.librivox_id}  "${v.match.librivox_title}"  (${v.audio.section_count}섹션, ${v.match.consistency})`)
  lines.push(`    ${v.audio.librivox_url}`)
  for (const s of v.audio.sections) {
    lines.push(`    ${String(s.n).padStart(3, ' ')}  ${(s.title ?? '').replace(/\s+/g, ' ')}   [${fmtSecs(s.secs)}·${s.reader ?? '—'}]`)
  }
}

const out = path.resolve(`scripts/lcp/_dump-${bookId.slice(0, 8)}.txt`)
fs.writeFileSync(out, lines.join('\n'), 'utf8')
console.log(`[dump] 소스 챕터 ${(masters ?? []).length} · LibriVox ${volumes.length}권 ${totalSec}섹션`)
console.log(`[dump] 파일: ${out}`)
