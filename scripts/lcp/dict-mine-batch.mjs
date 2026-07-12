// scripts/lcp/dict-mine-batch.mjs
//
// 도서 배치 채굴 — 사전 다의어 gap 후보 자동 수집 (5권씩 적재 → 추출 → 후보 dump → 삭제).
//   목적: **사전 품질만 개선**. 도서는 transient 테스트 코퍼스(추출 후 삭제 → 용량 절약).
//   후보 수리(어느 sense가 누락인지)는 Claude(=LLM) 수동 검토 — 스크립트는 후보만 모은다.
//
// 실행:
//   node scripts/lcp/dict-mine-batch.mjs --batches 5 [--count 5] [--out scripts/lcp/data/mine-candidates.json]
//
//   각 배치: (1) 미채굴 SE seed N개 pick + library_books INSERT (genre 다양성 위해 random)
//            (2) reprocess-all-se.mjs --ids 적재 (fetch+segment+winkNLP)
//            (3) select_book_chapter_vocab 집계 → 단일-sense 고빈도 추출 단어 후보 수집
//            (4) 도서 데이터 삭제 + seed curation_meta.dict_mined 마킹
//   출력: 누적 후보 JSON (word별 dedup, 등장 도서수 합산) — Claude가 검토 후 실 gap 수리.
//
// 안전: admin_enqueue_book는 is_admin_or_curator 가드라 여기선 직접 INSERT(service role).
//       reprocess-all-se가 DELETE→INSERT 단일 트랜잭션이라 적재 실패해도 기존 데이터 보존.
//       삭제는 채굴한 이 배치 도서만(id 지정).

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : def
}
const COUNT = parseInt(arg('--count', '5'), 10)
const BATCHES = parseInt(arg('--batches', '1'), 10)
const OUT = arg('--out', 'scripts/lcp/data/mine-candidates.json')
const FREQ_CAP = parseInt(arg('--freq-cap', '8000'), 10)

const { createClient } = await import('@supabase/supabase-js')
const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// 누적 후보 로드 — 최종 write가 정렬 배열이라 array/object 양쪽 정규화(word 키 dedup·books 합산)
let candidates = {}
if (fs.existsSync(OUT)) {
  try {
    const raw = JSON.parse(fs.readFileSync(OUT, 'utf8'))
    const list = Array.isArray(raw) ? raw : Object.values(raw)
    for (const c of list) {
      if (!c || !c.word) continue
      const e = candidates[c.word]
      if (e) e.books += c.books ?? 0
      else candidates[c.word] = { word: c.word, pos: c.pos, gloss: c.gloss, rank: c.rank, books: c.books ?? 0 }
    }
  } catch { candidates = {} }
}

async function pickAndInsert(n) {
  // 미채굴 SE seed pool → 클라이언트측 random N (genre 다양성).
  const { data } = await db.from('library_seed_catalog')
    .select('source_id, title, author, author_birth_year, author_death_year, curation_meta, imported_to_books')
    .eq('source', 'standard_ebooks').eq('language', 'en')
    .limit(600)
  const avail = (data ?? []).filter((s) =>
    s.source_id && s.title && s.imported_to_books !== true && !(s.curation_meta && s.curation_meta.dict_mined === true))
  // Fisher-Yates shuffle (Math.random OK in Node)
  for (let i = avail.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [avail[i], avail[j]] = [avail[j], avail[i]] }
  const picks = avail.slice(0, n)
  const rows = []
  for (const p of picks) {
    // 이미 library_books에 있으면 skip
    const { data: exist } = await db.from('library_books').select('id')
      .eq('source', 'standard_ebooks').eq('source_id', p.source_id).limit(1)
    if (exist && exist.length) continue
    const { data: ins, error: ie } = await db.from('library_books').insert({
      source: 'standard_ebooks', source_id: p.source_id, title: p.title, author: p.author ?? null,
      author_birth_year: p.author_birth_year ?? null, author_death_year: p.author_death_year ?? null,
      license: 'PD-US', status: 'queued',
    }).select('id, source_id, title').single()
    if (ie) { console.warn(`  insert skip ${p.source_id}: ${ie.message}`); continue }
    rows.push(ins)
  }
  return rows
}

