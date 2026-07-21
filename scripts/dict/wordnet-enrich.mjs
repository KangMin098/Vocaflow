// scripts/dict/wordnet-enrich.mjs
// WordNet(Princeton 3.1 WNDB / OEWN — 퍼미시브·CC BY, share-alike 없음) → shared_dictionary 관계·예문 컬럼 대체.
//   목적: kaikki(Wiktionary, CC BY-SA) 유래 synonyms/antonyms/derived_forms/related_terms/example_en 를
//         상업-청정 WordNet 값으로 교체(+ 노이즈 제거). meaning_ko/단어목록은 무변경.
//   설계: docs/proposals/wordnet-replacement-design.md
//
// 파이프라인 (kaikki-enrich.mjs 패턴 정합):
//   extract : WNDB(data.noun/verb/adj/adv) 스트림 → lemma→{syn,ant,der,rel,ex} 맵 → data/wordnet/wordnet-enrich.json
//   apply-<f> [--commit] [--provenance] : 필드별 정책(설계 v3 §2)으로 갱신. f ∈ syn|ant|der|rel|ex|all
//     related_terms/derived_forms=교체+잔여purge · synonyms=교체+잔여flag · example_en=빈칸만(시드보존) · antonyms=병합+denoise
//
// 실행:
//   node scripts/dict/wordnet-enrich.mjs extract
//   node scripts/dict/wordnet-enrich.mjs apply-all              # dry-run(정책별 측정)
//   node scripts/dict/wordnet-enrich.mjs apply-all --commit     # 적용
//   node scripts/dict/wordnet-enrich.mjs apply-all --commit --provenance  # + field_provenance 스탬프(마이그 선행)

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

// ── env 로드 (apps/web/.env.local) ──
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
const STAMP = process.argv.includes('--provenance') // field_provenance 스탬프(마이그레이션 선행 필요)

const WNDB_DIR = path.join(ROOT, 'scripts/dict/data/wordnet') // data.noun 등 위치 (gitignore)
const MAP_PATH = path.join(WNDB_DIR, 'wordnet-enrich.json')
const PROV = process.env.WORDNET_PROVENANCE || 'wordnet-3.1'

