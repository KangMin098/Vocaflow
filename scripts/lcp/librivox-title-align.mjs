// scripts/lcp/librivox-title-align.mjs
//
// LibriVox 다권 낭독 ↔ 도서 챕터 STRUCTURAL 매핑 (볼륨/북/챕터 번호 기반).
// buildChapterPartsMap(Roman count-gate) 가 실패하는 SE 다권 도서용 —
//   섹션 제목이 "Bk NN Ch NN[: title]" / "Bk NN Ch NN-MM"(합본) 형식이고,
//   권마다 제목 유무가 달라(예: Les Mis Vol2 제목有 · Vol3-5 번호만) 제목매칭 불가.
// 해결: LibriVox "Volume V / Bk B / Ch C" 번호를 도서의 (V번째 볼륨, B번째 북, C번째 챕터)
//   구조에 결정적으로 정렬. 합본 섹션("Ch 01-04")은 해당 범위 챕터 전부가 그 오디오를 가리킴.
//   매핑 안 되는 도서 챕터는 제외(LibriVox 없음 → 리더 TTS fallback).
//
// 실행: npx tsx scripts/lcp/librivox-title-align.mjs <book_id> [--commit]

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
  console.error('usage: npx tsx scripts/lcp/librivox-title-align.mjs <book_id> [--commit]')
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

