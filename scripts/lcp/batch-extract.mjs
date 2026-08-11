// scripts/lcp/batch-extract.mjs
//
// Standard Ebooks 대량 추출 러너 — 재개 가능·멱등·외부 서버 배려.
//
// 왜 별도 러너인가: reprocess-book.mjs 는 책 1권용 CLI 다. 1,000권 규모는
//   ① 중간에 끊겨도 이어져야 하고 ② 실패 1건이 전체를 멈추면 안 되고
//   ③ standardebooks.org 에 초당 요청을 몰아붙이면 안 된다.
//   그래서 얇은 오케스트레이터를 따로 둔다 — 파이프라인 로직은 재사용, 반복만 담당.
//
// 동작:
//   1) library_seed_catalog(standard_ebooks, imported_book_id IS NULL) 에서 N권 선택
//      — est_v_level 층화(stratified): 레벨이 한쪽으로 쏠리면 밴드 정책 검증이 안 된다.
//   2) library_books INSERT(queued) → reprocess-book.mjs 와 동일 파이프라인 인라인 실행
//   3) 성공 시 seed.imported_book_id 연결, 실패 시 status='failed' + 사유 기록 후 계속
//   4) 매 권 사이 DELAY_MS 대기 (기본 1500ms)
//
// 멱등: 이미 (source, source_id) 가 있는 책은 건너뛴다. 재실행하면 남은 것부터 이어간다.
//
// 실행:
//   node scripts/lcp/batch-extract.mjs [--limit N] [--delay MS] [--level 7,8] [--dry]
//
// 주의: LLM 0 (skipLlm=true). 어휘 추출 + 사전 lookup + heuristic CEFR 만.

import fs from 'node:fs'
import path from 'node:path'

// .env.local 로드 (패키지가 lazy 하게 읽으므로 정적 import 전에)
const envPath = path.resolve(process.cwd(), 'apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
  }
}

const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const LIMIT = parseInt(arg('limit', '20'), 10)
const DELAY_MS = parseInt(arg('delay', '1500'), 10)
const LEVELS = arg('level', '') ? arg('level', '').split(',').map((s) => parseInt(s, 10)) : null
const DRY = argv.includes('--dry')

const {
  ingestFromStandardEbooks,
  normalizeBook,
  segmentBook,
  analyzeBook,
  getServiceClient,
} = await import('@vocaflow/library-pipeline')

const sb = getServiceClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** est_v_level 층화 선택 — 레벨 쏠림은 밴드 정책 검증을 무의미하게 만든다. */
async function pickSeeds(limit) {
  const { data, error } = await sb
    .from('library_seed_catalog')
    .select('id, source_id, title, author, est_v_level')
    .eq('source', 'standard_ebooks')
    .is('imported_book_id', null)
    .order('popularity_rank', { ascending: true, nullsFirst: false })
    .limit(2000)
  if (error) throw new Error(`seed 조회 실패: ${error.message}`)

  const rows = (data ?? []).filter((r) => (LEVELS ? LEVELS.includes(r.est_v_level) : true))
  const byLevel = new Map()
  for (const r of rows) {
    const k = r.est_v_level ?? 0
    if (!byLevel.has(k)) byLevel.set(k, [])
    byLevel.get(k).push(r)
  }
  // 라운드로빈으로 레벨을 고르게 뽑는다
  const picked = []
  const keys = [...byLevel.keys()].sort((a, b) => a - b)
  let i = 0
  while (picked.length < limit) {
    let progressed = false
    for (const k of keys) {
      const list = byLevel.get(k)
      if (list.length > i) {
        picked.push(list[i])
        progressed = true
        if (picked.length >= limit) break
      }
    }
    if (!progressed) break
    i++
  }
  return picked
}

async function processOne(seed) {
  // 멱등 — 이미 있는 책은 건너뛴다
  const { data: existing } = await sb
    .from('library_books')
    .select('id, status')
    .eq('source', 'standard_ebooks')
    .eq('source_id', seed.source_id)
    .maybeSingle()

  let bookId = existing?.id ?? null

  if (!bookId) {
    const { data: ins, error: insErr } = await sb
      .from('library_books')
      .insert({
        source: 'standard_ebooks',
        source_id: seed.source_id,
        title: seed.title,
        author: seed.author,
        license: 'PD-US',
        status: 'queued',
      })
      .select('id')
      .single()
    if (insErr) throw new Error(`INSERT 실패: ${insErr.message}`)
    bookId = ins.id
  } else if (existing.status !== 'queued' && existing.status !== 'failed') {
    return { skipped: true, bookId }
  }

  // 시그니처는 reprocess-book.mjs 와 동일해야 한다 — normalize/segment 는 동기,
  // analyzeBook 은 (bookId, norm, chapters, opts). 처음에 (segmented, opts) 로 잘못 불러
  // 30권이 통째로 실패했다.
  const raw = await ingestFromStandardEbooks(seed.source_id)
  const norm = normalizeBook(raw)
  const chapters = segmentBook(norm)
  if (!chapters.length) throw new Error('0 chapters — 분절 실패')

  const result = await analyzeBook(bookId, norm, chapters, { skipLlm: true })

  const { error: upErr } = await sb
    .from('library_books')
    .update({
      word_count: result.word_count,
      chapter_count: result.chapter_count,
      reading_minutes: result.reading_minutes,
      status: 'ready',
      status_message: null,
    })
    .eq('id', bookId)
  if (upErr) throw new Error(`meta 갱신 실패: ${upErr.message}`)

  // 파생 지표 — 실패해도 추출 자체는 유효하므로 개별 허용
  for (const fn of ['backfill_book_lemmas', 'compute_book_vrl', 'compute_book_chapter_v_levels',
                    'compute_book_cefrj', 'compute_book_coverage']) {
    try { await sb.rpc(fn, { p_book_id: bookId }) } catch { /* best-effort */ }
  }

  await sb.from('library_seed_catalog').update({ imported_book_id: bookId }).eq('id', seed.id)

  return { bookId, chapters: result.chapter_count, vocab: result.words.length }
}

const seeds = await pickSeeds(LIMIT)
console.error(`[batch] 대상 ${seeds.length}권 (limit=${LIMIT} · delay=${DELAY_MS}ms · level=${LEVELS ?? 'all'})`)
if (DRY) {
  for (const s of seeds) console.error(`  V${s.est_v_level ?? '?'} ${s.source_id} — ${s.title}`)
  process.exit(0)
}

let ok = 0, skip = 0, fail = 0
const failures = []
for (const [idx, seed] of seeds.entries()) {
  const label = `${idx + 1}/${seeds.length} ${seed.source_id}`
  try {
    const r = await processOne(seed)
    if (r.skipped) { skip++; console.error(`  ⟳ ${label} (이미 처리됨)`) }
    else { ok++; console.error(`  ✓ ${label} — ch=${r.chapters} vocab=${r.vocab ?? '?'}`) }
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${seed.source_id} :: ${msg}`)
    console.error(`  ✗ ${label} — ${msg.slice(0, 120)}`)
    // 실패한 책은 status 를 남겨 다음 실행에서 재시도 대상이 되게 한다
    await sb.from('library_books')
      .update({ status: 'failed', status_message: msg.slice(0, 500) })
      .eq('source', 'standard_ebooks').eq('source_id', seed.source_id)
  }
  if (idx < seeds.length - 1) await sleep(DELAY_MS)
}

console.error(`\n[batch] 완료 — 성공 ${ok} · 건너뜀 ${skip} · 실패 ${fail}`)
if (failures.length) console.error(failures.slice(0, 20).join('\n'))