const WORD_RE = /^[a-z][a-z '-]*[a-z]$/ // 소문자 영단어(공백/하이픈/어포스트로피 허용)
const norm = (w) => (w || '').replace(/_/g, ' ').toLowerCase().trim()
const CAP = { syn: 10, ant: 8, der: 12, rel: 10 }

// ─────────────────────────────────────────────────────────────
// EXTRACT — WNDB flat files 파싱
// ─────────────────────────────────────────────────────────────
async function extract() {
  const files = ['data.noun', 'data.verb', 'data.adj', 'data.adv']
  for (const f of files) {
    if (!fs.existsSync(path.join(WNDB_DIR, f))) {
      console.error(`✗ WNDB 파일 없음: ${path.join(WNDB_DIR, f)}\n  Princeton WordNet 3.1(dict/) 또는 OEWN 변환본을 scripts/dict/data/wordnet/ 에 배치하세요.`)
      process.exit(1)
    }
  }

  // Pass 1: 모든 synset 로드 → key `${pos}${offset}` → {words:[], ptrs:[{sym,pos,off,src,tgt}], examples:[]}
  const synsets = new Map()
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(WNDB_DIR, f), { encoding: 'utf8' }), crlfDelay: Infinity })
    for await (const line of rl) {
      if (!line || line.startsWith('  ')) continue // 라이선스 헤더
      const barIdx = line.indexOf(' | ')
      const head = barIdx >= 0 ? line.slice(0, barIdx) : line
      const gloss = barIdx >= 0 ? line.slice(barIdx + 3) : ''
      const t = head.split(/\s+/)
      let i = 0
      const offset = t[i++]
      i++ // lex_filenum
      const ssType = t[i++] // n/v/a/s/r
      const pos = ssType === 's' ? 'a' : ssType // satellite adj → a
      const wCnt = parseInt(t[i++], 16)
      const words = []
      for (let k = 0; k < wCnt; k++) { words.push(norm(t[i])); i += 2 } // word, lex_id
      const pCnt = parseInt(t[i++], 10)
      const ptrs = []
      for (let k = 0; k < pCnt; k++) {
        const sym = t[i++], off = t[i++], pp = t[i++], st = t[i++] // symbol, offset, pos, src/tgt(4hex)
        const src = parseInt(st.slice(0, 2), 16), tgt = parseInt(st.slice(2, 4), 16)
        ptrs.push({ sym, pos: pp, off, src, tgt })
      }
      const examples = [...gloss.matchAll(/"([^"]+)"/g)].map((m) => m[1].trim()).filter((s) => s.length >= 6 && s.length <= 220)
      synsets.set(`${pos}${offset}`, { words, ptrs, examples, pos })
    }
    rl.close()
  }
  console.log(`synsets: ${synsets.size}`)

  const tgtWords = (pos, off) => synsets.get(`${pos}${off}`)?.words || []

  // Pass 2: lemma → 필드
  const map = Object.create(null) // lemma → {syn:Set, ant:Set, der:Set, rel:Set, ex:string|null}
  const ent = (w) => (map[w] ??= { syn: new Set(), ant: new Set(), der: new Set(), rel: new Set(), ex: null })

  for (const [, ss] of synsets) {
    for (let wi = 0; wi < ss.words.length; wi++) {
      const lemma = ss.words[wi]
      if (!WORD_RE.test(lemma)) continue
      const e = ent(lemma)
      // synonyms — 같은 synset 의 다른 단어
      for (const w of ss.words) if (w !== lemma && WORD_RE.test(w)) e.syn.add(w)
      // pointers (이 lemma 가 source 이거나 synset 전체 0)
      for (const p of ss.ptrs) {
        if (p.src !== 0 && p.src !== wi + 1) continue // lemma-specific 이면 이 단어 대상만
        const words = tgtWords(p.pos, p.off)
        const pick = (p.tgt && words[p.tgt - 1]) ? [words[p.tgt - 1]] : words
        for (const w of pick) {
          if (!WORD_RE.test(w) || w === lemma) continue
          if (p.sym === '!') e.ant.add(w)
          else if (p.sym === '+') e.der.add(w)
          else if (p.sym === '@' || p.sym === '@i' || p.sym === '~' || p.sym === '~i' || p.sym === '^') e.rel.add(w)
        }
      }
      // example — lemma 포함 예문 우선
      if (!e.ex && ss.examples.length) {
        const re = new RegExp(`\\b${lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        e.ex = ss.examples.find((x) => re.test(x)) || ss.examples[0]
      }
    }
  }

  // 직렬화 (Set → capped array)
  const obj = Object.create(null)
  let nSyn = 0, nAnt = 0, nDer = 0, nRel = 0, nEx = 0
  for (const [w, e] of Object.entries(map)) {
    const syn = [...e.syn].slice(0, CAP.syn), ant = [...e.ant].slice(0, CAP.ant)
    const der = [...e.der].slice(0, CAP.der), rel = [...e.rel].slice(0, CAP.rel)
    if (syn.length) nSyn++; if (ant.length) nAnt++; if (der.length) nDer++; if (rel.length) nRel++; if (e.ex) nEx++
    obj[w] = { syn, ant, der, rel, ex: e.ex || null }
  }
  fs.mkdirSync(WNDB_DIR, { recursive: true })
  fs.writeFileSync(MAP_PATH, JSON.stringify(obj))
  console.log(`extracted: ${Object.keys(obj).length} lemmas → ${MAP_PATH}`)
  console.log(`  syn ${nSyn} · ant ${nAnt} · der ${nDer} · rel ${nRel} · ex ${nEx}`)
}

// ─────────────────────────────────────────────────────────────
// APPLY — shared_dictionary 갱신 (필드별 선별 정책, 설계 v3 §2)
// ─────────────────────────────────────────────────────────────
// mode:
//   overwritePurge : WordNet 값 덮어씀. 없으면 NULL 제거(잔여=kaikki 전용) — related_terms/derived_forms
//   overwrite      : WordNet 값 덮어씀. 없으면 잔여 유지 + 'kaikki-unverified' flag — synonyms
//   fillEmpty      : 빈칸일 때만 삽입(기존 보존) — example_en(시드 예문 보호)
//   mergeDenoise   : 기존∪WordNet, 실단어(WordNet lemma) 필터·dedupe·cap — antonyms
const POLICY = {
  synonyms:      { key: 'syn', mode: 'overwrite',      cap: 10 },
  antonyms:      { key: 'ant', mode: 'mergeDenoise',   cap: 8 },
  derived_forms: { key: 'der', mode: 'overwritePurge', cap: 12 },
  related_terms: { key: 'rel', mode: 'overwritePurge', cap: 10 },
  example_en:    { key: 'ex',  mode: 'fillEmpty' },
}
const KEY2COL = { syn: 'synonyms', ant: 'antonyms', der: 'derived_forms', rel: 'related_terms', ex: 'example_en' }
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// {data,error} 패턴 재시도 (fetch failed 등 일시 네트워크 오류 대응)
async function q(fn, n = 6) {
  let last
  for (let i = 0; i < n; i++) {
    try { const r = await fn(); if (!r || !r.error) return r; last = r.error } catch (e) { last = e }
    await sleep(400 * (i + 1))
  }
  return { error: last }
}

async function apply(fieldsArg) {
  if (!fs.existsSync(MAP_PATH)) { console.error(`✗ 맵 없음: ${MAP_PATH} — 먼저 'extract' 실행`); process.exit(1) }
  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'))
  const knownWords = new Set(Object.keys(map)) // mergeDenoise 실단어 필터 기준(WordNet lemma)
  const cols = fieldsArg === 'all' ? Object.keys(POLICY) : [KEY2COL[fieldsArg] || fieldsArg]
  if (cols.some((c) => !POLICY[c])) { console.error(`✗ 알 수 없는 필드: ${cols}`); process.exit(1) }

  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const stat = Object.fromEntries(cols.map((c) => [c, { overwrite: 0, purge: 0, fill: 0, merge: 0, flag: 0 }]))
  let scanned = 0, committed = 0
  const selCols = 'word,' + [...new Set(cols)].join(',') + (STAMP && COMMIT ? ',field_provenance' : '')
  let cursor = ''
  const CONC = 8
  for (;;) {
    const { data, error } = await q(() => db.from('shared_dictionary').select(selCols).gt('word', cursor).order('word').limit(1000))
    if (error) { console.error('select 오류(재시도 소진):', error.message || error); process.exit(1) }
    if (!data || !data.length) break
    const ops = [] // 이 페이지의 변경 { word, upd }
    for (const row of data) {
      scanned++
      const wn = map[row.word]
      const upd = {}
      const prov = (STAMP && COMMIT) ? { ...(row.field_provenance || {}) } : null
      for (const col of cols) {
        const p = POLICY[col]
        const wnArr = p.key === 'ex' ? (wn?.ex ? [wn.ex] : []) : (wn?.[p.key] || [])
        const wnHas = wnArr.length > 0
        const curRaw = row[col]
        const curArr = col === 'example_en' ? (curRaw ? [curRaw] : []) : (Array.isArray(curRaw) ? curRaw : [])
        const curHas = curArr.length > 0

        if (p.mode === 'overwritePurge') {
          if (wnHas) { if (!eqArr(curArr, wnArr)) { upd[col] = wnArr; if (prov) prov[col] = PROV; stat[col].overwrite++ } }
          else if (curHas) { upd[col] = null; if (prov) prov[col] = 'cleared'; stat[col].purge++ }
        } else if (p.mode === 'overwrite') {
          if (wnHas) { if (!eqArr(curArr, wnArr)) { upd[col] = wnArr; if (prov) prov[col] = PROV; stat[col].overwrite++ } }
          else if (curHas && prov && prov[col] !== 'kaikki-unverified') { prov[col] = 'kaikki-unverified'; stat[col].flag++ }
        } else if (p.mode === 'fillEmpty') {
          if (!curHas && wnHas) { upd[col] = p.key === 'ex' ? wnArr[0] : wnArr; if (prov) prov[col] = PROV; stat[col].fill++ }
        } else if (p.mode === 'mergeDenoise') {
          const merged = [...new Set([...curArr, ...wnArr].map((x) => x.toLowerCase()))].filter((t) => knownWords.has(t)).slice(0, p.cap)
          if (!eqArr(merged, curArr.map((x) => x.toLowerCase()))) {
            upd[col] = merged
            if (prov) prov[col] = wnHas ? 'wordnet+existing' : 'existing-denoised'
            stat[col].merge++
          }
        }
      }
      const changed = Object.keys(upd).length > 0
      if (!changed && !(prov && JSON.stringify(prov) !== JSON.stringify(row.field_provenance || {}))) continue
      if (COMMIT) {
        if (prov) upd.field_provenance = prov
        ops.push({ word: row.word, upd })
      }
    }
    // 페이지 변경분을 동시성 풀(CONC)로 재시도 적용
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
    const s = stat[col]; const p = POLICY[col]
    console.log(`  ${col.padEnd(14)} [${p.mode}] overwrite ${s.overwrite} · purge ${s.purge} · fill ${s.fill} · merge ${s.merge} · flag ${s.flag}`)
  }
}

// ── dispatch ──
if (MODE === 'extract') await extract()
else if (MODE.startsWith('apply-')) {
  await apply(MODE.slice('apply-'.length))
} else {
  console.error('usage: wordnet-enrich.mjs extract | apply-{syn|ant|der|rel|ex|all} [--commit] [--provenance]')
  console.error('  정책(설계 v3 §2): related_terms/derived_forms=교체+purge · synonyms=교체+flag · example_en=빈칸만 · antonyms=병합+denoise')
  process.exit(1)
}