// "...Volume N" → N
function volNumOfTitle(t) {
  const m = String(t || '').match(/Volume\s+(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}
// 권마다 형식 차이 흡수:
//   "Bk 01 Ch 03: T" · "Bk 01, ch. 01: T"(콤마+소문자) · "Bk 1 Ch 1-4"(합본 범위)
function parseBkCh(t) {
  const s = String(t || '').replace(/<\/?[a-z]+>/gi, ' ')
  const m = s.match(
    /Bk\.?\s*(\d+)\s*[,.]?\s*Ch\.?\s*(\d+)(?:\s*(?:[-–]|to)\s*(?:ch\.?\s*)?(\d+))?/i,
  )
  if (!m) return null
  return {
    bk: parseInt(m[1], 10),
    chStart: parseInt(m[2], 10),
    chEnd: m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10),
  }
}
const volName = (g) => String(g || '').split('›')[0].trim()
const bookName = (g) => {
  const p = String(g || '').split('›')
  return (p[1] || p[0] || '').trim()
}
// 제목 정규화 — "Bk/Ch NN:" 접두 + 구두점/기능어 제거 (철자·악센트·하이픈 차이 흡수).
const STOP = new Set(['the', 'a', 'an', 'to', 'from', 'of', 'on', 'in', 'at', 'with', 'is', 'and', 'for', 'his', 'her', 'its', 'he', 'she', 'it'])
const normT = (t) =>
  String(t || '')
    .replace(/<\/?[a-z]+>/gi, ' ')
    .replace(/^.*?(?:[,.]?\s*Ch\.?\s*\d+(?:\s*(?:[-–]|to)\s*(?:ch\.?\s*)?\d+)?)\s*[:.\-]?\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(' ')
    .trim()

const { data: bk } = await db
  .from('library_books')
  .select('id, source, source_id, title, author, chapter_count')
  .eq('id', bookId)
  .single()
console.log(`[align] ${bk.title} (${bk.source}/${bk.source_id}) chapters=${bk.chapter_count}`)

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
if (volumes.length === 0) {
  console.error('ABORT: LibriVox 낭독 없음')
  process.exit(1)
}
const lvVols = volumes.map((v) => ({
  volNum: volNumOfTitle(v.match.librivox_title),
  lvId: v.match.librivox_id,
  title: v.match.librivox_title,
  sections: v.audio.sections,
}))
console.log('[align] LibriVox 권:')
for (const v of lvVols) console.log(`   id=${v.lvId} volNum=${v.volNum} "${v.title}" secs=${v.sections.length}`)

// 2. 도서 구조 index — (volNum, bookNum, chNum) → chapter_idx
const { data: chs } = await db
  .from('library_chapters_master')
  .select('chapter_idx, group_label, chapter_title')
  .eq('library_book_id', bookId)
  .order('chapter_idx', { ascending: true })

const volNumByName = new Map()
for (const ch of chs) {
  const vn = volName(ch.group_label)
  if (!volNumByName.has(vn)) volNumByName.set(vn, volNumByName.size + 1)
}
const bookNumByKey = new Map() // `${volNum}|${bookName}` → bookNum (1-based within volume)
const booksSeenByVol = new Map()
const chCounter = new Map() // `${volNum}|${bookNum}` → running chapter count
const idxByVBC = new Map() // `${volNum}|${bookNum}|${chNum}` → chapter_idx
const vbcByIdx = new Map() // chapter_idx → { volNum, bookNum }
for (const ch of chs) {
  const vn = volNumByName.get(volName(ch.group_label))
  const bn = bookName(ch.group_label)
  const bkey = `${vn}|${bn}`
  if (!bookNumByKey.has(bkey)) {
    const arr = booksSeenByVol.get(vn) ?? []
    arr.push(bn)
    booksSeenByVol.set(vn, arr)
    bookNumByKey.set(bkey, arr.length)
  }
  const bookNum = bookNumByKey.get(bkey)
  const ckey = `${vn}|${bookNum}`
  const cc = (chCounter.get(ckey) ?? 0) + 1
  chCounter.set(ckey, cc)
  idxByVBC.set(`${vn}|${bookNum}|${cc}`, ch.chapter_idx)
  vbcByIdx.set(ch.chapter_idx, { volNum: vn, bookNum })
}

// 3. STRUCTURAL 매핑
const chapterMap = {}
const secsByVB = new Map() // `${volNum}|${bk}` → [part] (제목 보정용)
let matched = 0
let sectionsParsed = 0
let sectionsSkipped = 0
for (const vol of lvVols) {
  if (vol.volNum == null) {
    console.warn(`   ⚠ volNum 미파싱 — 권 ${vol.lvId} 스킵`)
    continue
  }
  for (const s of vol.sections) {
    if (!s.url || !s.url.includes('archive.org')) continue
    const p = parseBkCh(s.title)
    if (!p) {
      sectionsSkipped += 1
      continue
    }
    sectionsParsed += 1
    const part = { n: s.n, title: s.title, url: s.url, secs: s.secs ?? null, reader: s.reader ?? null }
    const vbKey = `${vol.volNum}|${p.bk}`
    if (!secsByVB.has(vbKey)) secsByVB.set(vbKey, [])
    secsByVB.get(vbKey).push(part)
    for (let c = p.chStart; c <= p.chEnd; c++) {
      const idx = idxByVBC.get(`${vol.volNum}|${p.bk}|${c}`)
      if (idx == null) continue
      if (chapterMap[idx]) continue // first wins
      chapterMap[idx] = { roman: 0, parts: [part] }
      matched += 1
    }
  }
}

// 3a. 제목 보정 — 같은 (volume, book) 그룹 내 섹션 제목이 도서 챕터 제목과 일치하면
//     구조 매핑을 제목 매칭으로 덮어씀 (국소 off-by-one 자동 교정 · 제목 없는 권은 구조 유지).
let overrides = 0
for (const ch of chs) {
  const vbc = vbcByIdx.get(ch.chapter_idx)
  if (!vbc) continue
  const groupSecs = secsByVB.get(`${vbc.volNum}|${vbc.bookNum}`)
  if (!groupSecs) continue
  const bookT = normT(ch.chapter_title)
  if (!bookT) continue
  const hit = groupSecs.find((part) => {
    const st = normT(part.title)
    return st && (st === bookT || st.includes(bookT) || bookT.includes(st))
  })
  if (!hit) continue
  const cur = chapterMap[ch.chapter_idx]
  if (cur && cur.parts[0].url === hit.url) continue
  if (!cur) matched += 1
  chapterMap[ch.chapter_idx] = { roman: 0, parts: [hit] }
  overrides += 1
}

// roman seq = chapter_idx 순서
let seq = 0
for (const idx of Object.keys(chapterMap).map(Number).sort((a, b) => a - b)) {
  seq += 1
  chapterMap[idx].roman = seq
}
const unmatched = chs.filter((c) => !chapterMap[c.chapter_idx]).map((c) => c.chapter_idx)

// 3b. 정확성 교차검증 — 섹션 제목에 챕터 제목이 있는 경우 도서 챕터 제목과 정규화 비교.
//     매핑이 옳다면 제목도 일치해야 함 (제목 있는 섹션 한정).
const chTitleByIdx = new Map(chs.map((c) => [c.chapter_idx, c.chapter_title]))
let titleChecked = 0
let titleAgree = 0
const titleDisagrees = []
for (const idx of Object.keys(chapterMap).map(Number)) {
  const secTitle = chapterMap[idx].parts[0].title
  const secT = normT(secTitle)
  if (!secT) continue // 제목 없는 섹션(번호만) — 검증 불가
  titleChecked += 1
  const bookT = normT(chTitleByIdx.get(idx))
  if (secT === bookT || secT.includes(bookT) || bookT.includes(secT)) titleAgree += 1
  else if (titleDisagrees.length < 12) titleDisagrees.push({ idx, book: chTitleByIdx.get(idx), sec: secTitle })
}

// 4. 리포트
console.log('\n── 커버리지 (structural) ──')
console.log(`도서 챕터:        ${chs.length}`)
console.log(`섹션 파싱/스킵:   ${sectionsParsed} / skip ${sectionsSkipped} (front matter 등)`)
console.log(`매핑(오디오 有):  ${matched}  (${((matched / chs.length) * 100).toFixed(1)}%)`)
console.log(`제목 보정(override): ${overrides}`)
console.log(`미매핑(제외):     ${unmatched.length}`)
if (unmatched.length > 0) {
  console.log(`미매핑 idx 샘플:  ${unmatched.slice(0, 25).join(', ')}${unmatched.length > 25 ? ' …' : ''}`)
}
console.log('\n── 정확성 교차검증 (제목 있는 섹션 한정) ──')
console.log(
  `제목 비교:        ${titleAgree}/${titleChecked} 일치 (${titleChecked ? ((titleAgree / titleChecked) * 100).toFixed(1) : '0'}%)`,
)
if (titleDisagrees.length > 0) {
  console.log('불일치 샘플:')
  for (const d of titleDisagrees) console.log(`  #${d.idx} book="${d.book}" vs sec="${d.sec}"`)
}

if (!commit) {
  console.log('\n[dry-run] --commit 없음 → DB 미변경.')
  process.exit(0)
}

const v0 = volumes[0]
const saved = {
  librivox_id: v0.match.librivox_id,
  librivox_title: v0.match.librivox_title,
  librivox_url: v0.audio.librivox_url,
  archive_url: v0.audio.archive_url,
  total_secs: null,
  section_count: matched,
  consistency: 'multi',
  mode: 'chapter_parts',
  chapter_map: chapterMap,
  mapped_chapters: matched,
  volume_ids: volumes.map((v) => v.match.librivox_id),
  align_method: 'structural_vbc_v1',
  align_coverage: { chapters: chs.length, matched, unmatched: unmatched.length },
  saved_at: new Date().toISOString(),
  saved_by: null,
  sections: [],
}
const { error: upErr } = await db.from('library_books').update({ librivox_audio: saved }).eq('id', bookId)
if (upErr) {
  console.error('save failed:', upErr.message)
  process.exit(1)
}
await db
  .from('book_curation_jobs')
  .update({
    status: 'done',
    librivox_chapters: lvVols.map((v) => ({ lvId: v.lvId, volNum: v.volNum, secs: v.sections.length })),
    librivox_mapping: {
      method: 'structural_vbc_v1',
      mapped_chapters: matched,
      unmatched_idx: unmatched,
      volume_ids: volumes.map((v) => v.match.librivox_id),
    },
    note: `chapters=source-faithful(${chs.length}, 48 books/5 vols). librivox structural-map: ${matched}/${chs.length} 매핑, ${unmatched.length} 제외.`,
  })
  .eq('book_id', bookId)
console.log(`\n[done] librivox_audio 저장 (chapter_parts, ${matched}챕터) + job done.`)
