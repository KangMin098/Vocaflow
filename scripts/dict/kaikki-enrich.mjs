// scripts/dict/kaikki-enrich.mjs
// kaikki(Wiktionary 파생, CC BY-SA) EN words JSONL → shared_dictionary 결측 필드 외부검증 보완.
//   sense/POS/IPA/synonyms/antonyms 는 자가생성이 아닌 '외부 사전'에서 사실을 가져옴(무환각).
//   커버리지 병목(W0 kaikki 부재)을 해소하는 근본 소스.
// 파이프라인:
//   extract : 3.19GB JSONL 스트림 → 45k 표제어만 필터 → {ipa, syn, ant, senseCount} 맵 → data/kaikki-enrich.json
//   apply-ipa : 맵의 IPA 로 shared_dictionary.ipa 결측 보완(멱등, --commit)
//   apply-syn / apply-ant : synonyms/antonyms 결측 보완(--commit)
// 실행: node scripts/dict/kaikki-enrich.mjs extract
//       node scripts/dict/kaikki-enrich.mjs apply-ipa [--commit]
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const MODE = process.argv[2]
const COMMIT = process.argv.includes('--commit')
const SRC = 'scripts/dict/data/kaikki-en-words.jsonl'
const MAP = 'scripts/dict/data/kaikki-enrich.json'
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const WORD_RE = /^[a-z][a-z'-]*[a-z]$/ // 단일 표제어(공백 없는)
const cleanIpa = (s) => (s || '').trim()

async function loadHeadwords() {
  const set = new Set()
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary').select('word').gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) set.add(r.word.toLowerCase())
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  return set
}

if (MODE === 'extract') {
  if (!fs.existsSync(SRC)) { console.error('missing', SRC); process.exit(1) }
  const heads = await loadHeadwords()
  console.log(`headwords: ${heads.size}`)
  const out = new Map() // word → {ipa, syn:Set, ant:Set, senses:int, audio}
  const rl = readline.createInterface({ input: fs.createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity })
  let lines = 0, matched = 0
  for await (const line of rl) {
    lines++
    if (lines % 500000 === 0) process.stderr.write(`\r  scanned ${lines} · matched ${matched}`)
    if (!line) continue
    let o; try { o = JSON.parse(line) } catch { continue }
    const w = (o.word || '').toLowerCase()
    if (!w || !heads.has(w)) continue
    matched++
    const e = out.get(w) ?? { ipa: null, syn: new Set(), ant: new Set(), senses: 0, audio: null }
    // IPA — sounds[].ipa 첫 유효값(General-American 우선)
    if (!e.ipa && Array.isArray(o.sounds)) {
      const ga = o.sounds.find((s) => s.ipa && (s.tags || []).some((t) => /General-American|US/i.test(t)))
      const any = o.sounds.find((s) => s.ipa)
      e.ipa = cleanIpa((ga || any)?.ipa) || e.ipa
    }
    if (!e.audio && Array.isArray(o.sounds)) {
      const au = o.sounds.find((s) => s.mp3_url || s.ogg_url)
      if (au) e.audio = au.mp3_url || au.ogg_url
    }
    for (const s of (o.synonyms || [])) { const x = (s.word || '').toLowerCase(); if (WORD_RE.test(x) && x !== w) e.syn.add(x) }
    for (const a of (o.antonyms || [])) { const x = (a.word || '').toLowerCase(); if (WORD_RE.test(x) && x !== w) e.ant.add(x) }
    e.senses += Array.isArray(o.senses) ? o.senses.length : 0
    out.set(w, e)
  }
  process.stderr.write('\n')
  const obj = {}
  for (const [w, e] of out) obj[w] = { ipa: e.ipa || null, syn: [...e.syn].slice(0, 8), ant: [...e.ant].slice(0, 8), senses: e.senses, audio: e.audio || null }
  fs.writeFileSync(MAP, JSON.stringify(obj))
  const withIpa = Object.values(obj).filter((x) => x.ipa).length
  const withSyn = Object.values(obj).filter((x) => x.syn.length).length
  const withAnt = Object.values(obj).filter((x) => x.ant.length).length
  console.log(`extracted: ${Object.keys(obj).length} words (of ${matched} entries, ${lines} lines) · ipa ${withIpa} · syn ${withSyn} · ant ${withAnt} → ${MAP}`)
  process.exit(0)
}

if (MODE === 'apply-ipa' || MODE === 'apply-syn' || MODE === 'apply-ant') {
  if (!fs.existsSync(MAP)) { console.error('run extract first —', MAP); process.exit(1) }
  const map = JSON.parse(fs.readFileSync(MAP, 'utf8'))
  const field = MODE === 'apply-ipa' ? 'ipa' : MODE === 'apply-syn' ? 'synonyms' : 'antonyms'
  const key = MODE === 'apply-ipa' ? 'ipa' : MODE === 'apply-syn' ? 'syn' : 'ant'
  // 결측 대상만 조회(페이지네이션)
  const targets = []
  let cursor = ''
  for (;;) {
    const sel = field === 'ipa' ? 'word, ipa' : `word, ${field}`
    const { data, error } = await db.from('shared_dictionary').select(sel).gt('word', cursor).order('word').limit(1000)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data.length) break
    for (const r of data) {
      const cur = field === 'ipa' ? (r.ipa && r.ipa.trim()) : (Array.isArray(r[field]) && r[field].length)
      if (cur) continue // 이미 있음
      const val = map[r.word.toLowerCase()]?.[key]
      if (field === 'ipa' ? (val && val.trim()) : (Array.isArray(val) && val.length)) targets.push({ word: r.word, val: field === 'ipa' ? val.trim() : val })
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  console.log(`${MODE}: ${targets.length} rows to fill from kaikki`)
  if (!COMMIT) { console.log('DRY-RUN. 샘플:', targets.slice(0, 12).map((t) => t.word + '→' + JSON.stringify(t.val)).join(' · ')); process.exit(0) }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let done = 0, failed = 0
  const CONC = 12
  const apply = async (t) => {
    for (let k = 0; k < 4; k++) {
      const { error } = await db.from('shared_dictionary').update({ [field]: t.val }).eq('word', t.word)
      if (!error) { done++; return }
      await sleep(300 * (k + 1))
    }
    failed++
  }
  for (let i = 0; i < targets.length; i += CONC) {
    await Promise.all(targets.slice(i, i + CONC).map(apply))
    if ((i + CONC) % 3000 < CONC) console.log(`  ${Math.min(i + CONC, targets.length)}/${targets.length} (failed ${failed})`)
  }
  console.log(`done. filled ${done}, failed ${failed}`)
  process.exit(0)
}

console.error('usage: kaikki-enrich.mjs extract | apply-ipa | apply-syn | apply-ant [--commit]')
process.exit(1)
