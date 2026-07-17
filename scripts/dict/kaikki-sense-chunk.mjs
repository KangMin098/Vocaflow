// scripts/dict/kaikki-sense-chunk.mjs
// sense 깊이 확대 — kaikki 영어 gloss를 '근거'로, 우리 사전이 얕은(≤2 sense) 노출 다의어에 sense 추가.
//   대상: 추출대상 · meanings_ko 길이 ≤ MAXCUR · kaikki senses ≥ MINK · freq_rank ≤ MAXRANK.
//   kaikki JSONL(3.19GB) 재스트림 → 대상 단어의 표준 sense(gloss+pos, obsolete/archaic/rare tag 제외)만 추출 → 청크.
//   서브에이전트가 현 한국어 sense + kaikki 영어 gloss를 근거로 완전한 meanings_ko(한국어·per-sense pos/v_level) authoring.
// 실행: node scripts/dict/kaikki-sense-chunk.mjs --out scripts/dict/ksense-p1 --max-rank 3000 --limit 800 --chunk 160
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const OUT = arg('--out', 'scripts/dict/ksense-p1')
const MAXRANK = parseInt(arg('--max-rank', '3000'), 10)
const MINRANK = parseInt(arg('--min-rank', '0'), 10)
const MAXCUR = parseInt(arg('--max-cur', '2'), 10)
const MINK = parseInt(arg('--min-k', '3'), 10)
const LIMIT = process.argv.indexOf('--limit') >= 0 ? parseInt(arg('--limit', '0'), 10) : null
const CHUNK = parseInt(arg('--chunk', '160'), 10)
const SRC = 'scripts/dict/data/kaikki-en-words.jsonl'
const MAP = 'scripts/dict/data/kaikki-enrich.json'
const EXC = new Set(['archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun'])
const SKIP_TAG = /obsolete|archaic|dialectal|rare|dated|historical|nonstandard|slang|dialect/i
// 형태-포인터 글로스(실제 뜻 아님) — 약어·이형·굴절 지시
const FORM_PTR = /^(Abbreviation|Initialism|Acronym|Clipping|Alternative (form|spelling)|Alt form|Misspelling|Obsolete|Archaic|plural of|past (tense|participle) of|present participle of|singular of|comparative of|superlative of|inflection of|synonym of|Symbol|Contraction|Ellipsis|Eye dialect|Nonstandard|Only used in|Used )/i
const POS_MAP = { verb: 'verb', noun: 'noun', adj: 'adjective', adv: 'adverb' }

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })
const kmap = JSON.parse(fs.readFileSync(MAP, 'utf8'))

// 굴절형 제외 집합 (다른 표제어의 inflected_forms)
const inflForms = new Set()
{
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary').select('word, inflected_forms').gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) if (Array.isArray(r.inflected_forms)) for (const f of r.inflected_forms) inflForms.add((f || '').toLowerCase())
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}

// 1) 대상 단어 집합 (DB)
const cur = new Map() // word → {meanings, rank}
{
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, meanings_ko, frequency_rank, word_register').not('classified_by', 'is', null).not('v_level', 'is', null)
      .gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      if (EXC.has(r.word_register || 'standard')) continue
      const w = r.word.toLowerCase()
      if (w.length < 3 || inflForms.has(w)) continue // 약어/단자어·굴절형 제외
      const nCur = Array.isArray(r.meanings_ko) ? r.meanings_ko.length : 0
      const nK = kmap[w]?.senses ?? 0
      if (nCur <= MAXCUR && nK >= MINK && r.frequency_rank != null && r.frequency_rank > MINRANK && r.frequency_rank <= MAXRANK) {
        cur.set(w, { meanings: r.meanings_ko || [], rank: r.frequency_rank })
      }
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
}
console.log(`targets: ${cur.size} (shallow≤${MAXCUR}, kaikki≥${MINK}, rank≤${MAXRANK})`)

// 2) kaikki 재스트림 → 대상 단어 표준 sense(gloss+pos) 수집
const ksenses = new Map() // word → [{pos, gloss}]
{
  const rl = readline.createInterface({ input: fs.createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity })
  let lines = 0
  for await (const line of rl) {
    lines++; if (lines % 500000 === 0) process.stderr.write(`\r  scan ${lines}`)
    if (!line) continue
    let o; try { o = JSON.parse(line) } catch { continue }
    const w = (o.word || '').toLowerCase()
    if (!cur.has(w)) continue
    const pos = POS_MAP[o.pos]; if (!pos) continue // content POS만
    const rec = ksenses.get(w) ?? { arr: [], seen: new Set() }
    for (const s of (o.senses || [])) {
      const tags = (s.tags || []).join(' ')
      if (SKIP_TAG.test(tags)) continue
      // leaf gloss(중첩 sense의 최종 정의). 헤더("...:")·과장 제외.
      const gs = Array.isArray(s.glosses) && s.glosses.length ? s.glosses
        : (Array.isArray(s.raw_glosses) ? s.raw_glosses : [])
      const g = gs.length ? gs[gs.length - 1] : null
      if (!g || typeof g !== 'string' || g.length > 200) continue
      const t = g.trim()
      if (!t || t.endsWith(':') || FORM_PTR.test(t) || rec.seen.has(t.toLowerCase())) continue
      rec.seen.add(t.toLowerCase())
      rec.arr.push({ pos, gloss: t })
      if (rec.arr.length >= 8) break // 단어당 최대 8 후보
    }
    if (rec.arr.length) ksenses.set(w, rec)
  }
  process.stderr.write('\n')
}

// 3) 청크 구성
let targets = [...cur.entries()]
  .filter(([w]) => ksenses.has(w) && ksenses.get(w).arr.length >= 3) // 형태-포인터 제외 후 실 sense ≥3
  .map(([w, v]) => ({
    word: w, rank: v.rank,
    current: (v.meanings || []).map((s) => ({ pos: s.pos, meaning: s.meaning })),
    kaikki: ksenses.get(w).arr.slice(0, 6),
  }))
  .sort((a, b) => a.rank - b.rank)
if (LIMIT != null) targets = targets.slice(0, LIMIT)

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (/^chunk-\d+\.json$/.test(f)) fs.rmSync(path.join(OUT, f))
let idx = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  fs.writeFileSync(path.join(OUT, `chunk-${String(idx).padStart(2, '0')}.json`), JSON.stringify(targets.slice(i, i + CHUNK), null, 1))
  idx++
}
console.log(`chunks: ${idx} × ~${CHUNK} (${targets.length} words w/ kaikki senses) → ${OUT}`)
