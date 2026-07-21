// scripts/dict/cmudict-enrich.mjs
// CMU Pronouncing Dictionary (Carnegie Mellon — 상업 무제한·PD/BSD) → shared_dictionary 발음 컬럼 교체.
//   목적: kaikki(Wiktionary, CC BY-SA) 유래 ipa/homophones/rhyme_key 를 상업-청정 CMUdict 로 교체.
//   WordNet 이 못 하는 발음 계열(WordNet Phase 2). 설계: docs/proposals/wordnet-replacement-design.md
//
// 파이프라인 (wordnet-enrich.mjs 패턴 정합):
//   extract : cmudict.dict 파싱 → word→{ipa, rhyme} + homophone 그룹 → data/cmudict/cmudict-enrich.json
//   apply-<f|all> [--commit] [--provenance] : f ∈ ipa|rhyme|homophones|all
//     ipa=교체+잔여flag · rhyme_key/homophones=교체+잔여purge(kaikki 전용)
//
// 실행:
//   node scripts/dict/cmudict-enrich.mjs extract
//   node scripts/dict/cmudict-enrich.mjs apply-all              # dry-run
//   node scripts/dict/cmudict-enrich.mjs apply-all --commit --provenance

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '../..')
const envPath = path.join(ROOT, 'apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const MODE = process.argv[2] || ''
const COMMIT = process.argv.includes('--commit')
const STAMP = process.argv.includes('--provenance')
const PROV = process.env.CMUDICT_PROVENANCE || 'cmudict-0.7b'

const CMU_DIR = path.join(ROOT, 'scripts/dict/data/cmudict')
const SRC = path.join(CMU_DIR, 'cmudict.dict')
const MAP_PATH = path.join(CMU_DIR, 'cmudict-enrich.json')

// ARPAbet → IPA (General American). 강세숫자는 별도 처리.
const VOWEL = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'])
const IPA_V = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u' }
const IPA_C = { B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' }

// phoneme 배열(스트레스 숫자 포함) → IPA 문자열(강세 마커 ˈ ˌ 포함)
function toIpa(phones) {
  let out = ''
  for (const p of phones) {
    const base = p.replace(/\d$/, '')
    const stress = /(\d)$/.test(p) ? p.slice(-1) : null
    if (VOWEL.has(base)) {
      let v = IPA_V[base] || ''
      if (base === 'AH' && stress === '0') v = 'ə'
      if (base === 'ER' && stress === '0') v = 'ɚ'
      out += (stress === '1' ? 'ˈ' : stress === '2' ? 'ˌ' : '') + v
    } else {
      out += IPA_C[base] || ''
    }
  }
  return out
}

// rhyme_key: 마지막 primary-stress(1) 모음부터 끝까지 IPA, '-' 접두 (kaikki 포맷 정합)
function toRhyme(phones) {
  let idx = -1
  for (let i = 0; i < phones.length; i++) if (/1$/.test(phones[i]) && VOWEL.has(phones[i].replace(/\d$/, ''))) idx = i
  if (idx < 0) for (let i = 0; i < phones.length; i++) if (VOWEL.has(phones[i].replace(/\d$/, ''))) { idx = i; break }
  if (idx < 0) return null
  const tail = phones.slice(idx).map((p) => p.replace(/[12]$/, '0')) // 강세 마커 없이
  return '-' + toIpa(tail)
}

async function extract() {
  if (!fs.existsSync(SRC)) { console.error(`✗ CMUdict 없음: ${SRC}`); process.exit(1) }
  const rl = readline.createInterface({ input: fs.createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity })
  const wordPhones = new Map()   // word → phones[] (첫 발음만, 주 표제어)
  const byPhon = new Map()       // 무강세 음소열 → Set(word) (homophone 그룹)
  for await (const line of rl) {
    if (!line || line.startsWith(';;;')) continue
    const hashIdx = line.indexOf(' #'); const clean = hashIdx >= 0 ? line.slice(0, hashIdx) : line
    const parts = clean.trim().split(/\s+/)
    if (parts.length < 2) continue
    let word = parts[0].toLowerCase()
    const variant = /\(\d\)$/.test(word)
    word = word.replace(/\(\d\)$/, '')
    if (!/^[a-z][a-z'-]*[a-z]$/.test(word)) continue
    const phones = parts.slice(1)
    if (!variant && !wordPhones.has(word)) wordPhones.set(word, phones)
    // homophone: 무강세 음소열 기준
    const key = phones.map((p) => p.replace(/\d$/, '')).join(' ')
    if (!byPhon.has(key)) byPhon.set(key, new Set())
    byPhon.get(key).add(word)
  }

  const obj = Object.create(null)
  let nIpa = 0, nRhyme = 0, nHom = 0
  for (const [word, phones] of wordPhones) {
    const ipa = toIpa(phones)
    const rhyme = toRhyme(phones)
    const key = phones.map((p) => p.replace(/\d$/, '')).join(' ')
    const hom = [...(byPhon.get(key) || [])].filter((w) => w !== word).slice(0, 8)
    obj[word] = { ipa: ipa ? `/${ipa}/` : null, rhyme, hom }
    if (ipa) nIpa++; if (rhyme) nRhyme++; if (hom.length) nHom++
  }
  fs.mkdirSync(CMU_DIR, { recursive: true })
  fs.writeFileSync(MAP_PATH, JSON.stringify(obj))
  console.log(`extracted: ${Object.keys(obj).length} words → ${MAP_PATH}`)
  console.log(`  ipa ${nIpa} · rhyme ${nRhyme} · homophones ${nHom}`)
}

// ── apply ──
const POLICY = {
  ipa:        { key: 'ipa',   mode: 'overwrite',      type: 'text' },
  rhyme_key:  { key: 'rhyme', mode: 'overwritePurge', type: 'text' },
  homophones: { key: 'hom',   mode: 'overwritePurge', type: 'array' },
}
const KEY2COL = { ipa: 'ipa', rhyme: 'rhyme_key', hom: 'homophones' }
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function q(fn, n = 6) {
  let last
  for (let i = 0; i < n; i++) {
    try { const r = await fn(); if (!r || !r.error) return r; last = r.error } catch (e) { last = e }
    await sleep(400 * (i + 1))
  }
  return { error: last }
}

async function apply(fieldsArg) {
  if (!fs.existsSync(MAP_PATH)) { console.error(`✗ 맵 없음: ${MAP_PATH} — 먼저 'extract'`); process.exit(1) }
  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'))
  const cols = fieldsArg === 'all' ? Object.keys(POLICY) : [KEY2COL[fieldsArg] || fieldsArg]
  if (cols.some((c) => !POLICY[c])) { console.error(`✗ 알 수 없는 필드: ${cols}`); process.exit(1) }

  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const stat = Object.fromEntries(cols.map((c) => [c, { overwrite: 0, purge: 0, flag: 0 }]))
  let scanned = 0, committed = 0
  const selCols = 'word,' + [...new Set(cols)].join(',') + (STAMP && COMMIT ? ',field_provenance' : '')
  const CONC = 8
  let cursor = ''
  for (;;) {
    const { data, error } = await q(() => db.from('shared_dictionary').select(selCols).gt('word', cursor).order('word').limit(1000))
    if (error) { console.error('select 오류:', error.message || error); process.exit(1) }
    if (!data || !data.length) break
    const ops = []
    for (const row of data) {
      scanned++
      const cm = map[row.word]
      const upd = {}
      const prov = (STAMP && COMMIT) ? { ...(row.field_provenance || {}) } : null
      for (const col of cols) {
        const p = POLICY[col]
        const val = cm ? cm[p.key] : null
        const has = p.type === 'array' ? (Array.isArray(val) && val.length > 0) : !!val
        const cur = row[col]
        const curHas = p.type === 'array' ? (Array.isArray(cur) && cur.length > 0) : !!cur
        if (has) {
          const same = p.type === 'array' ? eqArr(cur, val) : cur === val
          if (!same) { upd[col] = val; if (prov) prov[col] = PROV; stat[col].overwrite++ }
        } else if (p.mode === 'overwritePurge') {
          if (curHas) { upd[col] = null; if (prov) prov[col] = 'cleared'; stat[col].purge++ }
        } else if (curHas && prov && prov[col] !== 'kaikki-unverified') { prov[col] = 'kaikki-unverified'; stat[col].flag++ }
      }
      const changed = Object.keys(upd).length > 0
      if (!changed && !(prov && JSON.stringify(prov) !== JSON.stringify(row.field_provenance || {}))) continue
      if (COMMIT) { if (prov) upd.field_provenance = prov; ops.push({ word: row.word, upd }) }
    }
    for (let i = 0; i < ops.length; i += CONC) {
      const slice = ops.slice(i, i + CONC)
      const res = await Promise.all(slice.map((o) => q(() => db.from('shared_dictionary').update(o.upd).eq('word', o.word))))
      res.forEach((r, k) => { if (r.error) console.error(`update 실패 ${slice[k].word}:`, r.error.message || r.error); else committed++ })
    }
    cursor = data[data.length - 1].word
    if (scanned % 10000 < 1000) console.log(`  scan ${scanned}${COMMIT ? ` · committed ${committed}` : ''}`)
  }
  console.log(`\n${COMMIT ? 'APPLIED' : 'DRY-RUN'}${STAMP ? ' +provenance' : ''} — scanned ${scanned}${COMMIT ? ` · committed ${committed}` : ' · (--commit 없어 미반영)'}`)
  for (const col of cols) {
    const s = stat[col]
    console.log(`  ${col.padEnd(12)} [${POLICY[col].mode}] overwrite ${s.overwrite} · purge ${s.purge} · flag ${s.flag}`)
  }
}

// ── dispatch ──
if (MODE === 'extract') await extract()
else if (MODE.startsWith('apply-')) await apply(MODE.slice('apply-'.length))
else {
  console.error('usage: cmudict-enrich.mjs extract | apply-{ipa|rhyme|homophones|all} [--commit] [--provenance]')
  process.exit(1)
}