function ingest(ids) {
  const r = spawnSync('pnpm', ['dlx', 'tsx', 'scripts/lcp/reprocess-all-se.mjs', '--commit', '--ids', ids.join(',')],
    { stdio: 'inherit', shell: process.platform === 'win32' })
  return r.status === 0
}

async function collectCandidates(books) {
  for (const b of books) {
    const { data: rows, error } = await db.rpc('select_book_chapter_vocab', { p_book_id: b.id })
    if (error || !rows) continue
    const perWord = new Map() // word → chapters(distinct via sort_order<=40)
    for (const r of rows) {
      if (r.sort_order > 40) continue
      perWord.set(r.word, (perWord.get(r.word) ?? 0) + 1)
    }
    if (perWord.size === 0) continue
    const words = [...perWord.keys()]
    // shared_dictionary 조회 (500 청크)
    for (let i = 0; i < words.length; i += 500) {
      const { data: dict } = await db.from('shared_dictionary')
        .select('word, pos, meaning_ko, meanings_ko, frequency_rank')
        .in('word', words.slice(i, i + 500))
      for (const d of dict ?? []) {
        const senses = Array.isArray(d.meanings_ko) ? d.meanings_ko.length : 0
        if (senses !== 1) continue // 단일-sense만 (gap 고수율)
        if (d.frequency_rank != null && d.frequency_rank > FREQ_CAP) continue
        const c = candidates[d.word] ?? { word: d.word, pos: d.pos, gloss: d.meaning_ko, rank: d.frequency_rank, books: 0 }
        c.books += perWord.get(d.word) ?? 1
        candidates[d.word] = c
      }
    }
  }
}

async function cleanup(books) {
  const ids = books.map((b) => b.id)
  const srcIds = books.map((b) => b.source_id)
  for (const t of ['library_book_vocabularies', 'library_chapters_master']) {
    await db.from(t).delete().in('library_book_id', ids)
  }
  await db.from('book_curation_jobs').delete().in('book_id', ids)
  await db.from('library_books').delete().in('id', ids)
  // seed 마킹 (curation_meta.dict_mined) — 개별 update (jsonb merge)
  for (const sid of srcIds) {
    const { data: s } = await db.from('library_seed_catalog').select('id, curation_meta').eq('source_id', sid).limit(1)
    if (s && s.length) {
      const meta = { ...(s[0].curation_meta ?? {}), dict_mined: true }
      await db.from('library_seed_catalog').update({ curation_meta: meta }).eq('id', s[0].id)
    }
  }
}

console.log(`[dict-mine] ${BATCHES} batches × ${COUNT} books · out=${OUT}`)
for (let bi = 0; bi < BATCHES; bi++) {
  console.log(`\n===== batch ${bi + 1}/${BATCHES} =====`)
  const books = await pickAndInsert(COUNT)
  if (books.length === 0) { console.log('  no more unmined seeds — done.'); break }
  console.log(`  picked: ${books.map((b) => b.title).join(' | ')}`)
  const ok = ingest(books.map((b) => b.id))
  if (!ok) console.warn('  ⚠ ingest returned non-zero (일부 skip 가능) — 추출은 성공분만')
  await collectCandidates(books)
  await cleanup(books)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(candidates, null, 2))
  console.log(`  candidates so far: ${Object.keys(candidates).length} (cleaned up ${books.length} books)`)
}
// 최종: 정규 객체(word 키) 저장 — 다음 run 재로드 안전. 정렬은 콘솔 표시용만.
fs.writeFileSync(OUT, JSON.stringify(candidates, null, 2))
const sorted = Object.values(candidates).sort((a, b) => b.books - a.books)
console.log(`\n[dict-mine] done. ${sorted.length} candidate words → ${OUT}`)
console.log('Top 20:', sorted.slice(0, 20).map((c) => `${c.word}(${c.books})`).join(', '))
